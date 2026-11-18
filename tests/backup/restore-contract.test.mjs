import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("BR04 operator gate, admin actor binding, one-use hashed permits, interrupted restore fail-closed", { timeout: 25_000 }, () => {
  const program=String.raw`
import sys, os, tempfile, hashlib, json
from pathlib import Path
sys.path.insert(0,"deployment/backup-agent")
os.environ["READBOX_BR02_DISPOSABLE"]="1"
os.environ["READBOX_BR04_DISPOSABLE"]="1"
from storage import PrivateStore
import restore, agent
from agent import BackupBroker

with tempfile.TemporaryDirectory() as tmp:
    root=Path(tmp)
    store=PrivateStore(root/"state")
    archives=root/"archives"; archives.mkdir(mode=0o700)
    backup_id="a"*32
    ciphertext=b"age-ciphertext-disposable-fixture"
    archive=archives/(backup_id+".age")
    archive.write_bytes(ciphertext);archive.chmod(0o600)
    digest=hashlib.sha256(ciphertext).hexdigest()
    record={"id":backup_id,"state":"verified","level":"V2",
       "format":"age-r05-v1","bytes":len(ciphertext),"sha256":digest,
       "includesQueue":True,"includesHostSecrets":False,
       "createdAt":"2026-11-18T00:00:00+00:00"}
    store.save_backup(record)
    identity=store.root/"identity.txt"
    identity.write_text("disposable private identity");identity.chmod(0o600)
    class Executor:
        def __init__(self):
            self.state=store;self.archives=archives;self.identity=identity
            self.root=root;self.project="readboxbr02-ci";self.db_name="readbox"
            self.db_user="readbox";self.compose_file=root/"fixed-compose.yml"
    ex=Executor()
    verify_calls=[]
    def verify(**kw):
        verify_calls.append(kw)
        assert kw["archive"]==archive and kw["identity"]==identity
        assert kw["expected_digest"]==digest
        return {"format":"age-r05-v1","level":"V2","sha256":digest,
                "bytes":len(ciphertext),"includesQueue":True,
                "includesHostSecrets":False}
    restore.verify_age_snapshot=verify
    broker=BackupBroker(store,ex,b"0"*64)
    class NoThread:
        def __init__(self,*args,**kwargs):pass
        def start(self):pass
    agent.threading.Thread=NoThread
    os.environ.pop("READBOX_BR04_DISPOSABLE")
    status,result=broker.perform({"action":"restore.test","backupId":backup_id})
    assert status==200 and result["preflight"]["verified"]
    status,result=broker.perform({"action":"restore.prepare","backupId":backup_id,"actor":"1"})
    assert status==409 and result["error"]=="RESTORE_OPERATOR_GATE_CLOSED"
    os.environ["READBOX_BR04_DISPOSABLE"]="1"
    status,result=broker.perform({"action":"restore.prepare","backupId":backup_id,"actor":"1"})
    assert status==200 and result["preflight"]["rollbackRequired"]
    permit=result["permit"]
    raw=(store.restore_permits/(permit["permitId"]+".json")).read_text()
    assert permit["token"] not in raw and digest in raw
    def commit(permit,actor="1",phrase=None):
        return broker.perform({"action":"restore.commit","backupId":backup_id,
          "actor":actor,"permitId":permit["permitId"],
          "token":permit["token"],
          "confirmation":phrase if phrase is not None else "RESTORE "+backup_id})
    status,res=commit(permit,phrase="RESTORE a")
    assert status==409 and res["error"]=="RESTORE_CONFIRMATION_REQUIRED"
    status,res=commit(permit,actor="2")
    assert status==409 and res["error"]=="RESTORE_PERMIT_EXPIRED"
    status,res=commit(permit)
    assert status==409 and res["error"]=="RESTORE_PERMIT_EXPIRED"
    status,res=broker.perform({"action":"restore.prepare","backupId":backup_id,"actor":"1"})
    assert status==200
    permit2=res["permit"]
    # Expired capabilities cannot restore, even when the token is correct.
    f=store.restore_permits/(permit2["permitId"]+".json")
    data=json.loads(f.read_text());data["expiresAt"]=1
    from storage import atomic_json
    atomic_json(f,data)
    status,res=commit(permit2)
    assert status==409 and res["error"]=="RESTORE_PERMIT_EXPIRED"
    status,res=broker.perform({"action":"restore.prepare","backupId":backup_id,"actor":"1"})
    assert status==200
    permit3=res["permit"]
    status,res=commit(permit3)
    assert status==202 and res["job"]["kind"]=="restore"
    job=store.get_job(res["job"]["id"])
    assert job["expectedDigest"]==digest and job["backupId"]==backup_id
    status,res=commit(permit3)
    assert status==409
    # Simulated killed agent with queued restore: never silently continue jobs.
    restarted=PrivateStore(store.root)
    assert restarted.get_job(job["id"])["state"]=="interrupted"
    assert restarted.restore_requires_review() is True
    assert restarted.claim_due_auto_upload() is None
    try:restarted.create("backup")
    except RuntimeError as e:assert str(e)=="RESTORE_OPERATOR_REVIEW_REQUIRED"
    else:raise AssertionError("Interrupted restore allowed maintenance")
    assert len(verify_calls)>=5
    print("BR04_HASHED_ACTOR_BOUND_ONE_USE_TTL_GATE_INTERRUPTED_RESTORE_PASS")
`;
  const p=spawnSync("python3",["-c",program],{encoding:"utf8",timeout:20_000});
  assert.equal(p.status,0,(p.stderr??"").slice(-2400));
  assert.match(p.stdout,/BR04_HASHED_ACTOR_BOUND_ONE_USE_TTL_GATE_INTERRUPTED_RESTORE_PASS/);
});
