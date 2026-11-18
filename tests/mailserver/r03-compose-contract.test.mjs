import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path) => readFileSync(path, "utf8");
const compose = read("docker-compose.yml");
const postfix = read("deployment/mailserver/postfix/main.cf.tpl");
const dovecot = read("deployment/templates/dovecot/99-vibmail.conf.tpl");
const master = read("deployment/mailserver/postfix/master.cf");
test("R03 default stack still opt-in; SMTP loopback, Dovecot private and persisted queue", () => {
  assert.equal((compose.match(/profiles: \["mailserver"\]/g) ?? []).length, 2);
  assert.match(compose, /SMTP_BIND_ADDRESS:-127\.0\.0\.1/);
  assert.match(compose, /SMTP_PUBLISHED_PORT:-25/);
  assert.ok(compose.includes("readbox_postfix_queue:/var/spool/postfix"));
  assert.ok(compose.includes("readbox_vmail:/var/vmail"));
  assert.match(compose, /dovecot:[\s\S]*?expose:\s*\n\s*- "24"/);
  assert.doesNotMatch(compose.split("  postgres:\n")[1].split("\n  web:\n")[0], /\n\s+ports:\n/);
  assert.match(compose, /postfix-db-credential:/);
});
test("R03 inbound-only Postfix validates recipients and does not relay outbound", () => {
  assert.match(postfix, /virtual_mailbox_domains = proxy:pgsql:/);
  assert.match(postfix, /virtual_mailbox_maps = proxy:pgsql:/);
  assert.match(postfix, /virtual_alias_maps = proxy:pgsql:/);
  assert.match(postfix, /virtual_transport = lmtp:inet:dovecot:24/);
  assert.match(postfix, /reject_unauth_destination/);
  assert.match(postfix, /reject_unlisted_recipient/);
  assert.match(postfix, /default_transport = error:ReadBox inbound-only/);
  assert.match(postfix, /smtpd_sasl_auth_enable = no/);
  assert.match(postfix, /smtpd_tls_security_level = may/);
  assert.doesNotMatch(master, /^(submission|smtps)\s+inet\s+/m);
});
test("R03 Dovecot LMTP uses 1001 identity and cannot expose IMAP/POP3", () => {
  assert.match(dovecot, /^protocols = lmtp$/m);
  assert.match(dovecot, /mail_uid = \{\{VMAIL_UID\}\}/);
  assert.match(dovecot, /mail_gid = \{\{VMAIL_GID\}\}/);
  assert.match(dovecot, /port = 24/);
  assert.doesNotMatch(dovecot, /^protocols = .*imap|^protocols = .*pop3/m);
});
test("R03 TLS startup refuses absent or mismatched certificates and secret misconfiguration", () => {
  const script = read("deployment/mailserver/postfix/entrypoint.sh");
  assert.match(script, /fullchain\.pem/);
  assert.match(script, /privkey\.pem/);
  assert.match(script, /-checkhost/);
  assert.match(script, /-checkend/);
  assert.match(script, /Postfix DB secret must be 24\+/);
  assert.match(script, /postfix check/);
});
