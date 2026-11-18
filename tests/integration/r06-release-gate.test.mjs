import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  GATE_IDS, parseLedger, parseStagingEvidence, checkProvenance,
  evaluateReleaseGate, validateFormalGateDefinitions, currentReport,
} from "../../scripts/testing/r06-release-gate.mjs";

const sha = "f".repeat(40);
const now = new Date("2026-11-17T20:00:00Z");
const item = (id) => ({
  id, status: "PASS", observer: "R06 independent operator",
  observed_at: "2026-11-17T18:00:00Z",
  evidence_url: "https://example.org/staging/private-verification/" + id,
});
const evidence = () => ({
  schema_version: 1, environment: "staging", target_sha: sha,
  gates: GATE_IDS.map(item),
});

test("R06 exact 32 forensic finding ledger (7 open) and all 17 mandatory gates exist", () => {
  const ledger = parseLedger(readFileSync("notes/001-PRODUCTION-RELEASE-BLOCKERS.md", "utf8"));
  assert.equal(ledger.original, 32);
  assert.equal(ledger.open, 7);
  assert.equal(ledger.verified, 25);
  for (const id of ["RB-P0-06", "RB-P1-09", "RB-P1-10", "RB-P1-16",
                    "RB-P2-01", "RB-P2-07", "RB-P2-08"]) {
    assert.ok(ledger.openIds.includes(id), id);
  }
  assert.equal(validateFormalGateDefinitions(
    readFileSync("notes/006-VERIFICATION-AND-RELEASE-GATES.md", "utf8")), true);
});

test("R06 no live proof is always NO_GO even when CI and provenance are good", () => {
  const report = currentReport({ expectedSha: sha });
  assert.equal(report.status, "NO_GO");
  assert.equal(report.production_deployed, false);
  assert.equal(report.production_release_authorized, false);
  assert.equal(report.automated_publish_enabled, false);
  assert.equal(report.missing_gates.length, 17);
  assert.equal(report.findings.open, 7);
  assert.ok(report.blockers.includes("ORIGINAL_FINDINGS_OPEN"));
  assert.ok(report.blockers.includes("STAGING_GATES_NOT_PASS"));
});

test("R06 forged all-PASS input cannot overrule unresolved findings or authorize production", () => {
  const claims = parseStagingEvidence(evidence(), sha, now);
  const result = evaluateReleaseGate({
    ledger: { original: 32, open: 7, verified: 25, openIds: ["RB-P0-06"] },
    provenanceOk: true,
    staging: claims,
  });
  assert.equal(result.status, "NO_GO");
  assert.equal(result.gate_pass_claim_count, 17);
  assert.ok(result.blockers.includes("ORIGINAL_FINDINGS_OPEN"));
  assert.equal(result.production_release_authorized, false);
  assert.equal(result.automated_publish_enabled, false);
  const hypothetical = evaluateReleaseGate({
    ledger: { original: 32, open: 0, verified: 32, openIds: [] },
    provenanceOk: true,
    staging: claims,
  });
  assert.equal(hypothetical.status, "MANUAL_RELEASE_REVIEW_REQUIRED");
  assert.equal(hypothetical.production_release_authorized, false);
});

test("R06 evidence rejects wrong SHA, omitted gates, duplicates and unsafe external URL claims", () => {
  assert.throws(() => parseStagingEvidence(evidence(), "a".repeat(40), now));
  const duplicate = evidence();
  duplicate.gates.push(item("RG-01"));
  assert.throws(() => parseStagingEvidence(duplicate, sha, now));
  const unsupported = evidence();
  unsupported.gates[0].id = "RG-18";
  assert.throws(() => parseStagingEvidence(unsupported, sha, now));
  const token = evidence();
  token.gates[0].evidence_url = "https://user:password@example.com/private";
  assert.throws(() => parseStagingEvidence(token, sha, now));
  const querySecret = evidence();
  querySecret.gates[0].evidence_url = "https://example.org/proof?token=12345";
  assert.throws(() => parseStagingEvidence(querySecret, sha, now));
  const future = evidence();
  future.gates[0].observed_at = "2090-01-01T00:00:00Z";
  assert.throws(() => parseStagingEvidence(future, sha, now));
  const unaudited = evidence();
  unaudited.gates[0].observer = "";
  assert.throws(() => parseStagingEvidence(unaudited, sha, now));
  const wrongEnvironment = evidence();
  wrongEnvironment.environment = "production";
  assert.throws(() => parseStagingEvidence(wrongEnvironment, sha, now));
});

test("R06 incomplete or failed staging record cannot reach manual release review", () => {
  const absent = evidence();
  absent.gates.pop();
  const result = evaluateReleaseGate({
    ledger: { original: 32, open: 0, verified: 32, openIds: [] },
    provenanceOk: true,
    staging: parseStagingEvidence(absent, sha, now),
  });
  assert.equal(result.status, "NO_GO");
  assert.deepEqual(result.missing_gates, ["RG-17"]);
  const failure = evidence();
  failure.gates[0].status = "FAIL";
  assert.equal(evaluateReleaseGate({
    ledger: { original: 32, open: 0, verified: 32, openIds: [] },
    provenanceOk: true,
    staging: parseStagingEvidence(failure, sha, now),
  }).status, "NO_GO");
});

test("R06 root MIT and historical MailStack AGPL files must both remain intact", () => {
  assert.equal(checkProvenance({
    rootLicense: readFileSync("LICENSE", "utf8"),
    referenceLicense: readFileSync("reference/MailStack/LICENSE", "utf8"),
    referenceNotice: readFileSync("reference/MailStack/NOTICE.md", "utf8"),
    dockerignore: readFileSync(".dockerignore", "utf8"),
  }), true);
  assert.equal(checkProvenance({
    rootLicense: readFileSync("LICENSE", "utf8"),
    referenceLicense: "",
    referenceNotice: "MailStack",
    dockerignore: "reference\n",
  }), false);
});
