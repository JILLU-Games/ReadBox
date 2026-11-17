import { parseEnvironment } from "@/config/env-schema";
import { parseOpenDkimPublicKeyFile, readOpenDkimRecord } from "@/core/dns/opendkim";
import { buildCloudflareZoneFile, buildExpectedDnsRecords } from "@/core/dns/records";
import {
  DnsVerificationError,
  verifyAllDnsRecords,
  verifyRoutingDns,
} from "@/core/dns/resolver";
import {
  checkDomainDns,
  createDomain,
  deleteDomain,
  setDefaultDomain,
  updateDomainStatus,
  type DomainPrismaClient,
} from "@/core/domains/service";
import { buildMailboxPaths, confinedPath } from "@/core/mailboxes/paths";
import { withProvisionLock } from "@/core/mailboxes/provisioning";
import {
  bulkPurgeMailboxes,
  createSystemMailbox,
  provisionMailbox,
  purgeMailbox,
  setMailboxActive,
  type MailboxPrismaClient,
} from "@/core/mailboxes/service";
import {
  MailValidationError,
  RESERVED_LOCAL_PARTS,
  validateDomain,
  validateLocalPart,
} from "@/core/mailboxes/validators";
import {
  createPgReadOnlyMailServerAdapter,
  generateDisabledMailboxPasswordHash,
  MailServerContractError,
  quoteSqlIdentifier,
  verifyMailserverContract,
  type SqlQueryExecutor,
} from "@/core/mailserver/pg-adapter";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test("env-schema provides Phase 3 mail/DNS defaults and validates SERVER_IP", () => {
  const defaults = parseEnvironment({});
  assert.equal(defaults.mailDomain, "readbox.local");
  assert.equal(defaults.mailHostname, "mail.readbox.local");
  assert.equal(defaults.appHostname, "app.readbox.local");
  assert.equal(defaults.serverIp, "127.0.0.1");
  assert.equal(defaults.mailboxDefaultQuotaBytes, 2_147_483_648);
  assert.equal(defaults.dnsLookupTimeoutSeconds, 3);

  const ipv6 = parseEnvironment({ SERVER_IP: "2001:db8::10" });
  assert.equal(ipv6.serverIp, "2001:db8::10");

  assert.throws(() => parseEnvironment({ SERVER_IP: "not-an-ip" }));
});

test("pg-adapter validates SQL identifiers and queries postfix views safely", async () => {
  assert.equal(quoteSqlIdentifier("mailserver", "schema"), '"mailserver"');
  assert.throws(
    () => quoteSqlIdentifier("mailserver; DROP TABLE users;--", "schema"),
    MailServerContractError,
  );
  assert.throws(
    () => quoteSqlIdentifier("BadUpperCase", "schema"),
    MailServerContractError,
  );

  const hash = generateDisabledMailboxPasswordHash();
  assert.match(hash, /^!READBOX-READ-ONLY![A-Za-z0-9_-]+$/);

  const queries: string[] = [];
  const executor: SqlQueryExecutor = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes("COUNT(*)")) {
        return { rows: [{ count: 1 }], rowCount: 1 } as never;
      }
      if (sql.includes("postfix_virtual_domains")) {
        return {
          rows: [{ name: "example.test" }],
          rowCount: 1,
        } as never;
      }
      if (sql.includes("postfix_virtual_mailboxes")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("postfix_virtual_aliases")) {
        throw Object.assign(new Error("query timeout"), { code: "57014" });
      }
      return { rows: [], rowCount: 0 } as never;
    },
  };

  const adapter = createPgReadOnlyMailServerAdapter(executor);
  const domainRes = await adapter.lookupDomains({ name: "Example.TEST." });
  assert.deepEqual(domainRes, {
    kind: "records",
    records: [{ name: "example.test" }],
  });
  assert.match(
    queries[0] ?? "",
    /FROM "mailserver"\."postfix_virtual_domains"/,
  );

  const mailboxMissing = await adapter.lookupMailboxes({
    email: "missing@example.test",
  });
  assert.deepEqual(mailboxMissing, { kind: "not_found" });

  const badInput = await adapter.lookupMailboxes({ email: "invalid-email" });
  assert.deepEqual(badInput, { kind: "error", code: "invalid_input" });

  const aliasTimeout = await adapter.lookupAliases({
    source: "alias@example.test",
  });
  assert.deepEqual(aliasTimeout, { kind: "error", code: "timeout" });

  const contract = await verifyMailserverContract(executor);
  assert.deepEqual(contract, { domains: 1, mailboxes: 1, postfixRows: 1 });
});

test("OpenDKIM parser, 5-record DNS builder, Cloudflare zone, and split DNS checks work cleanly", async () => {
  const root = makeTempDir("readbox-dkim-");
  const keyDir = join(root, "example.test");
  mkdirSync(keyDir, { recursive: true });
  writeFileSync(
    join(keyDir, "mail.txt"),
    'mail._domainkey\tIN\tTXT\t( "v=DKIM1; h=sha256; k=rsa; "\n  "p=MIIBIjANBgkqhkiG9w0BAQEFAA==" )',
    "ascii",
  );

  const parsed = parseOpenDkimPublicKeyFile(
    '"v=DKIM1; k=rsa; p=ABC123=="',
  );
  assert.equal(parsed.available, true);
  assert.equal(parsed.copyable, true);
  assert.equal(parsed.value, "v=DKIM1; k=rsa; p=ABC123==");

  const diskDkim = await readOpenDkimRecord("example.test", root);
  assert.equal(diskDkim.available, true);
  assert.equal(diskDkim.value, "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAA==");

  const missingDkim = await readOpenDkimRecord("missing.test", root);
  assert.equal(missingDkim.available, false);
  assert.equal(missingDkim.copyable, false);

  const ipv4Records = buildExpectedDnsRecords("example.test", {
    mailHostname: "mail.example.test",
    serverIp: "192.0.2.10",
    dkim: diskDkim,
  });
  assert.equal(ipv4Records.length, 5);
  assert.equal(ipv4Records[0]?.type, "MX");
  assert.equal(ipv4Records[0]?.category, "routing");
  assert.equal(ipv4Records[1]?.type, "A");
  assert.equal(ipv4Records[1]?.cfHost, "mail");
  assert.equal(ipv4Records[2]?.type, "TXT");
  assert.equal(ipv4Records[2]?.category, "deliverability");

  const ipv6Records = buildExpectedDnsRecords("example.test", {
    mailHostname: "mail.example.test",
    serverIp: "2001:db8::10",
  });
  assert.equal(ipv6Records[1]?.type, "AAAA");

  const zone = buildCloudflareZoneFile("example.test", ipv4Records);
  assert.match(zone, /\$ORIGIN example\.test\./);
  assert.match(zone, /IN\tMX\t10\tmail\.example\.test\./);
  assert.match(zone, /IN\tA\t192\.0\.2\.10/);

  // DISC-002: routing passes on MX + A even if SPF/DKIM/DMARC are missing
  const routingOnlyLookup = {
    async resolve(name: string, type: "MX" | "A" | "AAAA" | "TXT") {
      if (type === "MX") return ["MAIL.EXAMPLE.TEST."];
      if (type === "A" && name === "mail.example.test") return ["192.0.2.10"];
      return [];
    },
  };

  const routingRes = await verifyRoutingDns("Example.Test", {
    mailHostname: "mail.example.test",
    expectedServerIp: "192.0.2.10",
    lookup: routingOnlyLookup,
  });
  assert.equal(routingRes.verified, true);
  assert.equal(routingRes.mxOk, true);
  assert.equal(routingRes.targetOk, true);

  // FA-011: Loopback default SERVER_IP=127.0.0.1 must not silently pass routing verification
  const loopbackRoutingRes = await verifyRoutingDns("Example.Test", {
    mailHostname: "mail.example.test",
    expectedServerIp: "127.0.0.1",
    lookup: routingOnlyLookup,
  });
  assert.equal(loopbackRoutingRes.verified, false);
  assert.equal(loopbackRoutingRes.mxOk, true);
  assert.equal(loopbackRoutingRes.targetOk, false);
  assert.match(loopbackRoutingRes.message, /non-loopback SERVER_IP/i);

  const fullRes = await verifyAllDnsRecords("example.test", {
    mailHostname: "mail.example.test",
    serverIp: "192.0.2.10",
    opendkimKeysRoot: root,
    lookup: routingOnlyLookup,
  });
  assert.equal(fullRes.routingVerified, true);
  assert.equal(fullRes.allVerified, false);

  const timeoutRes = await verifyAllDnsRecords("example.test", {
    mailHostname: "mail.example.test",
    serverIp: "192.0.2.10",
    opendkimKeysRoot: root,
    lookup: {
      async resolve() {
        throw new DnsVerificationError("timeout", "timeout");
      },
    },
  });
  assert.equal(timeoutRes.routingVerified, false);
  assert.equal(timeoutRes.lookupFailed, true);
});

test("Domain service enforces dnsConfirmed, immutable name, auto-disable on failure, default switch, and delete guards", async () => {
  const audits: string[] = [];
  const mailserverDomains = new Map<string, boolean>();
  const mailserverExecutor: SqlQueryExecutor = {
    async query(sql, params = []) {
      const lowerSql = sql.toLowerCase();
      if (lowerSql.includes("select \"id\" from \"mailserver\".\"mail_domains\"")) {
        const domain = String(params[0]);
        return (
          mailserverDomains.has(domain)
            ? { rows: [{ id: 1 }], rowCount: 1 }
            : { rows: [], rowCount: 0 }
        ) as never;
      }
      if (lowerSql.startsWith("insert into \"mailserver\".\"mail_domains\"")) {
        mailserverDomains.set(String(params[0]), Boolean(params[1]));
        return { rows: [], rowCount: 1 } as never;
      }
      if (lowerSql.startsWith("update \"mailserver\".\"mail_domains\"")) {
        mailserverDomains.set(String(params[1] ?? "example.test"), Boolean(params[0]));
        return { rows: [], rowCount: 1 } as never;
      }
      if (lowerSql.includes("from \"mailserver\".\"mailboxes\"")) {
        return { rows: [], rowCount: 0 } as never;
      }
      if (lowerSql.startsWith("delete from \"mailserver\".\"mail_domains\"")) {
        mailserverDomains.clear();
        return { rows: [], rowCount: 1 } as never;
      }
      return { rows: [], rowCount: 0 } as never;
    },
  };

  let domainRow = {
    id: BigInt(10),
    uuid: "11111111-1111-4111-8111-111111111111",
    name: "example.test",
    status: "disabled",
    verificationStatus: "pending",
    isDefault: false,
  };
  let mailboxCount = 0;
  let forceCreateFail = false;

  const mockPrisma = {
    user: { findUnique: async () => ({ id: BigInt(1) }) },
    auditLog: {
      create: async (args: { data: { action: string } }) => {
        audits.push(args.data.action);
        return {};
      },
    },
    mailbox: {
      count: async () => mailboxCount,
    },
    domain: {
      findFirst: async () => null,
      findUnique: async () => domainRow,
      create: async () => {
        if (forceCreateFail) throw new Error("DB error");
        return { uuid: domainRow.uuid, name: domainRow.name };
      },
      update: async (args: { data: Partial<typeof domainRow> }) => {
        domainRow = { ...domainRow, ...args.data };
        return domainRow;
      },
      updateMany: async () => ({ count: 1 }),
      delete: async () => domainRow,
    },
    $transaction: async (ops: unknown[]) => Promise.all(ops),
  } as unknown as DomainPrismaClient;

  const ctx = { actorId: BigInt(1) };

  const unconfirmed = await createDomain(
    mockPrisma,
    { name: "example.test", dnsConfirmed: false },
    ctx,
    mailserverExecutor,
  );
  assert.equal(unconfirmed.ok, false);

  // Rollback mailserver row if DB create fails
  forceCreateFail = true;
  const rolledBack = await createDomain(
    mockPrisma,
    { name: "example.test", dnsConfirmed: true },
    ctx,
    mailserverExecutor,
  );
  assert.equal(rolledBack.ok, false);
  assert.equal(mailserverDomains.size, 0);

  forceCreateFail = false;
  const created = await createDomain(
    mockPrisma,
    { name: "Example.Test", dnsConfirmed: true },
    ctx,
    mailserverExecutor,
  );
  assert.equal(created.ok, true);
  assert.equal(mailserverDomains.get("example.test"), false);

  // Rename blocked
  const renamed = await updateDomainStatus(
    mockPrisma,
    domainRow.uuid,
    { status: "disabled", submittedName: "renamed.test" },
    ctx,
    mailserverExecutor,
  );
  assert.equal(renamed.ok, false);

  // Enabling unverified domain blocked
  const enabledEarly = await updateDomainStatus(
    mockPrisma,
    domainRow.uuid,
    { status: "active", submittedName: "example.test" },
    ctx,
    mailserverExecutor,
  );
  assert.equal(enabledEarly.ok, false);

  // Check DNS passes -> sets verified, does NOT auto-enable
  const passedCheck = await checkDomainDns(
    mockPrisma,
    domainRow.uuid,
    {
      mailHostname: "mail.example.test",
      serverIp: "192.0.2.10",
      lookup: {
        async resolve(_n, type) {
          return type === "MX" ? ["mail.example.test"] : ["192.0.2.10"];
        },
      },
    },
    ctx,
    mailserverExecutor,
  );
  assert.equal(passedCheck.ok, true);
  assert.equal(domainRow.verificationStatus, "verified");
  assert.equal(domainRow.status, "disabled");

  // Enable now succeeds
  const activated = await updateDomainStatus(
    mockPrisma,
    domainRow.uuid,
    { status: "active", submittedName: "example.test" },
    ctx,
    mailserverExecutor,
  );
  assert.equal(activated.ok, true);
  assert.equal(domainRow.status, "active");

  // Failed routing check auto-disables active domain
  await checkDomainDns(
    mockPrisma,
    domainRow.uuid,
    {
      mailHostname: "mail.example.test",
      serverIp: "192.0.2.10",
      lookup: {
        async resolve() {
          return [];
        },
      },
    },
    ctx,
    mailserverExecutor,
  );
  assert.equal(domainRow.verificationStatus, "failed");
  assert.equal(domainRow.status, "disabled");
  assert.equal(mailserverDomains.get("example.test"), false);

  // Default domain guard & switch
  domainRow.verificationStatus = "verified";
  domainRow.status = "active";
  const madeDefault = await setDefaultDomain(mockPrisma, domainRow.uuid, ctx);
  assert.equal(madeDefault.ok, true);
  assert.equal(domainRow.isDefault, true);

  // Cannot delete default or domain with mailboxes
  const blockedDefaultDelete = await deleteDomain(
    mockPrisma,
    domainRow.uuid,
    "other.test",
    ctx,
    mailserverExecutor,
  );
  assert.equal(blockedDefaultDelete.ok, false);

  domainRow.isDefault = false;
  mailboxCount = 2;
  const blockedMailboxDelete = await deleteDomain(
    mockPrisma,
    domainRow.uuid,
    "other.test",
    ctx,
    mailserverExecutor,
  );
  assert.equal(blockedMailboxDelete.ok, false);

  mailboxCount = 0;
  const deletedOk = await deleteDomain(
    mockPrisma,
    domainRow.uuid,
    "other.test",
    ctx,
    mailserverExecutor,
  );
  assert.equal(deletedOk.ok, true);
  assert.ok(audits.includes("domain_create"));
  assert.ok(audits.includes("domain_delete"));
});

test("Mailbox validators & confinedPath reject reserved local parts, traversal, and symlinks", () => {
  assert.equal(validateLocalPart("Sales.Team-1"), "sales.team-1");
  for (const reserved of RESERVED_LOCAL_PARTS) {
    assert.throws(() => validateLocalPart(reserved), MailValidationError);
    assert.equal(
      validateLocalPart(reserved, { allowReserved: true }),
      reserved,
    );
  }
  assert.throws(() => validateDomain("127.0.0.1"), MailValidationError);
  assert.throws(() => validateDomain("bad domain.test"), MailValidationError);

  const root = makeTempDir("readbox-confine-");
  const outside = makeTempDir("readbox-outside-");
  symlinkSync(outside, join(root, "escape"));

  assert.throws(() => confinedPath(root, "..", "etc"));
  assert.throws(() => confinedPath(root, "a/b"));
  assert.throws(() => confinedPath(root, "escape", "secret"));

  const bundle = buildMailboxPaths("alex.reed10", "example.test", root);
  assert.equal(bundle.relativePath, "example.test/alex.reed10/Maildir/");
});

test("Mailbox provisioning creates 0700 Maildir, rolls back only new trees on DB failure, handles locks, and purges cleanly", async () => {
  const storageRoot = makeTempDir("readbox-vmail-");
  const attachmentRoot = makeTempDir("readbox-att-");
  const lockRoot = makeTempDir("readbox-lock-");

  const config = {
    mailDomain: "example.test",
    mailStorageRoot: storageRoot,
    attachmentStorageRoot: attachmentRoot,
    mailboxProvisionLockRoot: lockRoot,
    defaultQuotaBytes: 2_147_483_648,
  };

  const remoteMailboxes = new Set<string>();
  const audits: string[] = [];
  let failAppTransaction = false;

  const sqlExecutor: SqlQueryExecutor = {
    async query(sql, params = []) {
      const lower = sql.toLowerCase();
      if (lower.includes("from \"mailserver\".\"mail_aliases\"")) {
        return { rows: [], rowCount: 0 } as never;
      }
      if (lower.includes("from \"mailserver\".\"mail_domains\"")) {
        return { rows: [{ id: 1 }], rowCount: 1 } as never;
      }
      if (lower.startsWith("select 1 from \"mailserver\".\"mailboxes\"")) {
        const email = String(params[0]);
        return (
          remoteMailboxes.has(email)
            ? { rows: [{ ok: 1 }], rowCount: 1 }
            : { rows: [], rowCount: 0 }
        ) as never;
      }
      if (lower.startsWith("insert into \"mailserver\".\"mailboxes\"")) {
        remoteMailboxes.add(String(params[2]));
        return { rows: [], rowCount: 1 } as never;
      }
      if (lower.startsWith("update \"mailserver\".\"mailboxes\"")) {
        return { rows: [], rowCount: 1 } as never;
      }
      if (lower.startsWith("delete from \"mailserver\".\"mailboxes\"")) {
        const email = String(params[0]);
        const had = remoteMailboxes.delete(email);
        return { rows: [], rowCount: had ? 1 : 0 } as never;
      }
      return { rows: [], rowCount: 0 } as never;
    },
  };

  const domainRecord = {
    id: BigInt(1),
    uuid: "22222222-2222-4222-8222-222222222222",
    name: "example.test",
    status: "active",
    verificationStatus: "verified",
  };
  type MockStoredMailbox = {
    id: bigint;
    uuid: string;
    localPart: string;
    emailAddress: string;
    status: string;
    deletedAt: Date | null;
    domain: { name: string };
  };
  let storedMailbox: MockStoredMailbox | null = null;
  const getStoredMailbox = (): MockStoredMailbox => {
    if (!storedMailbox) {
      throw new Error("Expected storedMailbox to exist");
    }
    return storedMailbox;
  };

  const mockPrisma = {
    user: {
      findUnique: async () => ({ id: BigInt(1) }),
      findMany: async () => [{ id: BigInt(9) }],
    },
    auditLog: {
      create: async (args: { data: { action: string } }) => {
        audits.push(args.data.action);
        return {};
      },
    },
    domain: {
      findUnique: async () => domainRecord,
      findFirst: async () => domainRecord,
    },
    mailbox: {
      findFirst: async () => storedMailbox,
      findUnique: async () => storedMailbox,
      findMany: async () => (storedMailbox ? [storedMailbox] : []),
      update: async (args: { data: { status: string } }) => {
        if (storedMailbox) storedMailbox.status = args.data.status;
        return storedMailbox;
      },
      delete: async () => {
        const prev = storedMailbox;
        storedMailbox = null;
        return prev;
      },
    },
    attachment: {
      findMany: async () => [
        { storageRelativePath: "example.test/sample.pdf" },
      ],
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      if (failAppTransaction) {
        throw new Error("Simulated app DB failure");
      }
      return fn({
        mailbox: {
          create: async () => {
            storedMailbox = {
              id: BigInt(77),
              uuid: "33333333-3333-4333-8333-333333333333",
              localPart: "support.desk12",
              emailAddress: "support.desk12@example.test",
              status: "active",
              deletedAt: null,
              domain: { name: "example.test" },
            };
            return storedMailbox;
          },
        },
        mailboxMembership: {
          createMany: async () => ({ count: 1 }),
        },
      });
    },
  } as unknown as MailboxPrismaClient;

  const ctx = { actorId: BigInt(1) };

  // 1. Failure-injection rollback removes newly created tree & mailserver row
  failAppTransaction = true;
  const failedNewTree = await provisionMailbox(
    mockPrisma,
    { localPart: "rollback.new", domainUuid: domainRecord.uuid },
    config,
    ctx,
    { sqlExecutor },
  );
  assert.equal(failedNewTree.ok, false);
  assert.equal(remoteMailboxes.size, 0);
  assert.equal(existsSync(join(storageRoot, "example.test")), false);
  assert.ok(audits.includes("mailbox_provisioning_failure"));

  // 2. Failure-injection preserves pre-existing directories
  const preExistingRoot = join(storageRoot, "example.test", "pre.existing");
  mkdirSync(join(preExistingRoot, "Maildir"), { recursive: true });
  writeFileSync(join(preExistingRoot, "keep.txt"), "keep");
  const failedExistingTree = await provisionMailbox(
    mockPrisma,
    { localPart: "pre.existing", domainUuid: domainRecord.uuid },
    config,
    ctx,
    { sqlExecutor },
  );
  assert.equal(failedExistingTree.ok, false);
  assert.equal(existsSync(join(preExistingRoot, "keep.txt")), true);

  // 3. Provisioning success creates 0700 Maildir/{new,cur,tmp}
  failAppTransaction = false;
  const provisioned = await provisionMailbox(
    mockPrisma,
    {
      localPart: "support.desk12",
      domainUuid: domainRecord.uuid,
      assignedUserIds: ["9"],
    },
    config,
    ctx,
    { sqlExecutor },
  );
  assert.equal(provisioned.ok, true);
  assert.ok(remoteMailboxes.has("support.desk12@example.test"));

  const maildir = join(storageRoot, "example.test", "support.desk12", "Maildir");
  for (const sub of ["", "new", "cur", "tmp"]) {
    const target = sub ? join(maildir, sub) : maildir;
    assert.equal(existsSync(target), true);
    assert.equal(statSync(target).mode & 0o777, 0o700);
  }

  // 4. Toggle active & purge confirmation mismatch + typed purge
  const disabled = await setMailboxActive(
    mockPrisma,
    getStoredMailbox().uuid,
    false,
    ctx,
    sqlExecutor,
  );
  assert.equal(disabled.ok, true);
  assert.equal(getStoredMailbox().status, "disabled");

  mkdirSync(join(attachmentRoot, "example.test"), { recursive: true });
  writeFileSync(join(attachmentRoot, "example.test", "sample.pdf"), "pdf");

  const badConfirm = await purgeMailbox(
    mockPrisma,
    getStoredMailbox().uuid,
    "wrong@example.test",
    config,
    ctx,
    sqlExecutor,
  );
  assert.equal(badConfirm.ok, false);
  assert.ok(existsSync(maildir));

  const purged = await purgeMailbox(
    mockPrisma,
    getStoredMailbox().uuid,
    "SUPPORT.DESK12@example.test",
    config,
    ctx,
    sqlExecutor,
  );
  assert.equal(purged.ok, true);
  assert.equal(remoteMailboxes.has("support.desk12@example.test"), false);
  assert.equal(
    existsSync(join(storageRoot, "example.test", "support.desk12")),
    false,
  );
  assert.equal(
    existsSync(join(attachmentRoot, "example.test", "sample.pdf")),
    false,
  );

  // 5. System mailbox requires confirmation
  const deniedSystem = await createSystemMailbox(
    mockPrisma,
    { localPart: "postmaster", domainUuid: domainRecord.uuid, confirm: false },
    config,
    ctx,
    { sqlExecutor },
  );
  assert.equal(deniedSystem.ok, false);

  const createdSystem = await createSystemMailbox(
    mockPrisma,
    { localPart: "postmaster", domainUuid: domainRecord.uuid, confirm: true },
    config,
    ctx,
    { sqlExecutor },
  );
  assert.equal(createdSystem.ok, true);

  // 6. Bulk purge requires explicit confirmation
  const bulkDenied = await bulkPurgeMailboxes(
    mockPrisma,
    ["33333333-3333-4333-8333-333333333333"],
    false,
    config,
    ctx,
    sqlExecutor,
  );
  assert.equal(bulkDenied.ok, false);

  // 7. Lock contention fails cleanly when lock already held
  await withProvisionLock(lockRoot, "busy-test", async () => {
    await assert.rejects(
      () =>
        withProvisionLock(
          lockRoot,
          "busy-test",
          async () => undefined,
          { retries: 0 },
        ),
      /already in progress/i,
    );
  });
});
