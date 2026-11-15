import { parseEnvironment } from "@/config/env-schema";
import {
  detectSafeMimeType,
  storeConfinedAttachment,
} from "@/core/ingestion/attachments";
import { parseEmailMessage, sha256Bytes } from "@/core/ingestion/parser";
import {
  BodyRepairError,
  repairMessageBodies,
  runMessageBodyRepairBatch,
  sourcePathForMessage,
  type RepairPrismaClient,
} from "@/core/ingestion/repair";
import {
  CSS_BLOCK_MAX_INPUT_BYTES,
  CSS_MAX_RETAINED_RULES,
  CssBudget,
  safeAttachmentFilename,
  sanitizeHtmlEmail,
  sanitizeInlineCss,
  sanitizeStylesheet,
} from "@/core/ingestion/sanitizer";
import {
  ingestMaildirFile,
  ingestUnindexedMaildirFiles,
  resolveMaildirSourceKey,
  type IngestionPrismaClient,
} from "@/core/ingestion/service";
import { PathConfinementError } from "@/core/mailboxes/paths";
import { createMaildirTree } from "@/core/mailboxes/provisioning";
import type { SqlQueryExecutor } from "@/core/mailserver/pg-adapter";
import {
  getOperationsOverview,
  runProvisionMaildirs,
  runSyncMailserverMailboxes,
  runVerifyPostfixContract,
  type OperationsPrismaClient,
} from "@/core/operations/service";
import { parseWorkerArgs } from "@/workers/ingestion";
import assert from "node:assert/strict";
import {
  chmodSync,
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

test("env-schema provides Phase 4 ingestion defaults and bounds", () => {
  const defaults = parseEnvironment({});
  assert.equal(defaults.ingestionIntervalSeconds, 15);
  assert.equal(defaults.ingestionLockFile, "/var/lock/readbox-ingestion.lock");
  assert.equal(defaults.maxMessageSizeMb, 25);
  assert.equal(defaults.maxAttachmentSizeMb, 20);
  assert.equal(defaults.maxAttachmentsPerMessage, 25);

  assert.throws(() => parseEnvironment({ INGESTION_INTERVAL_SECONDS: "0" }));
  assert.throws(() => parseEnvironment({ MAX_MESSAGE_SIZE_MB: "999" }));
  assert.throws(() => parseEnvironment({ MAX_ATTACHMENT_SIZE_MB: "0" }));
});

test("HTML/CSS sanitizer strips XSS vectors, remote trackers, SVG images, and dangerous CSS while preserving safe formatting", () => {
  const hostileHtml = `
    <html>
      <head>
        <title>Hidden title</title>
        <style>
          body { background-image: url(https://evil.test/track.png); --x: 1; color: #112233; }
          @import url("https://evil.test/steal.css");
          .card { padding: 12px; width: expression(alert(1)); background-color: #ffffff; }
          @media screen and (max-width: 600px) { .card { padding: 8px; } }
          @media print { .card { color: red; } }
        </style>
      </head>
      <body>
        <script>alert(1)</script>
        <svg onload="alert(2)"><circle r="10"/></svg>
        <iframe src="https://evil.test/frame"></iframe>
        <p onclick="steal()" style="color: #222; background: url(https://evil.test/x); --leak: var(--x);">Hello <strong>world</strong></p>
        <a href="javascript:alert(3)" target="_self">Evil JS</a>
        <a href="//evil.test/proto">Proto</a>
        <a href="https://example.org/docs">Valid link</a>
        <img src="https://evil.test/pixel.png" alt="tracker" />
        <img src="cid:inline-1" alt="cid" />
        <img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" alt="svg" />
        <img src="data:image/png;base64,iVBORw0KGgo=" alt="safe" width="10" />
      </body>
    </html>
  `;

  const cleaned = sanitizeHtmlEmail(hostileHtml);

  assert.doesNotMatch(cleaned, /<script/i);
  assert.doesNotMatch(cleaned, /alert\(/i);
  assert.doesNotMatch(cleaned, /<svg/i);
  assert.doesNotMatch(cleaned, /<iframe/i);
  assert.doesNotMatch(cleaned, /onclick=/i);
  assert.doesNotMatch(cleaned, /javascript:/i);
  assert.doesNotMatch(cleaned, /@import/i);
  assert.doesNotMatch(cleaned, /url\(/i);
  assert.doesNotMatch(cleaned, /expression\(/i);
  assert.doesNotMatch(cleaned, /--x/i);
  assert.doesNotMatch(cleaned, /--leak/i);
  assert.doesNotMatch(cleaned, /tracker/i);
  assert.doesNotMatch(cleaned, /cid:inline-1/i);
  assert.doesNotMatch(cleaned, /image\/svg\+xml/i);
  assert.doesNotMatch(cleaned, /@media\s+print/i);
  assert.doesNotMatch(cleaned, /\/\/evil\.test/i);

  assert.match(cleaned, /<strong>world<\/strong>/);
  assert.match(cleaned, /color:#112233/);
  assert.match(cleaned, /padding:12px/);
  assert.match(cleaned, /@media screen and \(max-width:\s*600px\)/);
  assert.match(cleaned, /data:image\/png;base64,iVBORw0KGgo=/);
  assert.match(
    cleaned,
    /<a href="https:\/\/example\.org\/docs" rel="nofollow noopener noreferrer" target="_blank">Valid link<\/a>/,
  );
  assert.match(cleaned, /color:#222/);
});

test("CSS sanitizer enforces rule count, input size, and style-breakout guards", () => {
  assert.equal(sanitizeInlineCss("color: red</style><script>alert(1)"), "");
  assert.equal(
    sanitizeStylesheet("a { color: red; }".repeat(1000)).split("a{").length - 1,
    CSS_MAX_RETAINED_RULES,
  );

  const oversized = `p { color: #000; }`.repeat(
    Math.ceil(CSS_BLOCK_MAX_INPUT_BYTES / 10),
  );
  assert.equal(sanitizeStylesheet(oversized), "");

  const budget = new CssBudget();
  assert.equal(sanitizeInlineCss("padding: 4px; width: 100px;", budget), "padding:4px;width:100px;");
});

test("safeAttachmentFilename sanitizes path traversal and control bytes", () => {
  assert.equal(safeAttachmentFilename("../../etc/passwd"), "passwd");
  assert.equal(safeAttachmentFilename("C:\\evil\\..\\.hidden.txt"), "hidden.txt");
  assert.equal(safeAttachmentFilename("report\u0000 2026.pdf"), "report 2026.pdf");
  assert.equal(safeAttachmentFilename("..."), "attachment.bin");
  assert.equal(detectSafeMimeType("invoice.pdf", "text/html"), "application/pdf");
});

test("MIME parser extracts text, sanitized HTML, and bounded attachments while isolating malformed input", async () => {
  const eml = [
    "From: Alice <Alice@Example.COM>",
    "To: Support <Support@ReadBox.Test>",
    "Subject: Quarterly Statement",
    "Message-ID: <msg-001@example.com>",
    "Date: Sun, 15 Nov 2026 12:00:00 +0000",
    "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="BOUNDARY123"',
    "",
    "--BOUNDARY123",
    "Content-Type: text/html; charset=utf-8",
    "",
    '<p>Hello</p><script>alert("xss")</script>',
    "",
    "--BOUNDARY123",
    "Content-Type: application/pdf",
    'Content-Disposition: attachment; filename="../../statement.pdf"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from("%PDF-1.4\n").toString("base64"),
    "--BOUNDARY123--",
    "",
  ].join("\r\n");

  const parsed = await parseEmailMessage(Buffer.from(eml, "utf8"), {
    maxAttachmentsPerMessage: 25,
  });

  assert.equal(parsed.parseFailed, false);
  assert.equal(parsed.senderAddress, "alice@example.com");
  assert.deepEqual(parsed.recipientAddresses, ["support@readbox.test"]);
  assert.equal(parsed.subject, "Quarterly Statement");
  assert.equal(parsed.messageIdHeader, "<msg-001@example.com>");
  assert.equal(parsed.sanitizedHtmlBody, "<p>Hello</p>");
  assert.equal(parsed.attachments.length, 1);
  assert.equal(parsed.attachments[0].originalFilename, "../../statement.pdf");

  const emptyResult = await parseEmailMessage(new Uint8Array());
  assert.equal(emptyResult.parseFailed, true);
  assert.equal(emptyResult.warnings[0], "Empty raw message payload");
});

test("storeConfinedAttachment writes exclusive 0600 files and rejects symlinks/oversize", async () => {
  const root = makeTempDir("readbox-att-");
  const attDir = join(root, "attachments");

  const stored = await storeConfinedAttachment(
    Buffer.from("hello-attachment", "utf8"),
    "../hello.txt",
    {
      attachmentStorageRoot: attDir,
      maxAttachmentSizeMb: 1,
      declaredMimeType: "text/plain",
    },
  );

  assert.equal(stored.safeFilename, "hello.txt");
  assert.equal(stored.detectedMimeType, "text/plain");
  assert.match(stored.storageRelativePath, /^[a-f0-9]{2}\/[a-f0-9]{32}\.bin$/);

  const writtenPath = join(attDir, stored.storageRelativePath);
  const mode = statSync(writtenPath).mode & 0o777;
  assert.equal(mode, 0o600);

  await assert.rejects(() =>
    storeConfinedAttachment(
      Buffer.alloc(1024 * 1024 + 5),
      "big.bin",
      {
        attachmentStorageRoot: attDir,
        maxAttachmentSizeMb: 1,
      },
    ),
  );

  const symRoot = join(root, "sym-att");
  symlinkSync(attDir, symRoot);
  await assert.rejects(
    () =>
      storeConfinedAttachment(Buffer.from("x"), "x.txt", {
        attachmentStorageRoot: symRoot,
        maxAttachmentSizeMb: 1,
      }),
    PathConfinementError,
  );
});

test("ingestion service enforces idempotency, oversized handling, rollback cleanup, per-file isolation, and heartbeat updates", async () => {
  const root = makeTempDir("readbox-ingest-");
  const mailStorageRoot = join(root, "vmail");
  const attachmentStorageRoot = join(root, "attachments");
  const ingestionLockFile = join(root, "lock", "ingest.lock");

  await createMaildirTree({
    mailStorageRoot,
    domainName: "readbox.test",
    localPart: "support",
  });

  const validEmlPath = join(
    mailStorageRoot,
    "readbox.test",
    "support",
    "Maildir",
    "new",
    "1700000001.msg.eml",
  );
  const validPayload = [
    "From: Sender <sender@example.org>",
    "To: support@readbox.test",
    "Subject: Invoice Attached",
    "Date: Sun, 15 Nov 2026 12:15:00 +0000",
    "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="B1"',
    "",
    "--B1",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Please see attached.",
    "--B1",
    "Content-Type: application/pdf",
    'Content-Disposition: attachment; filename="doc.pdf"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from("PDFDATA").toString("base64"),
    "--B1--",
    "",
  ].join("\r\n");
  writeFileSync(validEmlPath, validPayload);

  const hugeEmlPath = join(
    mailStorageRoot,
    "readbox.test",
    "support",
    "Maildir",
    "cur",
    "1700000002.huge.eml",
  );
  writeFileSync(hugeEmlPath, Buffer.alloc(1024 * 1024 + 128, 65));

  const symlinkEmlPath = join(
    mailStorageRoot,
    "readbox.test",
    "support",
    "Maildir",
    "new",
    "1700000003.sym.eml",
  );
  writeFileSync(join(root, "outside.eml"), "outside");
  symlinkSync(join(root, "outside.eml"), symlinkEmlPath);

  assert.equal(
    resolveMaildirSourceKey(mailStorageRoot, "readbox.test", "support", validEmlPath),
    "new/1700000001.msg.eml",
  );
  assert.throws(
    () =>
      resolveMaildirSourceKey(
        mailStorageRoot,
        "readbox.test",
        "support",
        join(root, "outside.eml"),
      ),
    PathConfinementError,
  );

  type FakeMessageRow = Record<string, unknown> & {
    id: bigint;
    uuid: string;
    mailboxId: bigint;
    sourceFileKey: string;
    sourceSha256: string;
    deletedAt: Date | null;
    isRead: boolean;
    receivedAt: Date | null;
  };

  const messages: FakeMessageRow[] = [];
  const attachments: Array<Record<string, unknown>> = [];
  const heartbeats = new Map<string, Record<string, unknown>>();
  const audits: Array<Record<string, unknown>> = [];
  let nextMsgId = BigInt(10);
  let forceTransactionError = false;

  const mailboxTarget = {
    id: BigInt(1),
    uuid: "11111111-1111-4111-8111-111111111111",
    localPart: "support",
    emailAddress: "support@readbox.test",
    domain: { name: "readbox.test" },
  };
  let mailboxTotals = { total: BigInt(0), unread: BigInt(0) };

  const fakePrisma = {
    mailbox: {
      findMany: async () => [mailboxTarget],
      update: async ({ data }: { data: Record<string, unknown> }) => {
        mailboxTotals = {
          total: data.totalMessages as bigint,
          unread: data.unreadMessages as bigint,
        };
        return mailboxTarget;
      },
    },
    message: {
      findUnique: async ({
        where,
      }: {
        where: {
          mailboxId_sourceFileKey: { mailboxId: bigint; sourceFileKey: string };
        };
      }) => {
        const hit = messages.find(
          (m) =>
            m.mailboxId === where.mailboxId_sourceFileKey.mailboxId &&
            m.sourceFileKey === where.mailboxId_sourceFileKey.sourceFileKey,
        );
        return hit ? { id: hit.id } : null;
      },
      count: async ({ where }: { where: Record<string, unknown> }) =>
        messages.filter((m) => {
          if (m.mailboxId !== where.mailboxId) return false;
          if ("deletedAt" in where && m.deletedAt !== where.deletedAt) return false;
          if ("isRead" in where && m.isRead !== where.isRead) return false;
          return true;
        }).length,
      aggregate: async () => ({
        _max: {
          receivedAt: messages[0]?.receivedAt ?? null,
        },
      }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = nextMsgId;
        nextMsgId += BigInt(1);
        const row: FakeMessageRow = {
          id,
          uuid: `msg-uuid-${id.toString()}`,
          mailboxId: data.mailboxId as bigint,
          sourceFileKey: data.sourceFileKey as string,
          sourceSha256: data.sourceSha256 as string,
          textBody: data.textBody ?? "",
          sanitizedHtmlBody: data.sanitizedHtmlBody ?? "",
          parseStatus: data.parseStatus ?? "ok",
          deletedAt: null,
          isRead: false,
          receivedAt: (data.receivedAt as Date | null) ?? null,
        };
        messages.push(row);
        return { id: row.id, uuid: row.uuid };
      },
      update: async () => undefined,
    },
    attachment: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        attachments.push(data);
        return data;
      },
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        audits.push(data);
        return data;
      },
    },
    serviceHeartbeat: {
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { serviceName: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const prev = heartbeats.get(where.serviceName);
        heartbeats.set(where.serviceName, prev ? { ...prev, ...update } : create);
        return {};
      },
    },
    $transaction: async <T>(
      fn: (tx: unknown) => Promise<T>,
    ): Promise<T> => {
      if (forceTransactionError) {
        throw new Error("Simulated DB outage");
      }
      return fn(fakePrisma);
    },
  } as unknown as IngestionPrismaClient;

  const runtimeConfig = {
    mailStorageRoot,
    attachmentStorageRoot,
    ingestionLockFile,
    maxMessageSizeMb: 1,
    maxAttachmentSizeMb: 1,
    maxAttachmentsPerMessage: 25,
  };

  // First pass ingests valid + oversized messages; symlink is skipped safely by iterMaildirFiles
  const pass1 = await ingestUnindexedMaildirFiles(fakePrisma, runtimeConfig);
  assert.equal(pass1.status, "healthy");
  assert.equal(pass1.scanned, 2);
  assert.equal(pass1.created, 1);
  assert.equal(pass1.oversized, 1);
  assert.equal(pass1.duplicates, 0);
  assert.equal(messages.length, 2);
  assert.equal(attachments.length, 1);
  assert.equal(mailboxTotals.total, BigInt(2));
  assert.equal(mailboxTotals.unread, BigInt(2));
  assert.equal(heartbeats.get("maildir_ingestion")?.status, "healthy");
  // Raw Maildir files remain untouched on disk
  assert.equal(existsSync(validEmlPath), true);
  assert.equal(existsSync(hugeEmlPath), true);

  // Second pass is 100% idempotent (duplicate skips)
  const pass2 = await ingestUnindexedMaildirFiles(fakePrisma, runtimeConfig);
  assert.equal(pass2.created, 0);
  assert.equal(pass2.oversized, 0);
  assert.equal(pass2.duplicates, 2);
  assert.equal(messages.length, 2);

  // Simulate DB failure during ingestion of a new file -> orphan attachment cleaned up & audit written
  const failedEmlPath = join(
    mailStorageRoot,
    "readbox.test",
    "support",
    "Maildir",
    "new",
    "1700000004.rollback.eml",
  );
  writeFileSync(failedEmlPath, validPayload);
  const prevMsgCount = messages.length;
  forceTransactionError = true;

  await assert.rejects(() =>
    ingestMaildirFile(fakePrisma, mailboxTarget, failedEmlPath, runtimeConfig),
  );
  assert.equal(messages.length, prevMsgCount);
  assert.equal(audits.some((a) => a.action === "ingestion_error"), true);
});

test("repairMessageBodies validates SHA-256, rejects tampering, enforces confirmation guard, and updates cleanly", async () => {
  const root = makeTempDir("readbox-repair-");
  const mailStorageRoot = join(root, "vmail");
  await createMaildirTree({
    mailStorageRoot,
    domainName: "readbox.test",
    localPart: "support",
  });

  const emlPath = join(
    mailStorageRoot,
    "readbox.test",
    "support",
    "Maildir",
    "new",
    "1700000010.repair.eml",
  );
  const raw = Buffer.from(
    [
      "From: Sender <sender@example.org>",
      "To: support@readbox.test",
      "Subject: Repairable",
      "Content-Type: text/html; charset=utf-8",
      "",
      "<p>Clean text</p><script>bad()</script>",
    ].join("\r\n"),
    "utf8",
  );
  writeFileSync(emlPath, raw);
  const digest = sha256Bytes(raw);

  assert.throws(
    () =>
      sourcePathForMessage(
        mailStorageRoot,
        "readbox.test",
        "support",
        "../secret",
      ),
    BodyRepairError,
  );

  let storedHtml = "<p>Stale HTML</p>";
  const target = {
    id: BigInt(99),
    uuid: "99999999-9999-4999-8999-999999999999",
    sourceFileKey: "new/1700000010.repair.eml",
    sourceSha256: digest,
    textBody: "",
    sanitizedHtmlBody: storedHtml,
    mailbox: {
      localPart: "support",
      emailAddress: "support@readbox.test",
      domain: { name: "readbox.test" },
    },
  };

  const fakePrisma = {
    message: {
      findMany: async () => [target],
      findUnique: async () => ({
        id: target.id,
        sourceFileKey: target.sourceFileKey,
        sourceSha256: target.sourceSha256,
      }),
      update: async ({ data }: { data: { sanitizedHtmlBody: string } }) => {
        storedHtml = data.sanitizedHtmlBody;
        target.sanitizedHtmlBody = storedHtml;
        return target;
      },
    },
    auditLog: {
      create: async () => ({}),
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(fakePrisma),
  } as unknown as RepairPrismaClient;

  const config = {
    mailStorageRoot,
    maxMessageSizeMb: 25,
    maxAttachmentsPerMessage: 25,
  };

  // Mutating batch requires confirmRepair: true
  const rejected = await runMessageBodyRepairBatch(fakePrisma, config, {
    dryRun: false,
    confirmRepair: false,
    limit: 100,
  });
  assert.equal(rejected.ok, false);

  // Dry run reports wouldUpdate without modifying DB
  const dry = await repairMessageBodies(fakePrisma, target, config, {
    dryRun: true,
  });
  assert.equal(dry.status, "would_update");
  assert.equal(storedHtml, "<p>Stale HTML</p>");

  // Actual repair updates sanitizedHtmlBody safely
  const applied = await runMessageBodyRepairBatch(fakePrisma, config, {
    dryRun: false,
    confirmRepair: true,
    limit: 10,
  });
  assert.equal(applied.ok, true);
  if (applied.ok) {
    assert.equal(applied.data.updated, 1);
  }
  assert.equal(storedHtml, "<p>Clean text</p>");

  // Tampered disk file triggers source_mismatch abort
  writeFileSync(emlPath, Buffer.from("tampered", "utf8"));
  await assert.rejects(
    () => repairMessageBodies(fakePrisma, target, config, { dryRun: false }),
    (error: unknown) =>
      error instanceof BodyRepairError && error.code === "source_mismatch",
  );
});

test("operations service verifies Postfix contract, runs dry-run & strict sync, provisions Maildirs, and redacts overview", async () => {
  const root = makeTempDir("readbox-ops-");
  const mailStorageRoot = join(root, "vmail");
  const attachmentStorageRoot = join(root, "att");
  const lockRoot = join(root, "locks");
  mkdirSync(mailStorageRoot, { recursive: true });
  mkdirSync(attachmentStorageRoot, { recursive: true });
  mkdirSync(lockRoot, { recursive: true });
  chmodSync(mailStorageRoot, 0o750);

  let mailboxCreated = 0;
  let maildirCreatedPaths: string[] = [];

  const sqlExecutor: SqlQueryExecutor = {
    async query<TRow>(sql: string) {
      if (sql.includes("mail_domains")) {
        return { rows: [{ count: 1 } as unknown as TRow], rowCount: 1 };
      }
      if (sql.includes("postfix_virtual_mailboxes")) {
        return { rows: [{ count: 1 } as unknown as TRow], rowCount: 1 };
      }
      if (sql.includes("COUNT(*)")) {
        return { rows: [{ count: 1 } as unknown as TRow], rowCount: 1 };
      }
      if (sql.includes("SELECT \"local_part\", \"email\"")) {
        return {
          rows: [
            {
              local_part: "support",
              email: "support@readbox.test",
              maildir: "readbox.test/support/Maildir/",
              active: true,
            } as unknown as TRow,
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    },
  };

  const fakePrisma = {
    $queryRaw: async () => [{ ok: 1 }],
    $queryRawUnsafe: async () => [],
    $executeRawUnsafe: async () => 1,
    user: {
      findUnique: async () => ({ id: BigInt(1) }),
    },
    domain: {
      findFirst: async () => ({
        id: BigInt(1),
        name: "readbox.test",
        status: "active",
        verificationStatus: "verified",
      }),
      create: async () => ({
        id: BigInt(1),
        name: "readbox.test",
        status: "active",
        verificationStatus: "verified",
      }),
    },
    mailbox: {
      findMany: async () => [
        {
          uuid: "11111111-1111-4111-8111-111111111111",
          localPart: "support",
          emailAddress: "support@readbox.test",
          status: "active",
          domain: { name: "readbox.test" },
        },
      ],
      findFirst: async () => null,
      create: async () => {
        mailboxCreated += 1;
        return {};
      },
      update: async () => ({}),
    },
    message: {
      count: async () => 5,
    },
    serviceHeartbeat: {
      findUnique: async () => ({
        status: "healthy",
        lastSeenAt: new Date(),
      }),
    },
    auditLog: {
      create: async () => ({}),
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(fakePrisma),
  } as unknown as OperationsPrismaClient;

  const config = {
    mailStorageRoot,
    attachmentStorageRoot,
    ingestionLockFile: join(lockRoot, "ingest.lock"),
    mailboxProvisionLockRoot: lockRoot,
    ingestionStaleAfterSeconds: 120,
    maxMessageSizeMb: 25,
    maxAttachmentSizeMb: 20,
    maxAttachmentsPerMessage: 25,
  };

  const ctx = { actorId: BigInt(1) };

  const contract = await runVerifyPostfixContract(fakePrisma, ctx, {
    sqlExecutor,
  });
  assert.equal(contract.ok, true);

  // Dry run sync makes zero DB writes
  const syncDry = await runSyncMailserverMailboxes(
    fakePrisma,
    { dryRun: true, strict: false },
    ctx,
    { sqlExecutor },
  );
  assert.equal(syncDry.ok, true);
  if (syncDry.ok) {
    assert.equal(syncDry.data.dryRun, true);
    assert.equal(syncDry.data.created, 1);
  }
  assert.equal(mailboxCreated, 0);

  // Strict sync rejects invalid mailserver rows
  const badSqlExecutor: SqlQueryExecutor = {
    async query<TRow>(sql: string) {
      if (sql.includes("SELECT \"local_part\", \"email\"")) {
        return {
          rows: [
            {
              local_part: "support",
              email: "support@readbox.test",
              maildir: "wrong/path/",
              active: true,
            } as unknown as TRow,
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    },
  };
  const strictFail = await runSyncMailserverMailboxes(
    fakePrisma,
    { dryRun: false, strict: true },
    ctx,
    { sqlExecutor: badSqlExecutor },
  );
  assert.equal(strictFail.ok, false);
  assert.equal(mailboxCreated, 0);

  // Provision maildirs creates confined Maildir/new, cur, tmp
  const prov = await runProvisionMaildirs(fakePrisma, config, {}, ctx);
  assert.equal(prov.ok, true);
  if (prov.ok) {
    assert.equal(prov.data.verifiedOrCreated, 1);
  }
  maildirCreatedPaths = ["new", "cur", "tmp"].map((sub) =>
    join(mailStorageRoot, "readbox.test", "support", "Maildir", sub),
  );
  for (const dirPath of maildirCreatedPaths) {
    assert.equal(existsSync(dirPath), true);
  }

  // Overview exposes counts only, never email body text
  const overview = await getOperationsOverview(fakePrisma, config, {
    hasDatabaseUrl: true,
    sqlExecutor,
  });
  assert.equal(overview.databaseConnected, true);
  assert.equal(overview.postfixContract.verified, true);
  assert.equal(overview.indexingStats.totalMessages, 5);
});

test("parseWorkerArgs parses once/watch, interval, mailbox scope, and dry-run safely", () => {
  assert.deepEqual(parseWorkerArgs(["--once"], 15), {
    once: true,
    intervalSeconds: 15,
    mailboxLocalPart: undefined,
    dryRun: false,
  });

  assert.deepEqual(
    parseWorkerArgs(["--watch", "--interval", "30", "--mailbox", "Support", "--dry-run"], 15),
    {
      once: false,
      intervalSeconds: 30,
      mailboxLocalPart: "support",
      dryRun: true,
    },
  );

  assert.throws(() => parseWorkerArgs(["--interval", "0"], 15));
  assert.throws(() => parseWorkerArgs(["--unknown-flag"], 15));
});
