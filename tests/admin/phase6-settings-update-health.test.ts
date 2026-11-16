import { parseEnvironment } from "@/config/env-schema";
import {
  listUsersControlSnapshot,
  updateUserControlSettings,
  updateUserExtendedPolicy,
} from "@/core/accounts/user-control-policy";
import {
  checkConfigurationReadiness,
  checkWritableStorageDirectory,
  getReadinessSnapshot,
} from "@/core/health/snapshot";
import {
  formatPublicSiteSettingsJson,
  getSiteSettings,
  MAX_FAVICON_SIZE_BYTES,
  MAX_LOGO_SIZE_BYTES,
  readConfinedSiteMedia,
  resetDevFallbackSiteSettings,
  resolvePublicSiteCorsHeaders,
  updateSiteSettings,
  validateSiteAssetUpload,
  type SiteSettingsPrismaLike,
  type SiteSettingsRecord,
} from "@/core/settings/service";
import {
  checkLatestRelease,
  isOfficialReleaseUrl,
  queueUpdateRequest,
  readUpdateStatus,
  runUpdatePreflight,
} from "@/core/updates/service";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

function createMockSiteSettingsPrisma() {
  let stored: SiteSettingsRecord | null = null;
  const audits: Array<{
    action: string;
    targetType: string;
    targetIdentifier: string;
    details: unknown;
  }> = [];

  const prisma: SiteSettingsPrismaLike = {
    siteSettings: {
      async findFirst() {
        return stored;
      },
      async upsert({ create, update }) {
        if (!stored) {
          stored = {
            id: BigInt(1),
            ...create,
            updatedAt: new Date("2026-11-15T12:00:00.000Z"),
          };
        } else {
          stored = {
            ...stored,
            ...update,
            updatedAt: new Date("2026-11-15T12:05:00.000Z"),
          };
        }
        return stored;
      },
    },
    auditLog: {
      async create({ data }) {
        audits.push({
          action: data.action,
          targetType: data.targetType ?? "",
          targetIdentifier: data.targetIdentifier ?? "",
          details: data.details,
        });
        return { id: BigInt(audits.length) };
      },
    },
  };

  return { prisma, audits, getStored: () => stored };
}

test("SiteSettings upload validation enforces size limits, MIME/extension match, and SVG script rejection", () => {
  const validPngLogo = validateSiteAssetUpload(
    {
      filename: "brand-logo.png",
      contentType: "image/png",
      sizeBytes: 1024,
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    },
    "logo",
  );
  assert.equal(validPngLogo.ok, true);

  const oversizedLogo = validateSiteAssetUpload(
    {
      filename: "huge.png",
      contentType: "image/png",
      sizeBytes: MAX_LOGO_SIZE_BYTES + 1,
      buffer: Buffer.alloc(16),
    },
    "logo",
  );
  assert.equal(oversizedLogo.ok, false);
  if (!oversizedLogo.ok) {
    assert.match(oversizedLogo.error, /5 MB/);
  }

  const oversizedFavicon = validateSiteAssetUpload(
    {
      filename: "huge.ico",
      contentType: "image/x-icon",
      sizeBytes: MAX_FAVICON_SIZE_BYTES + 1,
      buffer: Buffer.alloc(16),
    },
    "favicon",
  );
  assert.equal(oversizedFavicon.ok, false);
  if (!oversizedFavicon.ok) {
    assert.match(oversizedFavicon.error, /512 KB/);
  }

  const mismatchedExt = validateSiteAssetUpload(
    {
      filename: "logo.exe",
      contentType: "image/png",
      sizeBytes: 64,
      buffer: Buffer.alloc(64),
    },
    "logo",
  );
  assert.equal(mismatchedExt.ok, false);

  const unsafeSvg = validateSiteAssetUpload(
    {
      filename: "xss.svg",
      contentType: "image/svg+xml",
      sizeBytes: 120,
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      ),
    },
    "logo",
  );
  assert.equal(unsafeSvg.ok, false);
});

test("SiteSettings service persists singleton settings, confined media files, and public CORS headers", async () => {
  resetDevFallbackSiteSettings();
  const tempMediaRoot = await mkdtemp(join(tmpdir(), "readbox-media-test-"));

  try {
    const { prisma, audits } = createMockSiteSettingsPrisma();
    const initial = await getSiteSettings({
      prisma,
      baseOrigin: "https://app.mailstack.local",
    });
    assert.equal(initial.siteName, "ReadBox");
    assert.equal(initial.databaseConnected, true);

    const badPrivacyResult = await updateSiteSettings(
      {
        siteName: "ReadBox HQ",
        privacyUrl: "javascript:alert(1)",
      },
      { prisma, mediaRoot: tempMediaRoot },
    );
    assert.equal(badPrivacyResult.ok, false);

    const svgBuffer = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16"/></svg>',
      "utf8",
    );
    const icoBuffer = Buffer.from([0x00, 0x00, 0x01, 0x00]);

    const updated = await updateSiteSettings(
      {
        siteName: "ReadBox Enterprise",
        siteTagline: "PostgreSQL-backed team inbox",
        supportEmail: "ops@example.com",
        contactPhone: "+1 555 0199",
        officeAddress: "100 Mail Way",
        footerDescription: "Internal mail portal",
        copyrightText: "2026 ReadBox",
        sourceCodeUrl: "https://github.com/vibtools/ReadBox",
        privacyUrl: "/privacy-policy",
        logoUpload: {
          filename: "logo.svg",
          contentType: "image/svg+xml",
          sizeBytes: svgBuffer.byteLength,
          buffer: svgBuffer,
        },
        faviconUpload: {
          filename: "favicon.ico",
          contentType: "image/x-icon",
          sizeBytes: icoBuffer.byteLength,
          buffer: icoBuffer,
        },
      },
      {
        prisma,
        mediaRoot: tempMediaRoot,
        actorId: BigInt(7),
      },
    );

    assert.equal(updated.ok, true);
    if (!updated.ok) return;

    assert.equal(updated.settings.siteName, "ReadBox Enterprise");
    assert.match(updated.settings.logoPath, /^site-settings\/logo-[0-9a-f]+\.svg$/);
    assert.match(
      updated.settings.faviconPath,
      /^site-settings\/favicon-[0-9a-f]+\.ico$/,
    );
    assert.equal(audits.length, 1);
    assert.equal(audits[0]!.action, "site_settings_updated");

    const servedLogo = await readConfinedSiteMedia(
      updated.settings.logoPath.split("/"),
      { mediaRoot: tempMediaRoot },
    );
    assert.ok(servedLogo);
    assert.equal(servedLogo.contentType, "image/svg+xml");
    assert.equal(servedLogo.buffer.toString("utf8"), svgBuffer.toString("utf8"));

    // Path traversal & symlink escape must return null
    const traversal = await readConfinedSiteMedia(
      ["site-settings", "../outside.svg"],
      { mediaRoot: tempMediaRoot },
    );
    assert.equal(traversal, null);

    const symlinkTarget = join(tempMediaRoot, "secret.png");
    await writeFile(symlinkTarget, "secret");
    const symlinkPath = join(tempMediaRoot, "site-settings", "link.png");
    await symlink(symlinkTarget, symlinkPath);
    const symlinkRead = await readConfinedSiteMedia(
      ["site-settings", "link.png"],
      { mediaRoot: tempMediaRoot },
    );
    assert.equal(symlinkRead, null);

    // Public JSON & strict CORS matching
    const jsonPayload = formatPublicSiteSettingsJson(updated.settings);
    assert.equal(jsonPayload.site_name, "ReadBox Enterprise");
    assert.equal(jsonPayload.support_email, "ops@example.com");

    assert.deepEqual(
      resolvePublicSiteCorsHeaders(
        "https://mailstack.example/",
        "https://mailstack.example",
      ),
      {
        "Access-Control-Allow-Origin": "https://mailstack.example",
        Vary: "Origin",
      },
    );
    assert.deepEqual(
      resolvePublicSiteCorsHeaders(
        "https://evil.example",
        "https://mailstack.example",
      ),
      {},
    );
  } finally {
    await rm(tempMediaRoot, { recursive: true, force: true });
  }
});

test("System Update validates official GitHub release URLs, checks release assets, and writes 0640 hard-linked update_request.json", async () => {
  assert.equal(
    isOfficialReleaseUrl(
      "https://github.com/vibtools/ReadBox/releases/download/v1.3.5.5/readbox-1.3.5.5-source.zip",
      "vibtools/ReadBox",
    ),
    true,
  );
  assert.equal(
    isOfficialReleaseUrl(
      "https://github.com/vibtools/ReadBox/releases/download/v1.3.5.5/readbox-1.3.5.5-source.zip?token=1",
      "vibtools/ReadBox",
    ),
    false,
  );
  assert.equal(
    isOfficialReleaseUrl(
      "https://github.com/other/repo/releases/download/v1.0.0/source.zip",
      "vibtools/ReadBox",
    ),
    false,
  );
  assert.equal(
    isOfficialReleaseUrl(
      "http://github.com/vibtools/ReadBox/releases/download/v1.0.0/source.zip",
      "vibtools/ReadBox",
    ),
    false,
  );

  // Mock fetch for checkLatestRelease
  const releaseRes = await checkLatestRelease({
    githubRepo: "vibtools/ReadBox",
    fetchImpl: (async () =>
      new Response(
        JSON.stringify({
          tag_name: "v1.4.0",
          draft: false,
          prerelease: false,
          body: "Signed production update",
          published_at: "2026-11-15T00:00:00Z",
          assets: [
            {
              name: "readbox-1.4.0-source.zip",
              browser_download_url:
                "https://github.com/vibtools/ReadBox/releases/download/v1.4.0/readbox-1.4.0-source.zip",
            },
            {
              name: "readbox-1.4.0-source.zip.sha256",
              browser_download_url:
                "https://github.com/vibtools/ReadBox/releases/download/v1.4.0/readbox-1.4.0-source.zip.sha256",
            },
          ],
        }),
        { status: 200 },
      )) as unknown as typeof fetch,
  });

  assert.equal(releaseRes.ok, true);
  if (releaseRes.ok) {
    assert.equal(releaseRes.latest_version, "1.4.0");
  }

  // Queue update request handoff
  const tempRuntimeDir = await mkdtemp(join(tmpdir(), "readbox-update-test-"));
  try {
    const { prisma, audits } = createMockSiteSettingsPrisma();

    // Rejects untrusted URL with 400
    const badUrl = await queueUpdateRequest(
      {
        archiveUrl: "https://evil.example/payload.zip",
        checksumUrl: "https://evil.example/payload.zip.sha256",
      },
      { runtimeDir: tempRuntimeDir },
    );
    assert.equal(badUrl.ok, false);
    if (!badUrl.ok) {
      assert.equal(badUrl.status, 400);
    }

    // Rejects blocked preflight with 503
    const blockedRes = await queueUpdateRequest(
      {
        archiveUrl:
          "https://github.com/vibtools/ReadBox/releases/download/v1.4.0/readbox-1.4.0-source.zip",
        checksumUrl:
          "https://github.com/vibtools/ReadBox/releases/download/v1.4.0/readbox-1.4.0-source.zip.sha256",
      },
      {
        runtimeDir: tempRuntimeDir,
        preflightOverride: async () => ({
          status: "blocked",
          checks: [{ name: "runtime directory", passed: false, detail: "/run/vibmail" }],
          message: "Blocked",
        }),
      },
    );
    assert.equal(blockedRes.ok, false);
    if (!blockedRes.ok) {
      assert.equal(blockedRes.status, 503);
    }

    // Succeeds when preflight is ready and writes 0640 hard-linked update_request.json
    const startedRes = await queueUpdateRequest(
      {
        archiveUrl:
          "https://github.com/vibtools/ReadBox/releases/download/v1.4.0/readbox-1.4.0-source.zip",
        checksumUrl:
          "https://github.com/vibtools/ReadBox/releases/download/v1.4.0/readbox-1.4.0-source.zip.sha256",
      },
      {
        runtimeDir: tempRuntimeDir,
        prisma,
        actorId: BigInt(1),
        preflightOverride: async () => ({
          status: "ready",
          checks: [{ name: "runtime directory", passed: true, detail: tempRuntimeDir }],
          message: "Updater is ready.",
        }),
      },
    );
    assert.equal(startedRes.ok, true);

    const requestFile = join(tempRuntimeDir, "update_request.json");
    assert.equal(existsSync(requestFile), true);
    const st = statSync(requestFile);
    assert.equal(st.mode & 0o777, 0o640);
    const parsedRequest = JSON.parse(readFileSync(requestFile, "utf8")) as Record<
      string,
      unknown
    >;
    assert.deepEqual(Object.keys(parsedRequest).sort(), [
      "archive_url",
      "checksum_url",
      "confirm_upgrade",
    ]);
    assert.equal(parsedRequest.confirm_upgrade, true);
    assert.equal(audits.length, 1);
    assert.equal(audits[0]!.action, "system_update_requested");

    // Second queue attempt while update_request.json exists returns 409 Conflict
    const duplicateRes = await queueUpdateRequest(
      {
        archiveUrl:
          "https://github.com/vibtools/ReadBox/releases/download/v1.4.0/readbox-1.4.0-source.zip",
        checksumUrl:
          "https://github.com/vibtools/ReadBox/releases/download/v1.4.0/readbox-1.4.0-source.zip.sha256",
      },
      {
        runtimeDir: tempRuntimeDir,
        preflightOverride: async () => ({
          status: "ready",
          checks: [],
          message: "Updater is ready.",
        }),
      },
    );
    assert.equal(duplicateRes.ok, false);
    if (!duplicateRes.ok) {
      assert.equal(duplicateRes.status, 409);
    }

    // Status reader reads update_status.json
    const idleStatus = await readUpdateStatus({ runtimeDir: tempRuntimeDir });
    assert.equal(idleStatus.step, "idle");

    await writeFile(
      join(tempRuntimeDir, "update_status.json"),
      JSON.stringify({ step: "backup", message: "Backing up DB", progress: 30 }),
    );
    const activeStatus = await readUpdateStatus({ runtimeDir: tempRuntimeDir });
    assert.equal(activeStatus.step, "backup");
    assert.equal(activeStatus.progress, 30);

    // Preflight runner returns 9-category checks
    const preflightReport = await runUpdatePreflight({
      runtimeDir: tempRuntimeDir,
    });
    assert.equal(Array.isArray(preflightReport.checks), true);
    assert.equal(preflightReport.checks.length >= 9, true);
  } finally {
    await rm(tempRuntimeDir, { recursive: true, force: true });
  }
});

test("Health readiness snapshot and PostgreSQL VPS templates verify production invariants", async () => {
  const tempMailRoot = await mkdtemp(join(tmpdir(), "readbox-mail-ready-"));
  const tempAttRoot = await mkdtemp(join(tmpdir(), "readbox-att-ready-"));

  try {
    const mailDirCheck = await checkWritableStorageDirectory(tempMailRoot);
    assert.equal(mailDirCheck.ok, true);

    const runtimeEnv = parseEnvironment({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://readbox:secret@127.0.0.1:5432/readbox",
      AUTH_ENABLED: "true",
      AUTH_SECRET: "0123456789abcdef0123456789abcdef0123456789abcdef",
      MAIL_DOMAIN: "mail.example.com",
      MAIL_HOSTNAME: "mx.example.com",
      APP_HOSTNAME: "app.example.com",
      SERVER_IP: "203.0.113.10",
      MAIL_STORAGE_ROOT: tempMailRoot,
      ATTACHMENT_STORAGE_ROOT: tempAttRoot,
    });

    assert.equal(checkConfigurationReadiness(runtimeEnv).ok, true);

    const now = new Date("2026-11-15T12:00:00.000Z");
    const readySnapshot = await getReadinessSnapshot({
      runtimeEnv,
      now,
      prisma: {
        async $queryRaw(strings) {
          const sql = strings.join(" ");
          if (sql.includes("_prisma_migrations")) {
            return [{ pending_count: BigInt(0) }] as unknown as never;
          }
          return [{ "?column?": 1 }] as unknown as never;
        },
        serviceHeartbeat: {
          async findUnique() {
            return {
              status: "healthy",
              lastSeenAt: new Date("2026-11-15T11:59:30.000Z"),
            };
          },
        },
      },
    });

    assert.equal(readySnapshot.status, "ready");
    assert.equal(readySnapshot.checks.database.ok, true);
    assert.equal(readySnapshot.checks.migrations.ok, true);
    assert.equal(readySnapshot.checks.mailStorage.ok, true);
    assert.equal(readySnapshot.checks.attachmentStorage.ok, true);
    assert.equal(readySnapshot.checks.mailServices.connected, true);

    // Pending migration makes snapshot not_ready
    const pendingMigSnapshot = await getReadinessSnapshot({
      runtimeEnv,
      now,
      prisma: {
        async $queryRaw(strings) {
          const sql = strings.join(" ");
          if (sql.includes("_prisma_migrations")) {
            return [{ pending_count: BigInt(1) }] as unknown as never;
          }
          return [{ "?column?": 1 }] as unknown as never;
        },
      },
    });
    assert.equal(pendingMigSnapshot.status, "not_ready");
    assert.equal(pendingMigSnapshot.checks.migrations.ok, false);

    // Verify Postfix pgsql templates, Nginx loopback health restriction, and PostgreSQL backup/restore scripts
    const domainsTpl = readFileSync(
      resolve(process.cwd(), "deployment/templates/postfix/pgsql-virtual-domains.cf.tpl"),
      "utf8",
    );
    const mailboxesTpl = readFileSync(
      resolve(process.cwd(), "deployment/templates/postfix/pgsql-virtual-mailboxes.cf.tpl"),
      "utf8",
    );
    const aliasesTpl = readFileSync(
      resolve(process.cwd(), "deployment/templates/postfix/pgsql-virtual-aliases.cf.tpl"),
      "utf8",
    );
    assert.match(domainsTpl, /mailserver\.postfix_virtual_domains/);
    assert.match(mailboxesTpl, /mailserver\.postfix_virtual_mailboxes/);
    assert.match(aliasesTpl, /mailserver\.postfix_virtual_aliases/);

    const nginxTpl = readFileSync(
      resolve(process.cwd(), "deployment/templates/nginx/app.conf.tpl"),
      "utf8",
    );
    assert.match(nginxTpl, /location = \/health\/ready/);
    assert.match(nginxTpl, /allow 127\.0\.0\.1;/);
    assert.match(nginxTpl, /deny all;/);
    assert.match(nginxTpl, /location \/_protected_attachments\//);

    const backupScript = readFileSync(
      resolve(process.cwd(), "scripts/ops/backup.sh"),
      "utf8",
    );
    const restoreScript = readFileSync(
      resolve(process.cwd(), "scripts/ops/restore.sh"),
      "utf8",
    );
    assert.match(backupScript, /pg_dump/);
    assert.doesNotMatch(backupScript, /mariadb-dump|mysqldump/);
    assert.match(restoreScript, /psql/);
    assert.match(restoreScript, /validate_tar_archive/);
  } finally {
    await rm(tempMailRoot, { recursive: true, force: true });
    await rm(tempAttRoot, { recursive: true, force: true });
  }
});

test("Phase 03 BUG-05 & BUG-06: updateUserControlSettings, updateUserExtendedPolicy, and updateSiteSettings fail-closed on DB errors and listUsersControlSnapshot does not inject fake demo domains into connected DB", async () => {
  // BUG-05: updateUserControlSettings fails closed when DB write throws
  const failingControlPrisma = {
    userControlSettings: {
      async findFirst() {
        throw new Error("PostgreSQL connection refused");
      },
      async update() {
        throw new Error("PostgreSQL connection refused");
      },
      async create() {
        throw new Error("PostgreSQL connection refused");
      },
    },
  };
  const controlRes = await updateUserControlSettings(
    failingControlPrisma as never,
    { signupEnabled: false },
  );
  assert.equal(controlRes.ok, false);
  if (!controlRes.ok) {
    assert.match(controlRes.error, /Could not save user control policy/i);
  }

  // BUG-05: updateUserExtendedPolicy fails closed when DB upsert throws
  const failingPolicyPrisma = {
    userAccessPolicy: {
      async upsert() {
        throw new Error("PostgreSQL write error");
      },
    },
  };
  const policyRes = await updateUserExtendedPolicy(
    failingPolicyPrisma as never,
    "10",
    { canCreateMailboxes: false, maxMailboxes: 2 },
  );
  assert.equal(policyRes.ok, false);
  if (!policyRes.ok) {
    assert.match(policyRes.error, /Could not save user access policy/i);
  }

  // BUG-05: listUsersControlSnapshot returns empty domains array when DB is connected and 0 verified domains exist
  const emptyDomainsPrisma = {
    userControlSettings: {
      async findFirst() {
        return null;
      },
    },
    domain: {
      async findMany() {
        return [];
      },
    },
    user: {
      async findMany() {
        return [];
      },
    },
  };
  const connectedSnapshot = await listUsersControlSnapshot(
    emptyDomainsPrisma as never,
  );
  assert.equal(connectedSnapshot.databaseConnected, true);
  assert.equal(connectedSnapshot.domains.length, 0);

  // Demo fallback snapshot computes accurate demo mailbox count (4)
  const demoSnapshot = await listUsersControlSnapshot(null);
  assert.equal(demoSnapshot.databaseConnected, false);
  const demoUserItem = demoSnapshot.governedUsers.find(
    (u) => u.username === "demo.user",
  );
  assert.ok(demoUserItem);
  assert.equal(demoUserItem.mailboxCount, 4);

  // BUG-06: updateSiteSettings fails closed when Prisma client upsert fails (regardless of NODE_ENV)
  const failingSitePrisma: SiteSettingsPrismaLike = {
    siteSettings: {
      async findFirst() {
        return null;
      },
      async upsert() {
        throw new Error("PostgreSQL disk full");
      },
    },
    auditLog: {
      async create() {
        return { id: BigInt(1) };
      },
    },
  };
  const siteRes = await updateSiteSettings(
    { siteName: "ReadBox Fail-Closed Test" },
    { prisma: failingSitePrisma },
  );
  assert.equal(siteRes.ok, false);
});
