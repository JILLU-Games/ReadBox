import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

if (process.env.READBOX_BR02_DISPOSABLE !== "1" || process.getuid?.() !== 0) {
  throw new Error("BR02_COMPOSE_TEST_REQUIRES_DISPOSABLE_ROOT_CI");
}
const root = process.cwd();
const project = "readboxbr02-ci";
const composeFile = join(root, "deployment/operations/ci-compose.yml");

function cmd(program, args) {
  const r = spawnSync(program, args, { cwd: root, encoding: "utf8", timeout: 180_000 });
  if (r.status !== 0) throw new Error("Disposable fixture command failed: " + program + " " + args[0]);
  return r.stdout.trim();
}
const compose = (...args) => cmd("docker", ["compose", "-f", composeFile,
  "--project-name", project, "--profile", "mailserver", ...args]);

function rpc(temp, action, backupId) {
  const payload = backupId ? { action, backupId } : { action };
  const body = Buffer.from(JSON.stringify(payload));
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(body).digest("hex");
  const secret = readFileSync(join(temp, "ipc", "access.token"), "utf8").trim();
  const signature = createHmac("sha256", secret)
    .update([timestamp, nonce, hash].join(".")).digest("hex");
  return new Promise((resolve, reject) => {
    const req = request({
      socketPath: join(temp, "ipc", "agent.sock"), path: "/rpc", method: "POST", timeout: 5000,
      headers: { "Content-Type": "application/json", "Content-Length": body.length,
        "X-ReadBox-Timestamp": timestamp, "X-ReadBox-Nonce": nonce,
        "X-ReadBox-Signature": signature },
    }, res => {
      const chunks = [];
      res.on("data", b => chunks.push(b));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch (e) { reject(e); }
      });
    });
    req.on("error", reject); req.end(body);
  });
}
async function poll(temp, id) {
  for (let i = 0; i < 140; i++) {
    const reply = await rpcJob(temp, id);
    if (["completed", "failed", "interrupted"].includes(reply.state)) return reply;
    await sleep(1500);
  }
  throw new Error("Disposable backup job polling timeout");
}
function rpcJob(temp, jobId) {
  // job.get has a separate fixed argument, never a user-supplied path.
  const body = Buffer.from(JSON.stringify({ action: "job.get", jobId }));
  const t = String(Math.floor(Date.now() / 1000)), nonce = randomBytes(16).toString("hex");
  const h = createHash("sha256").update(body).digest("hex");
  const secret = readFileSync(join(temp, "ipc", "access.token"), "utf8").trim();
  const sig = createHmac("sha256", secret).update([t, nonce, h].join(".")).digest("hex");
  return new Promise((resolve, reject) => {
    const req = request({socketPath: join(temp,"ipc","agent.sock"),method:"POST",path:"/rpc",
      headers:{"Content-Type":"application/json","Content-Length":body.length,
        "X-ReadBox-Timestamp":t,"X-ReadBox-Nonce":nonce,"X-ReadBox-Signature":sig}},
      res => {const chunks=[];res.on("data",x=>chunks.push(x));res.on("end",()=>{
        try {const reply=JSON.parse(Buffer.concat(chunks).toString());if(res.statusCode!==200)throw Error("Bad job lookup");resolve(reply.job);}
        catch(e){reject(e);}
      });});
    req.on("error",reject);req.end(body);
  });
}
async function startAgent(temp) {
  const child = spawn("python3", [
    "deployment/backup-agent/agent.py", "--root", root, "--project", project,
    "--db-user", "readbox", "--db-name", "readbox",
    "--socket-dir", join(temp,"ipc"), "--state-dir",join(temp,"state"),
    "--archive-dir",join(temp,"archives"),"--lock-path",join(temp,"maintenance.lock"),
  ], { cwd:root,stdio:["ignore","ignore","ignore"] });
  for (let i=0;i<100;i++){
    if(child.exitCode!==null)throw Error("Agent startup failed");
    if(existsSync(join(temp,"ipc","agent.sock"))&&existsSync(join(temp,"ipc","access.token"))){
      try {
        if ((await rpc(temp, "status")).status === 200) return child;
      } catch {
        await sleep(100);
      }
    }
    await sleep(100);
  }
  child.kill("SIGTERM");throw Error("Agent IPC unavailable");
}
async function stopAgent(child){
  if(!child || child.exitCode!==null)return;
  const done=new Promise(resolve=>child.once("exit",resolve));
  child.kill("SIGTERM");await Promise.race([done,sleep(3000)]);
  if(child.exitCode===null)child.kill("SIGKILL");
}

test("BR02 agent backs up and re-verifies disposable PostgreSQL/Maildir with host-persisted history", {timeout:360_000},async()=>{
  const temp=mkdtempSync(join(tmpdir(),"readbox-br02-compose-"));
  for(const sub of ["ipc","state","archives"])mkdirSync(join(temp,sub));
  let agent;
  try{
    cmd("docker",["pull","ubuntu:24.04"]);
    cmd("docker",["pull","busybox:1.37"]);
    compose("config","--quiet");
    compose("up","-d","--wait","postgres","web","worker","dovecot","postfix");
    compose("exec","-T","postgres","psql","-v","ON_ERROR_STOP=1","-U","readbox","-d","readbox","-c",
      "CREATE SCHEMA IF NOT EXISTS mailserver; CREATE TABLE public.br02_probe (id int PRIMARY KEY, payload text NOT NULL); INSERT INTO public.br02_probe VALUES (1,'BR02_DB_ORIGINAL');");
    const web=compose("ps","-q","web");
    cmd("docker",["run","--rm","--network","none","--volumes-from",web,"busybox:1.37","sh","-ec",
      "mkdir -p /var/vmail/example.test/br02/Maildir/new && printf 'BR02_PRIVATE_MAIL_CONTENT\\n' > /var/vmail/example.test/br02/Maildir/new/test-message && printf 'BR02_ATTACHMENT\\n' > /var/lib/readbox/attachments/test-attachment && printf 'BR02_MEDIA\\n' > /var/lib/readbox/media/test-media && chown -R 1001:1001 /var/vmail /var/lib/readbox/attachments /var/lib/readbox/media"]);
    const identity=join(temp,"state","identity.txt");
    cmd("age-keygen",["-o",identity]);chmodSync(identity,0o600);
    const recipient=cmd("age-keygen",["-y",identity]);
    writeFileSync(join(temp,"state","recipient.txt"),recipient+"\n",{mode:0o600});
    // A direct R05 baseline probe isolates fixture/Docker errors from broker/IPC.
    const direct = spawnSync("python3", [
      "deployment/operations/compose_recovery.py", "backup",
      "--compose-file", composeFile, "--project", project,
      "--db-user", "readbox", "--db-name", "readbox", "--recipient", recipient,
      "--output", join(temp, "direct-r05.age"), "--confirm-maintenance",
    ], { cwd: root, encoding: "utf8", timeout: 180_000 });
    if (direct.status !== 0) {
      const match = /R05_RECOVERY_BLOCKED: [A-Za-z0-9_]+/.exec(direct.stderr ?? "");
      throw new Error("DISPOSABLE_R05_DIRECT_ENGINE_FAILURE " + (match?.[0] ?? "NONZERO"));
    }
    assert.ok(statSync(join(temp, "direct-r05.age")).size > 0);
    agent=await startAgent(temp);
    const create=await rpc(temp,"backup.create");
    assert.equal(create.status,202);
    const done=await poll(temp,create.data.job.id);
    assert.equal(done.state,"completed", "Sanitized failure code: " + (done.result?.errorCode ?? "none"));
    assert.ok(done.result?.sha256);
    assert.equal(done.result.level,"V2");
    const archive=join(temp,"archives",create.data.job.id+".age");
    assert.equal(statSync(archive).mode&0o777,0o600);
    assert.equal(readFileSync(archive).includes(Buffer.from("BR02_PRIVATE_MAIL_CONTENT")),false);
    const reverify=await rpc(temp,"backup.verify",create.data.job.id);
    assert.equal(reverify.status,202);
    const checked=await poll(temp,reverify.data.job.id);
    assert.equal(checked.state,"completed");
    assert.equal(checked.result.verified,true);
    const db=compose("exec","-T","postgres","psql","-U","readbox","-d","readbox","-Atc",
      "SELECT payload FROM public.br02_probe;");
    assert.equal(db,"BR02_DB_ORIGINAL");
    const status=await rpc(temp,"status");
    assert.equal(status.status,200);
    assert.ok(status.data.backups.some(x=>x.id===create.data.job.id));
    assert.ok(status.data.jobs.some(x=>x.id===reverify.data.job.id));
    // Corrupted ciphertext must downgrade the displayed V2 badge before any restore.
    const tampered = readFileSync(archive);
    tampered[Math.floor(tampered.length / 2)] ^= 0x55;
    writeFileSync(archive, tampered);
    const corruptRequest = await rpc(temp, "backup.verify", create.data.job.id);
    assert.equal(corruptRequest.status, 202);
    const corruptJob = await poll(temp, corruptRequest.data.job.id);
    assert.equal(corruptJob.state, "failed");
    const corruptStatus = await rpc(temp, "status");
    assert.equal(corruptStatus.data.backups.find(x=>x.id===create.data.job.id)?.state, "needs_review");
    await stopAgent(agent);
    agent=await startAgent(temp);
    const persisted=await rpc(temp,"status");
    assert.equal(persisted.data.backups.length,1);
    assert.equal(persisted.data.jobs.find(x=>x.id===create.data.job.id)?.state,"completed");
    console.log("BR02_DISPOSABLE_ENCRYPTED_BACKUP_V2_VERIFY_MAILDIR_DB_AND_DURABLE_HISTORY_PASS");
  }finally{
    await stopAgent(agent);
    try {
      compose("down", "-v", "--remove-orphans");
    } catch (error) {
      console.error("BR02_DISPOSABLE_CLEANUP_FAILED", error instanceof Error ? error.message : "unknown");
    }
    rmSync(temp,{recursive:true,force:true});
  }
});
