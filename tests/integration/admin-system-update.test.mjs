import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  checkLatestRelease, queueUpdateRequest, readUpdateStatus,
  runUpdatePreflight,
} from "../../src/core/updates/service.ts";

const SAME_SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);

function refsFetch(source, mirror, backup = mirror, releaseStatus = 404, unavailable = "") {
  return async (url) => {
    if (url.includes("/git/ref/heads/")) {
      const expected = url.includes("vibtoolshq/ReadBox")
        ? "/git/ref/heads/main"
        : "/git/ref/heads/backup/dns-final-primary-20261119";
      assert.ok(url.endsWith(expected), "Must not consult backup repository main");
      if (unavailable && url.includes(unavailable)) return { ok: false, status: 403 };
      const sha = url.includes("JILLU-Games") ? mirror
        : url.includes("MdNurnobi-Dev") ? backup : source;
      return { ok: true, status: 200, json: async () => ({ object: { sha } }) };
    }
    if (url.endsWith("/releases/latest")) {
      if (releaseStatus === 200) {
        return { ok: true, status: 200,
          json: async () => ({ tag_name: "v1.2.3", draft: false, prerelease: false }) };
      }
      return { ok: false, status: 404 };
    }
    throw new Error("Unexpected URL: " + url);
  };
}

test("AU01 Docker source discovery verifies matching official main refs without claiming a stable release", async () => {
  const out = await checkLatestRelease({
    containerRuntime: true, fetchImpl: refsFetch(SAME_SHA, SAME_SHA),
  });
  assert.equal(out.ok, true);
  if (!out.ok) return;
  assert.equal(out.mode, "source");
  assert.equal(out.target_sha, SAME_SHA);
  assert.equal(out.latest_version, SAME_SHA.slice(0, 12));
  assert.equal(out.archive_url, "");
  assert.equal(out.checksum_url, "");
  assert.match(out.release_notes, /NOT a stable release/);
});

test("AU01 Docker source channel keeps stable release discovery informational", async () => {
  const out = await checkLatestRelease({
    containerRuntime: true, fetchImpl: refsFetch(SAME_SHA, SAME_SHA, SAME_SHA, 200),
  });
  assert.equal(out.ok, true);
  if (!out.ok) return;
  assert.equal(out.mode, "source");
  assert.match(out.release_notes, /Stable release detected: v1\.2\.3/);
  assert.equal(out.target_sha, SAME_SHA);
});

test("AU01 each independently mismatched or invalid backup refuses an update", async () => {
  for (const fixtures of [
    [SAME_SHA, OTHER_SHA, SAME_SHA],
    [SAME_SHA, SAME_SHA, OTHER_SHA],
    [OTHER_SHA, SAME_SHA, SAME_SHA],
    [SAME_SHA, "", SAME_SHA],
    [SAME_SHA, SAME_SHA, "invalid-sha"],
  ]) {
    const out = await checkLatestRelease({
      containerRuntime: true, fetchImpl: refsFetch(...fixtures),
    });
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.code, "NO_COMPATIBLE_RELEASE");
  }
});

test("AU01 unavailable dedicated ref fails closed before any update", async () => {
  for (const unavailable of ["JILLU-Games", "MdNurnobi-Dev", "vibtoolshq"]) {
    const out = await checkLatestRelease({
      containerRuntime: true, fetchImpl: refsFetch(SAME_SHA, SAME_SHA, SAME_SHA, 404, unavailable),
    });
    assert.equal(out.ok, false);
    if (!out.ok) assert.equal(out.code, "UPSTREAM_UNAVAILABLE");
  }
});

test("AU01 Docker API refuses arbitrary ZIP URLs and invalid pinned SHAs", async () => {
  const bad = await queueUpdateRequest(
    { targetSha: "not-a-sha" }, { containerRuntime: true, prisma: null });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.status, 400);
  const archive = await queueUpdateRequest({
    targetSha: SAME_SHA, archiveUrl: "https://evil.example/payload.zip",
  }, { containerRuntime: true, prisma: null });
  assert.equal(archive.ok, false);
  if (!archive.ok) assert.equal(archive.status, 400);
});

test("AU01 missing root host bridge is a visible block, not a simulated successful update", async () => {
  const pf = await runUpdatePreflight({ containerRuntime: true });
  assert.equal(pf.status, "blocked");
  assert.ok(pf.checks.some((c) => !c.passed));
  const start = await queueUpdateRequest({
    targetSha: SAME_SHA,
  }, { containerRuntime: true, prisma: null });
  assert.equal(start.ok, false);
  if (!start.ok) assert.equal(start.status, 503);
  const status = await readUpdateStatus({ containerRuntime: true });
  assert.equal(status.step, "idle");
  assert.match(status.message, /not installed/);
});

test("AU01 Compose exposes only restricted updater IPC, not daemon socket or privileged web", () => {
  const compose = readFileSync("docker-compose.yml", "utf8");
  const web = compose.split("\n  web:\n")[1].split("\n  worker:\n")[0];
  assert.match(web, /readbox_update_ipc:\/run\/readbox-updater:ro/);
  assert.match(compose, /\n {2}readbox_update_ipc:\n/);
  assert.doesNotMatch(web, /docker\.sock|privileged:\s*true|user:\s*["']?0[:"]/);
  assert.match(readFileSync("scripts/install/readbox-update.sh", "utf8"),
    /READBOX_UPDATE_TARGET_SHA|AU01_SOURCE_MIRROR_SHA_MISMATCH/);
});
