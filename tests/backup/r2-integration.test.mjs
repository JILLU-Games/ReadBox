import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("BR03 mocked R2: TLS endpoint pinning, encrypted credential rotation, owned upload and fail-closed remote checks", { timeout: 35_000 }, () => {
  const program = String.raw`
from pathlib import Path
import sys,tempfile,os,io,hashlib,types
sys.path.insert(0,"deployment/backup-agent")
from storage import PrivateStore
import r2

class S3Failure(Exception):
    def __init__(self,status):
        self.response={"ResponseMetadata":{"HTTPStatusCode":status}}

class FakeS3:
    def __init__(self):
        self.objects={}
        self.fail=None
        self.cleanup_failed=False
        self.upload_calls=0
        self.fail_upload_once=False
        self.put_ack_lost=False
        self.pages=0
        self.bad_page_token=False
    def list_objects_v2(self,**args):
        if self.fail=="list": raise S3Failure(403)
        assert args["Prefix"]=="readbox/managed/"
        self.pages+=1
        keys=sorted(k for k in self.objects if k.startswith(args["Prefix"]))
        start=int(args.get("ContinuationToken","0"))
        page=keys[start:start+args["MaxKeys"]]
        result={"Contents":[{"Key":k,"Size":len(self.objects[k][0])} for k in page],
                "IsTruncated":start+len(page)<len(keys)}
        if result["IsTruncated"]:
            result["NextContinuationToken"]=("0" if self.bad_page_token else str(start+len(page)))
        return result
    def put_object(self,**args):
        if self.fail=="put":raise S3Failure(403)
        self.objects[args["Key"]]=(bytes(args["Body"]),args.get("Metadata",{}))
        if self.put_ack_lost:
            self.put_ack_lost=False
            raise TimeoutError("simulated lost PUT ACK")
    def head_object(self,**args):
        if self.fail=="timeout":raise OSError("connection timeout simulated")
        if args["Key"] not in self.objects:raise S3Failure(404)
        content,meta=self.objects[args["Key"]]
        return {"ContentLength":len(content),"Metadata":meta}
    def get_object(self,**args):
        content,meta=self.objects[args["Key"]]
        return {"Body":io.BytesIO(content)}
    def delete_object(self,**args):
        if self.cleanup_failed: raise S3Failure(403)
        assert "/health/" in args["Key"]
        self.objects.pop(args["Key"],None)
    def upload_file(self,filename,bucket,key,ExtraArgs):
        self.upload_calls+=1
        if self.fail=="partial":raise OSError("partial object")
        assert key.startswith("readbox/managed/") and key.endswith(".age")
        with open(filename,"rb") as f:self.objects[key]=(f.read(),ExtraArgs["Metadata"])
        if self.fail_upload_once:
            self.fail_upload_once=False
            raise TimeoutError("simulated lost upload ACK")

with tempfile.TemporaryDirectory() as temporary:
    root=Path(temporary)
    store=PrivateStore(root/"state")
    archives=root/"archives"
    archives.mkdir(mode=0o700)
    identity=store.root/"identity.txt"
    identity.write_text("fixture")
    os.chmod(identity,0o600)
    class Executor:
        def __init__(self):self.archives=archives;self.identity=identity;self.root=root;self.project="readboxbr02-ci";self.db_name="readbox"
    adapter=r2.R2Adapter(store,Executor())
    account="a"*32
    key="B"*20
    secret="c"*64
    config={"accountId":account,"bucket":"readbox-private","accessKeyId":key,"secretAccessKey":secret}
    fake=FakeS3()
    calls=[]
    import boto3
    original=boto3.client
    def mock_client(name,**kwargs):
        assert name=="s3" and kwargs["endpoint_url"]=="https://"+account+".r2.cloudflarestorage.com"
        assert kwargs["region_name"]=="auto" and kwargs["aws_secret_access_key"]==secret
        assert kwargs["config"].signature_version=="s3v4"
        calls.append(kwargs["endpoint_url"])
        return fake
    boto3.client=mock_client
    try:
        assert adapter.public()["configured"] is False
        adapter.configure(config)
        assert adapter.public()["configured"] and adapter.public()["accessKeyLast4"]==key[-4:]
        assert adapter.public()["bucket"]=="readbox-private"
        cipher=(store.root/"r2-credentials.enc").read_bytes()
        assert secret.encode() not in cipher and key.encode() not in cipher
        assert (store.root/"r2-master.key").stat().st_mode&0o777 == 0o600
        assert (store.root/"r2-credentials.enc").stat().st_mode&0o777 == 0o600
        assert adapter.test()["verified"]
        old=cipher
        fake.fail="list"
        try:adapter.configure({**config,"accessKeyId":"D"*20})
        except r2.R2Error as e:assert e.code=="R2_CONNECTION_FAILED"
        else:raise AssertionError("rotation with invalid auth accepted")
        assert (store.root/"r2-credentials.enc").read_bytes()==old
        fake.fail=None
        backup_id="b"*32
        content=b"age-encrypted-only\\x00not-plaintext-fixture"
        path=archives/(backup_id+".age")
        path.write_bytes(content)
        os.chmod(path,0o600)
        digest=hashlib.sha256(content).hexdigest()
        store.save_backup({"id":backup_id,"createdAt":"2026-01-01T00:00:00+00:00",
         "state":"verified","level":"V2","format":"age-r05-v1","bytes":len(content),"sha256":digest})
        r2.verify_age_snapshot=lambda **kw: {"sha256":digest}
        outcome=adapter.upload(backup_id)
        assert outcome["remoteVerified"] is True
        assert adapter.list_remote()[0]["key"]=="readbox/managed/"+backup_id+".age"
        assert len(fake.objects)==1
        adapter.upload(backup_id) # exact immutable remote object must be idempotent
        assert len(fake.objects)==1
        fake.objects["readbox/managed/"+backup_id+".age"]=(b"wrong",{"sha256":"f"*64})
        try:adapter.upload(backup_id)
        except r2.R2Error as e:assert e.code=="R2_REMOTE_OBJECT_CONFLICT"
        else:raise AssertionError("conflicting key overwritten")
        assert fake.objects["readbox/managed/"+backup_id+".age"][0]==b"wrong"
        fake.objects.pop("readbox/managed/"+backup_id+".age")
        fake.fail="partial"
        before=fake.upload_calls
        try:adapter.upload(backup_id)
        except r2.R2Error as e:assert e.code=="R2_RETRY_EXHAUSTED"
        else:raise AssertionError("partial failure reported success")
        assert fake.upload_calls-before==3
        fake.fail=None
        # A completed immutable object with a LOST ACK must not be rewritten.
        fake.fail_upload_once=True
        before=fake.upload_calls
        assert adapter.upload(backup_id)["remoteVerified"]
        assert fake.upload_calls-before==1
        assert fake.objects["readbox/managed/"+backup_id+".age"][0]==content
        fake.fail="timeout"
        try:adapter.upload(backup_id)
        except r2.R2Error as e:assert e.code=="R2_RETRY_EXHAUSTED"
        else:raise AssertionError("timed out HEAD accepted")
        fake.fail=None
        fake.objects.pop("readbox/managed/"+backup_id+".age")
        fake.fail="forbidden"
        original_head=fake.head_object
        def forbidden_head(**kwargs):raise S3Failure(403)
        fake.head_object=forbidden_head
        before=fake.upload_calls
        try:adapter.upload(backup_id)
        except r2.R2Error as e:assert e.code=="R2_UPLOAD_FAILED"
        else:raise AssertionError("403 incorrectly retried")
        assert fake.upload_calls==before
        fake.head_object=original_head
        fake.fail=None
        # Pagination must reach objects AFTER the first 100, then bound UI to 30.
        for number in range(122):
            ident=("%032x"%(number+4096))
            fake.objects["readbox/managed/"+ident+".age"]=(b"x",{"sha256":"x"*64})
        fake.pages=0
        history=adapter.list_remote()
        assert fake.pages>=2 and len(history)==30
        assert history[0]["backupId"]==("%032x"%(121+4096))
        assert all(x["state"]=="remote_object_present" for x in history)
        # Never lie about a partial list after broken S3 pagination.
        fake.bad_page_token=True
        try:adapter.list_remote()
        except r2.R2Error as e:assert e.code=="R2_PAGE_INVALID"
        else:raise AssertionError("invalid continuation accepted")
        fake.bad_page_token=False
        fake.objects.clear()
        bad={"accountId":"https://127.0.0.1","bucket":"readbox-private",
             "accessKeyId":key,"secretAccessKey":secret}
        try:adapter.configure(bad)
        except r2.R2Error as e:assert e.code=="R2_CONFIG_INVALID"
        else:raise AssertionError("SSRF endpoint accepted")
        # Ambiguous PUT success must clean only its exact randomized health key.
        fake.put_ack_lost=True
        try:adapter.test()
        except r2.R2Error as e:assert e.code=="R2_CONNECTION_FAILED"
        else:raise AssertionError("lost PUT acknowledgement treated as success")
        assert fake.objects=={}, "health probe orphan after lost PUT ACK"
        fake.cleanup_failed=True
        try:adapter.test()
        except r2.R2Error as e:assert e.code=="R2_PROBE_CLEANUP_FAILED"
        else:raise AssertionError("temporary object cleanup failure ignored")
        fake.cleanup_failed=False
        assert calls and all(v.startswith("https://") for v in calls)
        print("BR03_R2_ENCRYPTED_CREDENTIALS_ROTATION_TLS_UPLOAD_DIGEST_CONFLICT_PARTIAL_PASS")
    finally:
        boto3.client=original
`;
  const p = spawnSync("python3", ["-c", program], { encoding: "utf8", timeout: 30_000 });
  assert.equal(p.status, 0, (p.stderr ?? "").slice(-2500));
  assert.match(p.stdout, /BR03_R2_ENCRYPTED_CREDENTIALS_ROTATION_TLS_UPLOAD_DIGEST_CONFLICT_PARTIAL_PASS/);
});
