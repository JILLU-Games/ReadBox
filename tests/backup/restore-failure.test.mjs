import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("BR04 fixed R05 restore args, pre-mutation verification, rollback archive retention and critical failure", { timeout: 25_000 }, () => {
  const program=String.raw`
import sys,os,tempfile,hashlib,stat
from pathlib import Path
sys.path.insert(0,"deployment/backup-agent")
os.environ["READBOX_BR02_DISPOSABLE"]="1"
os.environ["READBOX_BR04_DISPOSABLE"]="1"
import restore
from storage import PrivateStore

with tempfile.TemporaryDirectory() as tmp:
    root=Path(tmp)
    state=PrivateStore(root/"state")
    archives=root/"archives";archives.mkdir(mode=0o700)
    identity=state.root/"identity.txt"; identity.write_text("fake private identity");identity.chmod(0o600)
    backup_id="b"*32
    archive=archives/(backup_id+".age")
    cipher=b"fake age encrypted blob";archive.write_bytes(cipher);archive.chmod(0o600)
    sha=hashlib.sha256(cipher).hexdigest()
    state.save_backup({"id":backup_id,"createdAt":"2026-11-18T00:00:00+00:00",
       "state":"verified","level":"V2","sha256":sha,"bytes":len(cipher),
       "format":"age-r05-v1","includesQueue":True,"includesHostSecrets":False})
    class Executor:
        def __init__(self):
            self.state=state;self.archives=archives;self.identity=identity
            self.root=root;self.project="readboxbr02-ci";self.db_name="readbox"
            self.db_user="readbox";self.compose_file=root/"deployment/operations/ci-compose.yml"
        def _recipient(self):return "age1"+"x"*60
    ex=Executor()
    calls=[]
    restore.verify_age_snapshot=lambda **kw: {
      "format":"age-r05-v1","level":"V2","sha256":sha,"bytes":len(cipher),
      "includesQueue":True,"includesHostSecrets":False}
    class FakePopen:
        mode="success"
        def __init__(self,args,**kwargs):
            assert args[1].endswith("deployment/operations/compose_recovery.py")
            assert args[2]=="restore" and "--confirm-restore" in args
            assert "--confirm-maintenance" in args
            assert args[args.index("--input")+1]==str(archive)
            assert args[args.index("--identity")+1]==str(identity)
            assert args[args.index("--project")+1]=="readboxbr02-ci"
            dest=Path(args[args.index("--rollback-output")+1])
            assert dest.parent==archives/"restore-rollback"
            assert not dest.exists()
            dest.write_bytes(b"age encrypted rollback");dest.chmod(0o600)
            calls.append(args)
            self.returncode=0 if self.mode=="success" else 1
        def communicate(self,timeout=None):
            if self.mode=="success":return b"R05_VERIFIED_RESTORE_PASS",b""
            if self.mode=="rollback":return b"R05_AUTOMATIC_ROLLBACK_PASS",b"R05_RECOVERY_BLOCKED: RuntimeError"
            return b"",b"R05_CRITICAL: rollback failed; operator intervention required"
    restore.subprocess.Popen=FakePopen
    assert restore.preflight(ex,backup_id)["verified"] is True
    before=len(calls)
    try:restore.execute(ex,backup_id,"0"*32,"f"*64)
    except restore.RestoreError as e:assert e.code=="RESTORE_SOURCE_CHANGED"
    else:raise AssertionError("mismatched digest accepted")
    assert len(calls)==before
    out=restore.execute(ex,backup_id,"1"*32,sha)
    assert out["restored"] and out["rollbackId"]=="1"*32
    assert (archives/"restore-rollback"/("1"*32+".age")).exists()
    FakePopen.mode="rollback"
    try:restore.execute(ex,backup_id,"2"*32,sha)
    except restore.RestoreError as e:assert e.code=="RESTORE_FAILED_ROLLED_BACK"
    else:raise AssertionError("post-mutation failure counted as success")
    assert (archives/"restore-rollback"/("2"*32+".age")).exists()
    FakePopen.mode="critical"
    try:restore.execute(ex,backup_id,"3"*32,sha)
    except restore.RestoreError as e:assert e.code=="RESTORE_ROLLBACK_CRITICAL"
    else:raise AssertionError("critical rollback failure ignored")
    assert (archives/"restore-rollback"/("3"*32+".age")).exists()
    FakePopen.mode="success"
    archive.chmod(0o644)
    try:restore.preflight(ex,backup_id)
    except restore.RestoreError as e:assert e.code=="RESTORE_ARCHIVE_UNSAFE"
    else:raise AssertionError("unsafe archive accepted")
    archive.chmod(0o600)
    archive.unlink();archive.symlink_to(identity)
    try:restore.preflight(ex,backup_id)
    except restore.RestoreError as e:assert e.code=="RESTORE_ARCHIVE_UNAVAILABLE"
    else:raise AssertionError("symlink archive accepted")
    assert len(calls)==3
    print("BR04_R05_FIXED_ALLOWLIST_SOURCE_MISMATCH_ROLLBACK_FAILURE_PASS")
`;
  const p=spawnSync("python3",["-c",program],{encoding:"utf8",timeout:20_000});
  assert.equal(p.status,0,(p.stderr??"").slice(-2400));
  assert.match(p.stdout,/BR04_R05_FIXED_ALLOWLIST_SOURCE_MISMATCH_ROLLBACK_FAILURE_PASS/);
});
