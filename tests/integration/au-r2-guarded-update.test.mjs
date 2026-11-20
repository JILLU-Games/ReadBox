import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const old = readFileSync("scripts/install/readbox-update.sh", "utf8");
const guard = readFileSync("scripts/install/readbox-guarded-update.sh", "utf8");
const python = readFileSync("scripts/updater/backup_r2_gate.py", "utf8");

test("AU-R2 managed V2 agent jobs, R2 fail-closed, exact host routing", () => {
  const harness = readFileSync("tests/integration/au-r2-guarded-update.test.mjs", "utf8")
    .split("/* PYTHON_START\n")[1]?.split("\nPYTHON_END */")[0];
  assert.ok(harness?.includes("AU_R2_MOCKED_AGENT_R2_AND_HOST_NEGATIVES_PASS"));
  const output = spawnSync("python3", ["-c", harness], { encoding:"utf8" });
  assert.equal(output.status, 0, output.stderr || output.stdout);
  assert.match(output.stdout, /AU_R2_MOCKED_AGENT_R2_AND_HOST_NEGATIVES_PASS/);
});

test("guarded shell refuses incomplete or rejected R2 receipt before git merge", () => {
  const start=old.indexOf("# AU-R2-UPDATE-01: new guarded entrypoint");
  const end=old.indexOf('git merge --ff-only "$after"',start);
  assert.ok(start>=0 && end>start);
  const gate=old.slice(start,end);
  assert.match(gate,/backup_r2_gate\.py" attest/);
  assert.doesNotMatch(gate,/git merge|docker compose up/);
  const script=[
    "set -Eeuo pipefail",
    "ROOT=/opt/readbox",
    "python3() { [[ \"$DENY\" != 1 ]]; }",
    gate,
    "echo AU_R2_SHELL_GATE_PASS",
  ].join("\n");
  const sha="a".repeat(40);
  const runs=[
    [{READBOX_R2_GUARDED:"1",READBOX_UPDATE_REQUIRE_PARITY:"1",
      READBOX_R2_BACKUP_ID:"b".repeat(32),READBOX_R2_BACKUP_SHA256:"c".repeat(64),
      expected:sha,DENY:"0"},true],
    [{READBOX_R2_GUARDED:"1",READBOX_UPDATE_REQUIRE_PARITY:"1",
      READBOX_R2_BACKUP_ID:"",READBOX_R2_BACKUP_SHA256:"c".repeat(64),
      expected:sha,DENY:"0"},false],
    [{READBOX_R2_GUARDED:"1",READBOX_UPDATE_REQUIRE_PARITY:"1",
      READBOX_R2_BACKUP_ID:"b".repeat(32),READBOX_R2_BACKUP_SHA256:"bad",
      expected:sha,DENY:"0"},false],
    [{READBOX_R2_GUARDED:"1",READBOX_UPDATE_REQUIRE_PARITY:"1",
      READBOX_R2_BACKUP_ID:"b".repeat(32),READBOX_R2_BACKUP_SHA256:"c".repeat(64),
      expected:sha,DENY:"1"},false],
  ];
  for(const [envPart,pass] of runs) {
    const out=spawnSync("bash",["-c",script],{encoding:"utf8",env:{...process.env,...envPart}});
    assert.equal(out.status===0,pass,out.stderr);
    assert.equal(out.stdout.includes("AU_R2_SHELL_GATE_PASS"),pass);
  }
});

test("single-command preflight precedes fresh backup and update; readiness follows", () => {
  const pos=(s)=>guard.indexOf(s);
  assert.ok(pos("read_ref https://github.com/vibtoolshq/ReadBox.git")>=0);
  assert.ok(pos("read_ref https://github.com/JILLU-Games/ReadBox.git")>=0);
  assert.ok(pos("read_ref https://github.com/MdNurnobi-Dev/ReadBox.git")>=0);
  assert.ok(pos('"$gate_script" preflight')<pos('"$gate_script" run'));
  assert.ok(pos('"$gate_script" run')<pos('bash "$update_script"'));
  assert.ok(pos('bash "$update_script"')<pos('"/health/live"'));
  assert.ok(pos('bash "$update_script"')<pos("migrate status"));
  assert.match(guard,/flock -n 8/);
  assert.match(guard,/POST_UPDATE_MIGRATION_STATUS_FAILED/);
  assert.match(guard,/AU_R2_UPDATE_MANUAL_ACCEPTANCE_PENDING/);
  assert.doesNotMatch(guard,/git reset --hard|docker compose down -v|docker volume (?:rm|prune)/);
  assert.match(python,/hmac\.new/);
  assert.match(python,/remoteVerifiedAt/);
  assert.match(python,/AU_R2_LOCAL_CHECKSUM_MISMATCH/);
});

/* PYTHON_START
import hashlib, importlib.util, tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest import mock
spec=importlib.util.spec_from_file_location("gate","scripts/updater/backup_r2_gate.py")
gate=importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)
spec2=importlib.util.spec_from_file_location("host","scripts/updater/compose_host_worker.py")
host=importlib.util.module_from_spec(spec2)
spec2.loader.exec_module(host)
ID="a"*32; SHA="a"*40; DATA=b"synthetic encrypted disposable example"
DIGEST=hashlib.sha256(DATA).hexdigest()
class Fake:
  def __init__(self,fail=""): self.fail=fail; self.calls=[]
  def call(self,action,**v):
    self.calls.append(action)
    rec={"id":ID,"state":"verified","level":"V2","sha256":DIGEST,"bytes":len(DATA),
      "includesHostSecrets":False,"remoteKey":"readbox/managed/"+ID+".age",
      "remoteState":"remote_verified","remoteVerifiedAt":"2026-11-20T10:00:00+00:00"}
    if self.fail=="missing_receipt": rec.pop("remoteVerifiedAt")
    if action=="status":
      return {"connected":True,"jobs":[{"state":"running"}] if self.fail=="busy" else [],
        "backups":[rec],"r2":{"configured":self.fail!="no_r2"},
        "restore":{"operatorReviewRequired":False}}
    if action=="r2.upload" and self.fail=="upload_403": raise gate.GateError("AU_R2_RPC_REFUSED")
    if action in ("backup.create","backup.verify","r2.upload"):
      kind={"backup.create":"backup","backup.verify":"verify","r2.upload":"r2_upload"}[action]
      jid={"backup":ID,"verify":"b"*32,"r2_upload":"c"*32}[kind]
      return {"job":{"id":jid,"kind":kind,"state":"queued"}}
    if action=="job.get":
      jid=v["jobId"]
      if jid==ID: return {"job":{"id":jid,"kind":"backup","state":"completed",
        "result":{"id":ID,"level":"V2","state":"verified","sha256":DIGEST,"bytes":len(DATA)}}}
      if jid=="b"*32: return {"job":{"id":jid,"kind":"verify","backupId":ID,
        "state":"completed","result":{"backupId":ID,"level":"V2","verified":True}}}
      return {"job":{"id":jid,"kind":"r2_upload","backupId":ID,"state":"completed",
        "result":{"backupId":ID,"remoteVerified":self.fail!="bad_upload","bytes":len(DATA)}}}
    raise AssertionError(action)
with tempfile.TemporaryDirectory() as tmp:
  archive=Path(tmp)/(ID+".age")
  archive.write_bytes(DATA)
  archive.chmod(0o600)
  with mock.patch.object(gate,"ARCHIVES",Path(tmp)), \
       mock.patch.object(gate,"regular_file",lambda *a: None), \
       mock.patch.object(gate.shutil,"disk_usage",return_value=SimpleNamespace(free=2**30)):
    good=Fake()
    assert gate.perform(good)==(ID,DIGEST)
    assert good.calls==["status","backup.create","job.get","backup.verify",
      "job.get","r2.upload","job.get","status"],good.calls
    for failure in ("busy","no_r2","upload_403","bad_upload","missing_receipt"):
      bad=Fake(failure)
      try: gate.perform(bad)
      except gate.GateError: pass
      else: raise AssertionError("failed open "+failure)
      if failure in ("busy","no_r2"): assert bad.calls==["status"]
    archive.write_bytes(b"corrupt")
    try: gate.receipt(Fake(),ID,DIGEST)
    except gate.GateError as err: assert str(err)=="AU_R2_LOCAL_CHECKSUM_MISMATCH"
    else: raise AssertionError("corrupt archive was accepted")
seen=[]; states=[]
def run(argv,timeout=20):
  if argv[:2]==["age-keygen","-y"]: return "age1"+"a"*55
  if argv==["git","rev-parse","HEAD"]: return SHA
  raise AssertionError(argv)
def fake_process(args,**kw): seen.append((args,kw)); return SimpleNamespace(returncode=0)
with mock.patch.object(host,"host_check",return_value=([{"passed":True}],"b"*40,SHA)), \
     mock.patch.object(host,"run",side_effect=run), \
     mock.patch.object(host.subprocess,"run",side_effect=fake_process), \
     mock.patch.object(host,"atomic_status",side_effect=lambda step,*a,**kw:states.append(step)):
  host.do_update(SHA)
assert len(seen)==1 and seen[0][0]==["/bin/bash",
 "/opt/readbox/scripts/install/readbox-guarded-update.sh","--target-sha",SHA]
assert seen[0][1]["timeout"]==5400 and states[-1]=="complete"
states.clear()
with mock.patch.object(host,"host_check",return_value=([{"passed":True}],"b"*40,"b"*40)), \
     mock.patch.object(host.subprocess,"run",side_effect=AssertionError("MUTATION_FORBIDDEN")), \
     mock.patch.object(host,"atomic_status",side_effect=lambda step,*a,**kw:states.append(step)):
  host.do_update(SHA)
assert states[-1]=="error"
print("AU_R2_MOCKED_AGENT_R2_AND_HOST_NEGATIVES_PASS")
PYTHON_END */
