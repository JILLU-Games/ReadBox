"""UTC-only persisted automatic backups; default OFF and no missed-run burst."""
from __future__ import annotations
from datetime import datetime, timezone
from pathlib import Path
import threading
import time
from storage import atomic_json

DEFAULT={"enabled":False,"intervalHours":24,"autoUpload":False,
         "retentionDays":0,"keepLocal":3,"nextRunAt":None,
         "lastRunAt":None,"timeZone":"UTC"}


class ScheduleError(ValueError):
    def __init__(self, code: str):
        self.code=code
        super().__init__("Schedule refused")


class ScheduleManager:
    def __init__(self, store):
        self.store=store
        self.path=store.root/"schedule.json"
        self.lock=threading.RLock()

    @staticmethod
    def validate(payload: dict)->None:
        if not isinstance(payload,dict) or set(payload)!={"enabled","intervalHours",
                "autoUpload","retentionDays","keepLocal"}:
            raise ScheduleError("SCHEDULE_INVALID")
        if type(payload["enabled"]) is not bool or type(payload["autoUpload"]) is not bool:
            raise ScheduleError("SCHEDULE_INVALID")
        if type(payload["intervalHours"]) is not int or payload["intervalHours"] not in {6,12,24}:
            raise ScheduleError("SCHEDULE_INVALID")
        if type(payload["retentionDays"]) is not int or payload["retentionDays"] not in {
                0,7,14,30,60,90,180,365}:
            raise ScheduleError("SCHEDULE_INVALID")
        if type(payload["keepLocal"]) is not int or not 3<=payload["keepLocal"]<=30:
            raise ScheduleError("SCHEDULE_INVALID")

    def read(self)->dict:
        with self.lock:
            if not self.path.exists():
                return dict(DEFAULT)
            if self.path.is_symlink() or not self.path.is_file():
                raise ScheduleError("SCHEDULE_FILE_UNSAFE")
            import json
            try:
                data=json.loads(self.path.read_text())
                if not isinstance(data,dict) or set(data)!=set(DEFAULT):
                    raise ValueError()
                self.validate({k:data[k] for k in ("enabled","intervalHours",
                              "autoUpload","retentionDays","keepLocal")})
                if data["timeZone"]!="UTC":
                    raise ValueError()
                return data
            except (ValueError,TypeError):
                raise ScheduleError("SCHEDULE_INVALID") from None

    def configure(self,payload:dict,r2_configured:bool)->dict:
        self.validate(payload)
        if payload["autoUpload"] and payload["enabled"] and not r2_configured:
            raise ScheduleError("R2_NOT_CONFIGURED")
        with self.lock:
            old=self.read()
            next_at=(time.time()+payload["intervalHours"]*3600) if payload["enabled"] else None
            new={**payload,"timeZone":"UTC","nextRunAt":next_at,
                 "lastRunAt":old["lastRunAt"]}
            atomic_json(self.path,new)
            return new

    def due(self,when:float|None=None)->dict|None:
        with self.lock:
            data=self.read()
            current=time.time() if when is None else when
            if not data["enabled"] or data["nextRunAt"] is None or current<data["nextRunAt"]:
                return None
            # Move slot before queueing: reboot never reruns one missed UTC slot.
            data["lastRunAt"]=datetime.fromtimestamp(current,timezone.utc).isoformat()
            data["nextRunAt"]=current+data["intervalHours"]*3600
            atomic_json(self.path,data)
            return data

    def cleanup_local(self,r2,archives:Path,settings:dict,when:float|None=None)->list[str]:
        if not settings.get("enabled") or settings.get("retentionDays")==0:
            return []
        current=time.time() if when is None else when
        kept=[r for r in self.store.list_backups() if r.get("localState")!="deleted"
              and r.get("state")=="verified" and r.get("level")=="V2"]
        if len(kept)<=settings["keepLocal"]:
            return []
        deleted=[]
        for record in sorted(kept,key=lambda x:x["createdAt"]):
            if len(kept)-len(deleted)<=settings["keepLocal"]:
                break
            if not record.get("remoteVerifiedAt"):
                continue
            age=current-datetime.fromisoformat(record["createdAt"]).timestamp()
            if age<settings["retentionDays"]*86400:
                continue
            if any(j["state"] in {"queued","running"} for j in self.store.list_jobs()):
                break
            identifier=record["id"]
            path=archives/(identifier+".age")
            if path.is_symlink() or not path.is_file() or (path.stat().st_mode & 0o777)!=0o600:
                continue
            try:
                # Re-stream remote object plus validate local V2 before releasing copy.
                r2.upload(identifier)
                path.unlink()
                self.store.mark_local_deleted(identifier)
                deleted.append(identifier)
            except Exception:
                continue
        return deleted
