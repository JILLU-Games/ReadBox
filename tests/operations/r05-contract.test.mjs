import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const get = p => readFileSync(p,"utf8");
test("R05 legacy host backup excludes plaintext configuration and explicitly freezes running mail writers",()=>{
 const s=get("scripts/ops/backup.sh");
 assert.match(s,/CONFIGURATION_EXCLUDED\.txt/);
 assert.doesNotMatch(s,/tar --acls --xattrs --numeric-owner -C \/ \\\n\s+-czf "\$DEST\/configuration\.tar\.gz" "\$\{CONFIG_PATHS\[@\]\}"/);
 assert.match(s,/systemctl stop "\$service\.service"/);
 assert.match(s,/refusing inconsistent backup/);
});
test("R05 host restore preserves numeric file identity and ACLs instead of rewiring all owners",()=>{
 const s=get("scripts/ops/restore.sh");
 assert.match(s,/--acls --xattrs --same-owner --numeric-owner/);
 assert.doesNotMatch(s,/chown -R vmail:vmail/);
 assert.match(s,/historic configuration archives may contain plaintext secrets/);
 assert.match(s,/--confirm-restore/);
});
test("R05 host upgrade saves rollback before mutation and never advertises no-SMTP-downtime",()=>{
 const s=get("scripts/updater/upgrade.sh");
 assert.match(s,/DATA_BACKUP_PATH=/);
 assert.match(s,/MUTATION_STARTED=1/);
 assert.match(s,/rollback\.XXXXXX/);
 assert.match(s,/scripts\/ops\/restore\.sh/);
 assert.match(s,/briefly paused during pre-upgrade consistent snapshot/);
 assert.doesNotMatch(s,/while keeping Postfix and Dovecot active/);
});
test("R05 encrypted Compose recovery validates integrity and requires explicitly confirmed restore",()=>{
 const s=get("deployment/operations/compose_recovery.py");
 assert.match(s,/--confirm-restore/);
 assert.match(s,/--confirm-maintenance/);
 assert.match(s,/config_and_secret_files_included/);
 assert.match(s,/SHA256SUMS/);
 assert.match(s,/R05_AUTOMATIC_ROLLBACK_PASS/);
 assert.match(s,/--acls/);
 assert.match(s,/--xattrs/);
 assert.match(s,/--numeric-owner/);
 assert.match(s,/age/);
});
test("R05 canonical source repo and container-managed updater fail-closed boundary",()=>{
 const s=get("src/core/updates/service.ts");
 const python=get("scripts/updater/update_worker.py");
 assert.match(s,/vibtoolshq\/ReadBox/);
 assert.match(python,/vibtoolshq\/ReadBox/);
 assert.match(s,/container orchestrator update policy/);
});
test("R05 systemd host templates reference ReadBox paths rather than Vibmail paths",()=>{
 for(const p of ["deployment/templates/systemd/vibmail-web.service.tpl","deployment/templates/systemd/vibmail-ingestion.service.tpl","deployment/templates/systemd/vibmail-updater.service.tpl"]){
  const s=get(p);
  assert.match(s,/\/opt\/readbox\/app/);
  assert.doesNotMatch(s,/\/opt\/vibmail\/app|\/etc\/vibmail|\/run\/vibmail/);
 }
});
