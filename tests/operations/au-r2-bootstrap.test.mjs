import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, lstatSync, rmSync, chmodSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const bootstrap=readFileSync("scripts/install/readbox-update-bootstrap.sh","utf8");
const guard=readFileSync("scripts/install/readbox-guarded-update.sh","utf8");
const updater=readFileSync("scripts/install/readbox-update.sh","utf8");
const SHA="a".repeat(40), OTHER="b".repeat(40);
const run=(cmd,args,opts={})=>spawnSync(cmd,args,{encoding:"utf8",...opts});

test("fixed three Git refs require exact pinned SHA, reject each missing or mismatched remote",()=>{
  const start=bootstrap.indexOf("read_ref() {");
  const end=bootstrap.indexOf("# Resolve an exact frozen object",start);
  assert.ok(start>0&&end>start);
  const block=bootstrap.slice(start,end);
  assert.equal((block.match(/read_ref https:\/\/github.com\//g)||[]).length,3);
  const setup=[
    "set -Eeuo pipefail",
    'target="$TARGET_SHA"',
    'stop() { printf "STOP:%s\\n" "$1" >&2; exit 2; }',
    'git() {',
    ' [[ "$1" == ls-remote && "$2" == --exit-code ]] || return 10',
    ' case "$3" in',
    ' https://github.com/vibtoolshq/ReadBox.git) [[ "$4" == refs/heads/main ]] || return 11 ;;',
    ' https://github.com/JILLU-Games/ReadBox.git|https://github.com/MdNurnobi-Dev/ReadBox.git) [[ "$4" == refs/heads/backup/dns-final-primary-20261119 ]] || return 12 ;;',
    ' *) return 13 ;;',
    ' esac',
    ' [[ "$3" != "$MISSING" ]] || return 14',
    ' local value="$TARGET_SHA"',
    ' [[ "$3" != "$BAD" ]] || value="$OTHER_SHA"',
    ' printf "%s\\t%s\\n" "$value" "$4"',
    '}',
    block,
    "echo THREE_REF_PASS"
  ].join("\n");
  const check=(bad,missing,pass)=>{
    const out=run("bash",["-c",setup],{env:{...process.env,TARGET_SHA:SHA,OTHER_SHA:OTHER,BAD:bad,MISSING:missing}});
    assert.equal(out.status===0,pass,out.stderr);
    assert.equal(out.stdout.includes("THREE_REF_PASS"),pass);
  };
  check("","",true);
  for(const name of ["https://github.com/vibtoolshq/ReadBox.git",
                      "https://github.com/JILLU-Games/ReadBox.git",
                      "https://github.com/MdNurnobi-Dev/ReadBox.git"]){
    check(name,"",false);
    check("",name,false);
  }
});

test("pinned fetch checks canonical Primary, not mirror origin/main, and rejects mismatched commit",()=>{
  const start=updater.indexOf("# AU-R2-BOOTSTRAP-01: a pinned update");
  const end=updater.indexOf('if [[ "$before" == "$after" ]]',start);
  assert.ok(start>0&&end>start);
  const block=updater.slice(start,end);
  const script=[
    "set -Eeuo pipefail",
    'expected="$EXPECTED"',
    'before="$OLD"',
    'git() {',
    ' if [[ "$1" == -c ]]; then',
    '  [[ "$*" == *"https://github.com/vibtoolshq/ReadBox.git refs/heads/main"* ]] || return 20',
    '  echo CANONICAL >> "$MARKER"',
    ' elif [[ "$1" == fetch ]]; then echo LEGACY >> "$MARKER"',
    ' elif [[ "$1" == rev-parse && "$2" == FETCH_HEAD ]]; then echo "$FETCHED"',
    ' else return 21; fi',
    '}',
    block,
    "echo FETCH_PASS"
  ].join("\n");
  const dir=mkdtempSync(join(tmpdir(),"au-bootstrap-fetch-"));
  try{
    const marker=join(dir,"calls");
    for(const [expected,fetched,passed,method] of [
      [SHA,SHA,true,"CANONICAL"],[SHA,OTHER,false,"CANONICAL"],["",OTHER,true,"LEGACY"]
    ]){
      writeFileSync(marker,"");
      const out=run("bash",["-c",script],{env:{...process.env,EXPECTED:expected,OLD:"c".repeat(40),FETCHED:fetched,MARKER:marker}});
      assert.equal(out.status===0,passed,out.stderr);
      assert.equal(out.stdout.includes("FETCH_PASS"),passed);
      assert.equal(readFileSync(marker,"utf8").trim(),method);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test("disposable old checkout stays clean while verified target Git objects are staged outside",()=>{
  const dir=mkdtempSync(join(tmpdir(),"au-bootstrap-old-"));
  try{
    const root=join(dir,"legacy");mkdirSync(root);
    assert.equal(run("git",["init","-q","-b","main"],{cwd:root}).status,0);
    writeFileSync(join(root,"docker-compose.yml"),"services: {}\n");
    writeFileSync(join(root,"old-updater.sh"),"legacy\n");
    assert.equal(run("git",["add","."],{cwd:root}).status,0);
    const commit=run("git",["-c","user.name=Fixture","-c","user.email=fixture@example.test","commit","-qm","fixture"],{cwd:root});
    assert.equal(commit.status,0,commit.stderr);
    assert.equal(run("git",["status","--porcelain"],{cwd:root}).stdout.trim(),"");
    const stage=join(dir,"private-stage");mkdirSync(stage,{mode:0o700});
    const blob=run("git",["cat-file","blob","HEAD:scripts/install/readbox-update-bootstrap.sh"]);
    assert.equal(blob.status,0,blob.stderr);
    const staged=join(stage,"readbox-update-bootstrap.sh");
    writeFileSync(staged,blob.stdout,{mode:0o600});chmodSync(staged,0o600);
    const hash=run("git",["hash-object","--",staged]).stdout.trim();
    const expected=run("git",["rev-parse","HEAD:scripts/install/readbox-update-bootstrap.sh"]).stdout.trim();
    assert.equal(hash,expected);
    assert.equal(statSync(staged).mode&0o777,0o600);
    assert.equal(run("git",["status","--porcelain"],{cwd:root}).stdout.trim(),"");
    const link=join(stage,"untrusted");symlinkSync(staged,link);
    assert.ok(lstatSync(link).isSymbolicLink());
    assert.match(bootstrap,/! -L "\$entry"/);
    assert.match(guard,/STAGED_SOURCE_FILE_UNSAFE/);
    const invalid=run("git",["cat-file","-e","d".repeat(40)+":scripts/install/readbox-update-bootstrap.sh"]);
    assert.notEqual(invalid.status,0);
    writeFileSync(join(root,"untracked"),"dirty");
    assert.notEqual(run("git",["status","--porcelain"],{cwd:root}).stdout.trim(),"");
    assert.match(bootstrap,/CLEAN_MAIN_REQUIRED/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test("root-only immutable staging, verified R2 receipt and non-force update retain safety guards",()=>{
  assert.match(bootstrap,/git cat-file blob "\$target:\$path"/);
  assert.match(bootstrap,/git hash-object -- "\$STAGE\/\$path"/);
  assert.match(bootstrap,/git merge-base --is-ancestor "\$before" "\$target"/);
  assert.match(bootstrap,/READBOX_AU_STAGE_DIR="\$STAGE" bash/);
  assert.match(bootstrap,/trap 'rm -rf -- "\$STAGE"' EXIT/);
  assert.match(guard,/STAGED_SOURCE_SHA_MISMATCH/);
  assert.match(guard,/bash "\$update_script"/);
  assert.match(updater,/AU_BOOTSTRAP_STAGED_RECEIPT_UNTRUSTED/);
  assert.match(updater,/python3 "\$receipt_helper" attest/);
  for(const code of [bootstrap,guard,updater])
    assert.doesNotMatch(code,/git reset --hard|docker compose down -v|docker volume (?:rm|prune)/);
});

test("OPS-CMD-FIX-01 safe sudo argument boundary and cleanup without executing sudo or VPS commands", () => {
  const doc = readFileSync("docs/ADMIN-SYSTEM-UPDATE.md", "utf8");
  const section = doc.split("## AU-R2-BOOTSTRAP-01 — Canonical pinned Git fetch and private host staging")[1];
  assert.ok(section, "approved operator section must exist");
  const commandLine = section.split("\n").find(s => s.startsWith("sudo bash -c '"));
  assert.ok(commandLine, "exact one-line operator command is required");
  const target = "a".repeat(40);
  const shellCommand = commandLine.replace("AUDITED_TARGET_SHA", target);
  assert.doesNotMatch(shellCommand, /curl\s*\|\s*bash|git reset --hard|docker compose down -v/);
  // Function shadows sudo: only argument parsing, never executes the inner script.
  const capture = [
    'sudo() { printf "argc=%s\\n" "$#"; printf "arg=%s\\n" "$@"; }',
    shellCommand,
  ].join("\n");
  const result = run("bash", ["-c", capture]);
  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.trimEnd().split("\n");
  assert.equal(lines[0], "argc=5", "sudo must receive bash,-c,one script,_,target only");
  const args = lines.slice(1).map(s => s.slice(4));
  assert.equal(args.length, 5);
  assert.deepEqual(args.slice(0, 2), ["bash", "-c"]);
  assert.deepEqual(args.slice(3), ["_", target]);
  const inner = args[2];
  const syntax = run("bash", ["-n", "-c", inner]);
  assert.equal(syntax.status, 0, syntax.stderr);
  assert.match(inner, /https:\/\/github\.com\/vibtoolshq\/ReadBox\.git refs\/heads\/main/);
  assert.match(inner, /git hash-object -- "\$entry"/);
  const trapLine = inner.split("; ").find(s => s.startsWith("trap "));
  assert.equal(trapLine, 'trap "rm -f -- \\"$entry\\"" EXIT');
  const dir = mkdtempSync(join(tmpdir(), "au-bootstrap-trap-"));
  try {
    for (const status of [0, 19]) {
      const entry = join(dir, "mock entry " + status + " with spaces");
      writeFileSync(entry, "disposable-only");
      const isolated = 'set -Eeuo pipefail; entry="$1"; ' + trapLine + "; exit " + status;
      const probe = run("bash", ["-c", isolated, "_", entry]);
      assert.equal(probe.status, status, probe.stderr);
      assert.throws(() => lstatSync(entry), { code: "ENOENT" }, "cleanup must remove exact own entry only");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
