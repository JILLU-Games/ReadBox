import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json"));
const compose = read("docker-compose.yml");
const dockerfile = read("Dockerfile");
const readme = read("README.md");

test("default Compose is production app (development file is opt-in)", () => {
  assert.equal(existsSync(new URL("../../compose.yaml", import.meta.url)), false);
  assert.equal(existsSync(new URL("../../compose.dev.yaml", import.meta.url)), true);
  assert.match(read("compose.dev.yaml"), /DEVELOPMENT ONLY/);
  assert.match(compose, /web:\n/);
  assert.match(compose, /worker:\n/);
  assert.match(compose, /postgres:\n/);
  assert.match(pkg.scripts["db:up"], /-f compose\.dev\.yaml/);
  assert.match(pkg.scripts["db:down"], /-f compose\.dev\.yaml/);
});

test("secrets are explicitly required, with URL building in runtime", () => {
  assert.match(compose, /SERVICE_PASSWORD_DB:\?/);
  assert.match(compose, /SERVICE_BASE64_64_SECRET:\?/);
  assert.doesNotMatch(compose, /DATABASE_URL:\s*postgresql:\/\//);
  assert.equal((compose.match(/READBOX_DB_PASSWORD: /g) || []).length, 2);
  assert.match(dockerfile, /url\.password = encodeURIComponent\(password\)/);
  assert.match(dockerfile, /password\.length < 24/);
  assert.match(dockerfile, /AUTH_SECRET/);
  assert.match(dockerfile, /readbox-start\.sh/);
});

test("dependencies and runtime generation are reproducibly rooted in npm lockfile", () => {
  assert.equal(pkg.dependencies.next, "16.4.5");
  assert.equal(pkg.overrides["fast-uri"], "3.1.9");
  for (const dep of ["tsx", "prisma", "dotenv"]) {
    assert.ok(pkg.dependencies[dep], dep + " must be installed in runtime");
    assert.equal(pkg.devDependencies[dep], undefined);
  }
  assert.match(dockerfile, /npm ci --no-audit --no-fund/);
  assert.match(dockerfile, /npm prune --omit=dev/);
  assert.doesNotMatch(dockerfile, /npm install --no-save/);
  assert.match(dockerfile, /FROM node:22-alpine@sha256:[a-f0-9]{64} AS base/);
});

test("README keeps production mailserver boundaries and no legacy secret names", () => {
  assert.match(readme, /Postfix\/Dovecot/);
  assert.match(readme, /compose\.dev\.yaml/);
  assert.match(readme, /SERVICE_BASE64_64_SECRET/);
  assert.doesNotMatch(readme, /NEXTAUTH_SECRET/);
  assert.doesNotMatch(readme, /Next\.js 15/);
});
