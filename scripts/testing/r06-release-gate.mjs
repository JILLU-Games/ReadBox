#!/usr/bin/env node
/**
 * R-06: read-only, fail-closed production release gate recorder.
 * A passing GitHub CI is NEVER production deployment approval.
 * Private staging evidence is reviewed by an authorized human offline.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL, URL } from "node:url";
import process from "node:process";

export const GATE_IDS = Object.freeze(Array.from({ length: 17 }, (_, i) =>
  "RG-" + String(i + 1).padStart(2, "0")));

const IDENTIFIER = /^RB-P[012]-\d{2}$/;
const SHA = /^[0-9a-f]{40}$/;

export function parseLedger(content) {
  const matches = [...content.matchAll(/^### (RB-P[012]-\d{2}) —/gm)];
  const ids = matches.map((m) => m[1]);
  if (ids.length !== 32 || new Set(ids).size !== 32) {
    throw new Error("The 32 finding IDs are not uniquely reconciled.");
  }
  let open = 0;
  const openIds = [];
  for (let i = 0; i < matches.length; i++) {
    const id = ids[i];
    if (!IDENTIFIER.test(id)) throw new Error("Invalid finding ID.");
    const start = matches[i].index;
    const end = matches[i + 1]?.index ?? content.length;
    const block = content.slice(start, end);
    const state = block.match(/\*\*Current state:\*\* ([^\n]+)/)?.[1];
    if (!state) throw new Error("Original finding lacks a current state: " + id);
    if (state.startsWith("OPEN")) { open++; openIds.push(id); }
    else if (!/CI VERIFIED|VERIFIED CLOSED|VERIFIED/.test(state)) {
      throw new Error("Unsupported historical finding state: " + id);
    }
  }
  return { original: ids.length, verified: ids.length - open, open, openIds };
}

export function checkProvenance({ rootLicense, referenceLicense, referenceNotice, dockerignore }) {
  return (
    rootLicense.startsWith("MIT License\n") &&
    referenceLicense.includes("GNU AFFERO GENERAL PUBLIC LICENSE") &&
    referenceNotice.includes("AGPL-3.0-or-later") &&
    referenceNotice.includes("MailStack") &&
    dockerignore.split(/\r?\n/).some((s) => s.trim() === "reference")
  );
}

function validEvidenceUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !!url.hostname && !url.username && !url.password && !url.hash &&
      !/token=|key=|password=|secret=/i.test(url.search);
  } catch { return false; }
}

export function parseStagingEvidence(payload, expectedSha, now = new Date()) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
      payload.schema_version !== 1 || payload.environment !== "staging" ||
      payload.target_sha !== expectedSha || !SHA.test(expectedSha) ||
      !Array.isArray(payload.gates)) {
    throw new Error("Staging evidence format, environment or SHA mismatch.");
  }
  const entries = new Map();
  for (const value of payload.gates) {
    if (!value || typeof value !== "object" ||
        !GATE_IDS.includes(value.id) || entries.has(value.id) ||
        !["PASS", "FAIL", "NOT_RUN"].includes(value.status)) {
      throw new Error("Staging evidence has missing, duplicate or invalid gate IDs.");
    }
    if (value.status === "PASS") {
      if (!validEvidenceUrl(value.evidence_url) ||
          typeof value.observer !== "string" ||
          !/^[A-Za-z0-9][A-Za-z0-9 ._-]{2,80}$/.test(value.observer) ||
          typeof value.observed_at !== "string" ||
          !/^\d{4}-\d{2}-\d{2}T/.test(value.observed_at)) {
        throw new Error("A PASS claim must contain a sanitized external reference and operator timestamp.");
      }
      const timestamp = new Date(value.observed_at);
      if (!Number.isFinite(timestamp.valueOf()) ||
          timestamp > now || timestamp < new Date("2026-01-01T00:00:00Z")) {
        throw new Error("Invalid or future evidence time.");
      }
    }
    entries.set(value.id, value.status);
  }
  return entries;
}

export function evaluateReleaseGate({ ledger, provenanceOk, staging = null }) {
  const missing = GATE_IDS.filter((id) => staging?.get(id) !== "PASS");
  const blockers = [];
  if (ledger.original !== 32) blockers.push("UNRECONCILED_FINDINGS");
  if (ledger.open > 0) blockers.push("ORIGINAL_FINDINGS_OPEN");
  if (!provenanceOk) blockers.push("PROVENANCE_NOT_VERIFIED");
  if (missing.length > 0) blockers.push("STAGING_GATES_NOT_PASS");
  const candidate = blockers.length === 0;
  return {
    status: candidate ? "MANUAL_RELEASE_REVIEW_REQUIRED" : "NO_GO",
    production_deployed: false,
    production_release_authorized: false,
    automated_publish_enabled: false,
    findings: ledger,
    gate_count: GATE_IDS.length,
    gate_pass_claim_count: staging ? GATE_IDS.filter((id) => staging.get(id) === "PASS").length : 0,
    missing_gates: missing,
    blockers: candidate ? ["EXPLICIT_HUMAN_RELEASE_APPROVAL_REQUIRED"] : blockers,
    note: "External URLs and submitted PASS claims are NOT independently verified by this tool. Human review and separate authorization required.",
  };
}

export function validateFormalGateDefinitions(content) {
  const ids = [...content.matchAll(/^\| (RG-\d{2}) \|/gm)].map((m) => m[1]);
  if (ids.length !== GATE_IDS.length || new Set(ids).size !== GATE_IDS.length ||
      GATE_IDS.some((id) => !ids.includes(id))) {
    throw new Error("One or more original RG-01..RG-17 gates are missing.");
  }
  return true;
}

function readRepo(path) { return readFileSync(path, "utf8"); }

export function currentReport({ root = ".", stagingData = null, expectedSha, now = new Date() }) {
  const ledger = parseLedger(readRepo(root + "/notes/001-PRODUCTION-RELEASE-BLOCKERS.md"));
  validateFormalGateDefinitions(readRepo(root + "/notes/006-VERIFICATION-AND-RELEASE-GATES.md"));
  const provenanceOk = checkProvenance({
    rootLicense: readRepo(root + "/LICENSE"),
    referenceLicense: readRepo(root + "/reference/MailStack/LICENSE"),
    referenceNotice: readRepo(root + "/reference/MailStack/NOTICE.md"),
    dockerignore: readRepo(root + "/.dockerignore"),
  });
  const staging = stagingData == null ? null :
    parseStagingEvidence(stagingData, expectedSha, now);
  return evaluateReleaseGate({ ledger, provenanceOk, staging });
}

function run() {
  const args = process.argv.slice(2);
  const ci = args.includes("--ci");
  const requireLive = args.includes("--require-live");
  const idx = args.indexOf("--evidence");
  const outputIdx = args.indexOf("--output");
  if (args.some((arg, index) =>
    !["--ci", "--require-live", "--evidence", "--output"].includes(arg) &&
    !((idx >= 0 && index === idx + 1) || (outputIdx >= 0 && index === outputIdx + 1))) ||
    (idx >= 0 && !args[idx + 1]) ||
    (outputIdx >= 0 && !args[outputIdx + 1]) ||
    (ci && idx >= 0) ||
    (ci && requireLive)) {
    throw new Error("Invalid mode; CI cannot accept staging claims.");
  }
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (!SHA.test(sha)) throw new Error("Git HEAD must be a complete source SHA.");
  const stagingData = idx >= 0 ? JSON.parse(readFileSync(args[idx + 1], "utf8")) : null;
  const report = currentReport({ expectedSha: sha, stagingData });
  const sanitized = JSON.stringify({ ...report, verified_sha: sha }, null, 2) + "\n";
  if (outputIdx >= 0) writeFileSync(args[outputIdx + 1], sanitized, { flag: "wx", mode: 0o600 });
  process.stdout.write(
    "R06_17_GATE_RECONCILIATION_PASS\n" +
    "R06_LICENSE_PROVENANCE_CONTRACT_PASS\n" +
    "R06_PRODUCTION_" + report.status + "\n" +
    "R06_SHA=" + sha + "\n" +
    "R06_FINDINGS_OPEN=" + report.findings.open + "\n" +
    "R06_LIVE_GATE_PASS_CLAIMS=" + report.gate_pass_claim_count + "/17\n"
  );
  if (requireLive && report.status === "NO_GO") process.exitCode = 3;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { run(); }
  catch {
    // NEVER print raw evidence, URL, token, or secret in a public CI log.
    process.stderr.write("R06_RELEASE_GATE_BLOCKED: invalid or untrusted evidence; details withheld.\n");
    process.exitCode = 2;
  }
}
