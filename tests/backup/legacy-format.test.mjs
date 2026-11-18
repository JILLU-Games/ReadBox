import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
test("BR04 legacy GPG never accepted as age snapshot or silently converted", () => {
  const program=String.raw`
import sys
from pathlib import Path
sys.path.insert(0,"deployment/backup-agent")
from legacy_gpg import unsupported_legacy,ensure_age_managed
for suffix in (".gpg",".pgp",".asc"):
    assert unsupported_legacy("20261117.tar.gz"+suffix)
    try:ensure_age_managed(Path("20261117.tar.gz"+suffix))
    except ValueError as e:assert str(e)=="LEGACY_GPG_RESTORE_NOT_SUPPORTED"
    else:raise AssertionError("Legacy GPG was accepted")
assert unsupported_legacy("local.age") is False
ensure_age_managed(Path("local.age"))
print("BR04_LEGACY_GPG_NEVER_TREATED_AS_AGE_PASS")
`;
  const p=spawnSync("python3",["-c",program],{encoding:"utf8",timeout:10_000});
  assert.equal(p.status,0,(p.stderr??"").slice(-1800));
  assert.match(p.stdout,/BR04_LEGACY_GPG_NEVER_TREATED_AS_AGE_PASS/);
});
