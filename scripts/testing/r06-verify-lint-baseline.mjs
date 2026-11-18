#!/usr/bin/env node
/**
 * R-06 does NOT edit earlier R-04 application source outside its Scope Lock.
 * A full-file lint exception is allowed ONLY when the existing two unused
 * catch variables are still exactly present at the documented locations.
 * Any additional/moved violation fails the CI gate.
 */
import { spawnSync } from "node:child_process";
import process from "node:process";
import { readFileSync } from "node:fs";
const path = "src/core/setup/trusted-operations.ts";
const file = readFileSync(path, "utf8");
if (!file.includes("catch (err)") ||
    file.split("catch (err)").length - 1 !== 2) {
  throw new Error("R06 documented R04 lint baseline has changed.");
}
const result = spawnSync(process.execPath, [
  "node_modules/eslint/bin/eslint.js", path, "--format", "json",
], { encoding: "utf8", maxBuffer: 1024 * 1024 });
if (result.status !== 1 || result.error) {
  throw new Error("R06 expected exactly two pre-existing lint findings.");
}
let data;
try { data = JSON.parse(result.stdout); }
catch { throw new Error("R06 scoped lint baseline JSON invalid."); }
const problems = data.flatMap((x) => x.messages).filter((x) => x.severity === 2);
const expected = [366, 386];
if (problems.length !== 2 ||
    problems.some((p, i) => p.ruleId !== "@typescript-eslint/no-unused-vars" ||
      p.line !== expected[i] || !p.message.includes("'err' is defined"))) {
  throw new Error("R06 unexpected lint violations or altered historical baseline.");
}
process.stdout.write("R06_PREEXISTING_R04_LINT_2_OPEN_NO_SOURCE_EXCEPTION\n");
