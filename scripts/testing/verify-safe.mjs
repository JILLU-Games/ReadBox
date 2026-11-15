import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import process, { stderr, stdout } from "node:process";

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  stderr.write("[verify:safe] FAILED: npm did not provide its CLI path\n");
  process.exit(1);
}

const checks = [
  {
    label: "database-independent tests",
    command: process.execPath,
    args: [npmCli, "run", "test:unit"],
  },
  {
    label: "TypeScript (no emit)",
    command: process.execPath,
    args: [resolve("node_modules/typescript/bin/tsc"), "--noEmit"],
  },
  {
    label: "ESLint",
    command: process.execPath,
    args: [resolve("node_modules/eslint/bin/eslint.js"), "."],
  },
  {
    label: "Prisma schema validation",
    command: process.execPath,
    args: [resolve("node_modules/prisma/build/index.js"), "validate"],
  },
];

for (const check of checks) {
  stdout.write(`\n[verify:safe] ${check.label}\n`);
  const result = spawnSync(check.command, check.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });

  if (result.error || result.status !== 0) {
    const status = result.status ?? 1;
    stderr.write(`[verify:safe] FAILED: ${check.label} (exit ${status})\n`);
    process.exit(status);
  }

  stdout.write(`[verify:safe] PASS: ${check.label}\n`);
}

stdout.write("[verify:safe] COMPLETE\n");
