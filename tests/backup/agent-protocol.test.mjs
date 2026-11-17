import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, chmodSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

if (process.env.READBOX_BR02_DISPOSABLE !== "1" || process.getuid?.() !== 0) {
  throw new Error("BR02_PROTOCOL_TEST_REQUIRES_DISPOSABLE_ROOT_CI");
}
const root = process.cwd();

function run(command, args) {
  const r = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  if (r.status !== 0) throw new Error("Test prerequisite failed: " + command);
  return r.stdout.trim();
}
async function startAgent(temp) {
  const args = [
    "deployment/backup-agent/agent.py", "--root", root,
    "--project", "readboxbr02-ci", "--db-user", "readbox", "--db-name", "readbox",
    "--socket-dir", join(temp, "ipc"), "--state-dir", join(temp, "state"),
    "--archive-dir", join(temp, "archives"), "--lock-path", join(temp, "lock"),
  ];
  const child = spawn("python3", args, { cwd: root, stdio: ["ignore", "ignore", "ignore"] });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error("Agent exited before readiness");
    if (existsSync(join(temp, "ipc", "agent.sock")) && existsSync(join(temp, "ipc", "access.token"))) {
      await sleep(50);
      return child;
    }
    await sleep(100);
  }
  child.kill("SIGTERM");
  throw new Error("Agent did not become ready");
}
async function stopAgent(child) {
  if (child.exitCode !== null) return;
  const stopped = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await Promise.race([stopped, sleep(3000)]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
function rpc(temp, payload, options = {}) {
  const content = Buffer.from(JSON.stringify(payload));
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = options.nonce ?? randomBytes(16).toString("hex");
  const token = options.badToken
    ? "a".repeat(64)
    : readFileSync(join(temp, "ipc", "access.token"), "utf8").trim();
  const contentHash = createHash("sha256").update(content).digest("hex");
  const signature = createHmac("sha256", token)
    .update([timestamp, nonce, contentHash].join(".")).digest("hex");
  return new Promise((resolve, reject) => {
    const req = request({
      socketPath: join(temp, "ipc", "agent.sock"),
      path: "/rpc", method: "POST", timeout: 4000,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": content.length,
        "X-ReadBox-Timestamp": timestamp,
        "X-ReadBox-Nonce": nonce,
        "X-ReadBox-Signature": options.unsigned ? "f".repeat(64) : signature,
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch (error) { reject(error); }
      });
    });
    req.on("error", reject);
    req.end(content);
  });
}

test("BR02 private IPC denies unsigned/replayed/unsafe requests, persists interrupted journal", async () => {
  const temp = mkdtempSync(join(tmpdir(), "readbox-br02-proto-"));
  mkdirSync(join(temp, "ipc"));
  mkdirSync(join(temp, "state"));
  mkdirSync(join(temp, "archives"));
  const identity = join(temp, "state", "identity.txt");
  run("age-keygen", ["-o", identity]);
  chmodSync(identity, 0o600);
  const recipient = run("age-keygen", ["-y", identity]);
  const { writeFileSync } = await import("node:fs");
  writeFileSync(join(temp, "state", "recipient.txt"), recipient + "\n", { mode: 0o600 });
  let child;
  try {
    child = await startAgent(temp);
    assert.equal((await rpc(temp, { action: "status" })).status, 200);
    assert.equal((await rpc(temp, { action: "status" }, { unsigned: true })).status, 403);
    const nonce = randomBytes(16).toString("hex");
    assert.equal((await rpc(temp, { action: "status" }, { nonce })).status, 200);
    assert.equal((await rpc(temp, { action: "status" }, { nonce })).status, 403);
    assert.equal((await rpc(temp, { action: "restore.production" })).status, 400);
    assert.equal((await rpc(temp, { action: "backup.verify", backupId: "../../etc/shadow" })).status, 404);
    assert.equal((await rpc(temp, { action: "job.get", jobId: "f".repeat(32) })).status, 404);
    const ipcToken = readFileSync(join(temp, "ipc", "access.token"), "utf8");
    assert.match(ipcToken, /^[a-f0-9]{64}\n$/);
    assert.equal((await rpc(temp, { action: "status" }, { badToken: true })).status, 403);
    // Inject only a harmless queued record in disposable host-state; restarting
    // must mark it INTERRUPTED rather than claiming success or auto-running it.
    const jobId = run("python3", ["-c",
      "from pathlib import Path;import sys;sys.path.insert(0,'deployment/backup-agent');from storage import PrivateStore;print(PrivateStore(Path(sys.argv[1])).create('backup')['id'])",
      join(temp, "state")]);
    await stopAgent(child);
    child = await startAgent(temp);
    const status = await rpc(temp, { action: "job.get", jobId });
    assert.equal(status.status, 200);
    assert.equal(status.data.job.state, "interrupted");
    assert.equal(status.data.job.events.at(-1).level, "warning");
    assert.equal(status.data.job.events.at(-1).message.includes("secret"), false);
    console.log("BR02_AUTH_REPLAY_PATH_DENY_AND_PERSISTENT_INTERRUPTED_JOURNAL_PASS");
  } finally {
    if (child) await stopAgent(child);
    rmSync(temp, { recursive: true, force: true });
  }
});
