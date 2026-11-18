import {
  verifyMailserverMigrationParity,
  MailServerContractError,
  type SqlQueryExecutor,
} from "@/core/mailserver/pg-adapter";
import {
  createMaildirTree,
  resolveMaildirDeliveryIdentity,
  ProvisioningError,
} from "@/core/mailboxes/provisioning";
import assert from "node:assert/strict";
import { lstatSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("R02 parity rejects missing, incomplete or malformed Prisma migrations", async () => {
  const expected = ["20261017000000_initial_application_schema", "20261117010000_postfix_login_identity"];
  const queryable = (rows: readonly unknown[]): SqlQueryExecutor =>
    ({
      async query() {
        return { rows, rowCount: rows.length };
      },
    }) as SqlQueryExecutor;
  const present = [
    { migration_name: expected[0], finished_at: new Date(), rolled_back_at: null },
    { migration_name: expected[1], finished_at: new Date(), rolled_back_at: null },
  ];
  assert.deepEqual(await verifyMailserverMigrationParity(queryable(present), expected), {
    ok: true, missing: [], unfinished: [],
  });
  assert.deepEqual(await verifyMailserverMigrationParity(queryable(present.slice(0, 1)), expected), {
    ok: false, missing: [expected[1]], unfinished: [],
  });
  assert.deepEqual(await verifyMailserverMigrationParity(queryable([
    present[0], { migration_name: expected[1], finished_at: null, rolled_back_at: null },
  ]), expected), { ok: false, missing: [expected[1]], unfinished: [expected[1]] });
  await assert.rejects(
    () => verifyMailserverMigrationParity(queryable(present), ["../escape"]),
    MailServerContractError,
  );
});

test("R02 Maildir numeric delivery identity matches owner and rejects wrong UID/GID", () => {
  assert.deepEqual(resolveMaildirDeliveryIdentity(
    { MAILDIR_UID: "1001", MAILDIR_GID: "1001" },
    1001, 1001,
  ), { uid: 1001, gid: 1001 });
  assert.throws(
    () => resolveMaildirDeliveryIdentity({ MAILDIR_UID: "1002", MAILDIR_GID: "1001" }, 1001, 1001),
    ProvisioningError,
  );
  assert.throws(
    () => resolveMaildirDeliveryIdentity({ MAILDIR_UID: "1001", MAILDIR_GID: "0" }, 1001, 1001),
    ProvisioningError,
  );
});

test("R02 Maildir creation respects strict 0700 modes, process ownership and fails safely", async () => {
  const root = mkdtempSync(join(tmpdir(), "readbox-r02-maildir-"));
  const savedUid = process.env.MAILDIR_UID;
  try {
    delete process.env.MAILDIR_UID;
    const result = await createMaildirTree({
      mailStorageRoot: root, domainName: "r02.example", localPart: "support",
    });
    const check = [result.maildirPath, ...["new", "cur", "tmp"].map((dir) => join(result.maildirPath, dir))];
    for (const pathname of check) {
      const stat = lstatSync(pathname);
      assert.equal(stat.mode & 0o777, 0o700);
      if (process.getuid) assert.equal(stat.uid, process.getuid());
      if (process.getgid) assert.equal(stat.gid, process.getgid());
    }
    if (process.getuid) {
      process.env.MAILDIR_UID = String(process.getuid() + 1);
      await assert.rejects(
        createMaildirTree({
          mailStorageRoot: root, domainName: "r02.example", localPart: "wrongowner",
        }),
        ProvisioningError,
      );
      assert.throws(() => lstatSync(join(root, "r02.example", "wrongowner")));
    }
  } finally {
    if (savedUid === undefined) delete process.env.MAILDIR_UID;
    else process.env.MAILDIR_UID = savedUid;
    rmSync(root, { recursive: true, force: true });
  }
});
