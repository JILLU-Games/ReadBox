import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("BR03 UTC schedule: opt-in, persisted slots, no replay, retention minimum and no deletion without verified remote", () => {
  const program = String.raw`
from pathlib import Path
import sys,tempfile,os,time
sys.path.insert(0,"deployment/backup-agent")
from storage import PrivateStore
from scheduler import ScheduleManager,ScheduleError

with tempfile.TemporaryDirectory() as tmp:
    root=Path(tmp)
    store=PrivateStore(root/"state")
    schedule=ScheduleManager(store)
    assert schedule.read()["enabled"] is False
    assert schedule.due(time.time()+99999) is None
    payload={"enabled":True,"intervalHours":6,"autoUpload":False,
             "retentionDays":7,"keepLocal":3}
    schedule.configure(payload,False)
    initial=schedule.read()
    assert initial["timeZone"]=="UTC" and initial["nextRunAt"]>time.time()
    assert ScheduleManager(store).read()["nextRunAt"]==initial["nextRunAt"]
    at=initial["nextRunAt"]+1
    assert schedule.due(at)["lastRunAt"]
    assert schedule.due(at) is None
    after=ScheduleManager(store).read()
    assert after["nextRunAt"]>at and after["nextRunAt"]<at+21601
    for altered in ({**payload,"intervalHours":1},{**payload,"keepLocal":1},
                    {**payload,"retentionDays":-1}):
        try:schedule.configure(altered,False)
        except ScheduleError as error:assert error.code=="SCHEDULE_INVALID"
        else:raise AssertionError("invalid schedule accepted")
    assert ScheduleManager(store).read()==after
    try:schedule.configure({**payload,"autoUpload":True},False)
    except ScheduleError as error:assert error.code=="R2_NOT_CONFIGURED"
    else:raise AssertionError("auto-upload enabled without R2")
    archives=root/"archives"
    archives.mkdir()
    for index in range(5):
        identifier=("%032x"%(index+1))
        path=archives/(identifier+".age")
        path.write_bytes(b"encrypted"+bytes([index]))
        os.chmod(path,0o600)
        store.save_backup({"id":identifier,
          "state":"verified","level":"V2","createdAt":"2024-01-01T00:00:00+00:00",
          "remoteVerifiedAt":"2024-02-01T00:00:00+00:00" if index>0 else None})
    class R2:
        def __init__(self):self.checked=[]
        def upload(self,identifier):self.checked.append(identifier);return {"remoteVerified":True}
    remote=R2()
    removed=schedule.cleanup_local(remote,archives,after,when=time.time())
    # oldest has NO verified remote and must never be deleted
    assert "00000000000000000000000000000001" not in removed
    assert len(removed)==2 and len(remote.checked)==2
    assert len(list(archives.glob("*.age")))==3
    assert schedule.cleanup_local(remote,archives,after,when=time.time())==[]
    schedule.configure({**payload,"enabled":False},False)
    assert schedule.due(time.time()+999999) is None
    print("BR03_UTC_DEFAULT_OFF_RESTART_NO_REPLAY_GUARDED_RETENTION_PASS")
`;
  const p=spawnSync("python3",["-c",program],{encoding:"utf8",timeout:15_000});
  assert.equal(p.status,0,(p.stderr??"").slice(-1800));
  assert.match(p.stdout,/BR03_UTC_DEFAULT_OFF_RESTART_NO_REPLAY_GUARDED_RETENTION_PASS/);
});
