import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const template = readFileSync("deployment/templates/nginx/app.conf.tpl", "utf8");

function inspectNginx(input) {
  const rendered = input
    .replaceAll("{{APP_HOSTNAME}}", "app.readbox.invalid")
    .replaceAll("{{CERT_NAME}}", "app.readbox.invalid");
  assert.doesNotMatch(rendered, /\{\{|\}\}/, "no unresolved placeholders");
  assert.doesNotMatch(rendered, /vibmail/i, "no legacy host identifiers");
  assert.match(rendered, /^\s*upstream readbox_web\s*\{/m);
  assert.match(rendered, /^\s*server 127\.0\.0\.1:3000 fail_timeout=0;$/m);
  const destinations = [...rendered.matchAll(/\bproxy_pass\s+http:\/\/([^;\s]+);/g)]
    .map((match) => match[1]);
  assert.deepEqual(destinations, ["readbox_web", "readbox_web", "readbox_web"]);
  assert.match(rendered, /^\s*ssl_session_cache shared:READBOXTLS:10m;$/m);
  assert.match(rendered, /^\s*access_log \/var\/log\/readbox\/nginx-access\.log;$/m);
  assert.match(rendered, /^\s*error_log \/var\/log\/readbox\/nginx-error\.log warn;$/m);
  assert.match(rendered, /^\s*location \/_protected_attachments\/ \{$/m);
  assert.match(rendered, /^\s*internal;$/m);
  assert.match(rendered, /^\s*alias \/var\/lib\/readbox\/attachments\/;$/m);
  assert.match(rendered, /^\s*ssl_protocols TLSv1\.2 TLSv1\.3;$/m);
  assert.match(rendered, /^\s*ssl_reject_handshake on;$/m);
  assert.match(rendered, /^\s*deny all;$/m);
  assert.equal((rendered.match(/location = \/health\/ready\/? \{/g) ?? []).length, 2);

  // Read-only structural parsing; not an nginx -t on a real host.
  let level = 0;
  for (const character of rendered) {
    if (character === "{") level += 1;
    if (character === "}") level -= 1;
    assert.ok(level >= 0, "unmatched nginx closing brace");
  }
  assert.equal(level, 0, "unclosed nginx block");
}

test("NEXT-02 rendered host template retains routing, TLS and security contract", () => {
  inspectNginx(template);
});

test("NEXT-02 negative: legacy upstream/log paths and unrelated proxy fail", () => {
  assert.throws(() => inspectNginx(template.replace("upstream readbox_web", "upstream vibmail_web")));
  assert.throws(() => inspectNginx(template.replace("/var/log/readbox/", "/var/log/vibmail/")));
  assert.throws(() => inspectNginx(template.replace("proxy_pass http://readbox_web;",
    "proxy_pass http://unauthorized_host;")));
});

test("NEXT-02 negative: malformed template, missing internal attachment guard fail", () => {
  assert.throws(() => inspectNginx(template + "\n}"));
  assert.throws(() => inspectNginx(template.replace("    internal;", "    # internal removed;")));
});
