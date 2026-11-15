import {
  completeSetupStep,
  INITIAL_SETUP_PROGRESS,
  isSetupComplete,
  SETUP_STEPS,
} from "@/core/setup/progress";
import assert from "node:assert/strict";
import test from "node:test";

test("setup milestones advance only in order", () => {
  let progress = INITIAL_SETUP_PROGRESS;

  assert.deepEqual(SETUP_STEPS, [
    "environment-validated",
    "database-availability-verified",
    "database-verified",
    "schema-verified",
    "administrator-created",
    "completion-verified",
  ]);
  assert.equal(completeSetupStep(progress, "database-verified"), null);

  for (const step of SETUP_STEPS) {
    const nextProgress = completeSetupStep(progress, step);
    assert.ok(nextProgress);
    progress = nextProgress;
  }

  assert.equal(isSetupComplete(progress), true);
});

test("replayed completed milestones are idempotent", () => {
  const afterEnvironment = completeSetupStep(
    INITIAL_SETUP_PROGRESS,
    "environment-validated",
  );
  assert.ok(afterEnvironment);

  assert.strictEqual(
    completeSetupStep(afterEnvironment, "environment-validated"),
    afterEnvironment,
  );
  assert.equal(isSetupComplete(afterEnvironment), false);
});

test("setup cannot complete before final verification", () => {
  const beforeCompletion = { completedSteps: SETUP_STEPS.length - 1 };

  assert.equal(isSetupComplete(beforeCompletion), false);
  assert.deepEqual(completeSetupStep(beforeCompletion, "completion-verified"), {
    completedSteps: SETUP_STEPS.length,
  });
});

test("malformed progress values fail closed", () => {
  assert.equal(completeSetupStep(null, "environment-validated"), null);
  assert.equal(completeSetupStep(undefined, "environment-validated"), null);
  assert.equal(completeSetupStep("invalid", "environment-validated"), null);
  assert.equal(isSetupComplete(null), false);
  assert.equal(isSetupComplete(undefined), false);
  assert.equal(isSetupComplete("invalid"), false);
  assert.equal(
    completeSetupStep({ completedSteps: -1 }, "environment-validated"),
    null,
  );
  assert.equal(
    completeSetupStep(
      { completedSteps: 1.5 },
      "database-availability-verified",
    ),
    null,
  );
  assert.equal(
    completeSetupStep(
      INITIAL_SETUP_PROGRESS,
      "unknown-step" as (typeof SETUP_STEPS)[number],
    ),
    null,
  );
  assert.equal(isSetupComplete({ completedSteps: Number.NaN }), false);
});
