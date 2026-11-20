import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SAME = "a".repeat(40);
const OTHER = "b".repeat(40);

test("AU-PARITY host uses exactly three approved refs, refuses missing/invalid/mismatched or inaccessible", () => {
  const python = [
    "import importlib.util",
    "from unittest import mock",
    "spec=importlib.util.spec_from_file_location('host','scripts/updater/compose_host_worker.py')",
    "host=importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(host)",
    "refs=host.TRUSTED_UPDATE_REFS",
    "assert refs == (('https://github.com/vibtoolshq/ReadBox.git','refs/heads/main'),('https://github.com/JILLU-Games/ReadBox.git','refs/heads/backup/dns-final-primary-20261119'),('https://github.com/MdNurnobi-Dev/ReadBox.git','refs/heads/backup/dns-final-primary-20261119'))",
    "assert host.ALLOWED_REPOS == (refs[0][0],refs[1][0])",
    "sha='a'*40",
    "def verify(values,failed=None):",
    "  visited=[]",
    "  def fake_run(argv,timeout=20):",
    "    assert argv[:3]==['git','ls-remote','--exit-code']",
    "    pair=(argv[3],argv[4])",
    "    assert pair in refs",
    "    i=refs.index(pair)",
    "    visited.append(pair)",
    "    if failed==i: raise RuntimeError('NO_ACCESS')",
    "    return values[i]+'\\t'+pair[1] if values[i] else ''",
    "  with mock.patch.object(host,'run',side_effect=fake_run):",
    "    try: return True,host.remote_main_refs(),tuple(visited)",
    "    except RuntimeError: return False,None,tuple(visited)",
    "ok,value,seen=verify([sha]*3)",
    "assert ok and value==sha and seen==refs",
    "for i in range(3):",
    "  for bad in ['b'*40,'bad','']:",
    "    values=[sha]*3",
    "    values[i]=bad",
    "    assert not verify(values)[0]",
    "  assert not verify([sha]*3,failed=i)[0]",
    "print('AU_PARITY_HOST_THREE_REF_PASS')",
  ].join("\n");
  const out=spawnSync("python3",["-c",python],{encoding:"utf8"});
  assert.equal(out.status,0,out.stderr || out.stdout);
  assert.match(out.stdout,/AU_PARITY_HOST_THREE_REF_PASS/);
});

test("AU-PARITY pinned shell gate rejects all bad refs before backup", () => {
  const source=readFileSync("scripts/install/readbox-update.sh","utf8");
  const start=source.indexOf("# AU-PARITY-01: pinned Primary main and both dedicated backup refs.");
  const end=source.indexOf('before="$(git rev-parse HEAD)"',start);
  assert.ok(start>=0 && end>start);
  const gate=source.slice(start,end);
  assert.equal(gate.split("refs/heads/backup/dns-final-primary-20261119").length-1,2);
  assert.doesNotMatch(gate,/compose_recovery\.py|git merge|docker compose up/);
  const mock=[
    "set -Eeuo pipefail",
    "git() {",
    ' [[ "$1" == "ls-remote" && "$2" == "--exit-code" && "$#" == 4 ]] || return 80',
    ' case "$3" in',
    ' https://github.com/vibtoolshq/ReadBox.git)',
    '   [[ "$4" == "refs/heads/main" ]] || return 81',
    '   [[ "$BLOCK_REPO" != source ]] || return 2',
    '   printf "%s\\t%s\\n" "$SOURCE_SHA" "$4" ;;',
    ' https://github.com/JILLU-Games/ReadBox.git)',
    '   [[ "$4" == "refs/heads/backup/dns-final-primary-20261119" ]] || return 82',
    '   [[ "$BLOCK_REPO" != jillu ]] || return 2',
    '   printf "%s\\t%s\\n" "$JILLU_SHA" "$4" ;;',
    ' https://github.com/MdNurnobi-Dev/ReadBox.git)',
    '   [[ "$4" == "refs/heads/backup/dns-final-primary-20261119" ]] || return 83',
    '   [[ "$BLOCK_REPO" != md ]] || return 2',
    '   printf "%s\\t%s\\n" "$MD_SHA" "$4" ;;',
    ' *) return 84 ;;',
    ' esac',
    '}',
  ].join("\n");
  const script=mock+"\n"+gate+"\necho AU_PARITY_SHELL_PASS\n";
  const run=(change,shouldPass)=>{
    const env={...process.env,READBOX_UPDATE_REQUIRE_PARITY:"1",READBOX_UPDATE_TARGET_SHA:SAME,SOURCE_SHA:SAME,JILLU_SHA:SAME,MD_SHA:SAME,BLOCK_REPO:"",...change};
    const out=spawnSync("bash",["-c",script],{encoding:"utf8",env});
    if(shouldPass){assert.equal(out.status,0,out.stderr);assert.match(out.stdout,/AU_PARITY_SHELL_PASS/);}
    else{assert.notEqual(out.status,0,out.stdout);assert.doesNotMatch(out.stdout,/AU_PARITY_SHELL_PASS/);}
  };
  run({},true);
  for(const key of ["SOURCE_SHA","JILLU_SHA","MD_SHA"]){
    for(const value of [OTHER,"bad",""])run({[key]:value},false);
  }
  for(const target of ["source","jillu","md"])run({BLOCK_REPO:target},false);
  run({READBOX_UPDATE_TARGET_SHA:""},false);
  run({READBOX_UPDATE_TARGET_SHA:"bad"},false);
});

test("AU-PARITY keeps root authorization, maintenance lock, encrypted backup and no destructive rollback",()=>{
  const host=readFileSync("scripts/updater/compose_host_worker.py","utf8");
  const sh=readFileSync("scripts/install/readbox-update.sh","utf8");
  assert.match(host,/SO_PEERCRED/);
  assert.match(host,/compare_digest/);
  assert.match(host,/READBOX_UPDATE_REQUIRE_PARITY/);
  assert.match(sh,/BR04_ACTIVE_BACKUP_OR_RESTORE_UPDATE_REFUSED/);
  assert.match(sh,/compose_recovery\.py backup/);
  assert.match(sh,/git merge --ff-only/);
  assert.doesNotMatch(sh,/git reset --hard|docker compose down -v|docker volume rm/);
});
