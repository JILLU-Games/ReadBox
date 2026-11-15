import {
  applySetupLifecyclePlan,
  coordinateSetupLifecycleTransition,
  INITIAL_SETUP_LIFECYCLE,
  isSetupLifecycleState,
  planSetupLifecycleTransition,
  type SetupLifecycleState,
} from "@/core/setup/lifecycle";
import { SETUP_STEPS } from "@/core/setup/progress";
import assert from "node:assert/strict";
import test from "node:test";

function begin(state = INITIAL_SETUP_LIFECYCLE, transitionId = "transition-1") {
  return planSetupLifecycleTransition(state, {
    action: "begin",
    transitionId,
    expectedRevision: state.revision,
    operationId: "operation-1",
  });
}

function startedState(): SetupLifecycleState {
  const result = begin();
  assert.equal(result.kind, "planned");
  if (result.kind !== "planned") throw new Error("expected planned transition");
  return result.nextState;
}

test("lifecycle coordinator applies a valid transition", () => {
  const result = coordinateSetupLifecycleTransition(INITIAL_SETUP_LIFECYCLE, {
    action: "begin",
    transitionId: "coordinator-begin",
    expectedRevision: INITIAL_SETUP_LIFECYCLE.revision,
    operationId: "coordinator-operation",
  });

  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  assert.equal(result.state.lifecycle, "in-progress");
  assert.equal(result.state.activeOperationId, "coordinator-operation");
  assert.equal(result.requiredScope, "setup:initialize");
});

test("lifecycle coordinator returns no next state for rejected transitions", () => {
  const state = startedState();
  const result = coordinateSetupLifecycleTransition(state, {
    action: "begin",
    transitionId: "coordinator-invalid-begin",
    expectedRevision: state.revision,
    operationId: "another-operation",
  });

  assert.deepEqual(result, { kind: "rejected", code: "invalid_transition" });
  assert.equal("state" in result, false);
});

test("lifecycle coordinator rejects stale revisions without a next state", () => {
  const result = coordinateSetupLifecycleTransition(INITIAL_SETUP_LIFECYCLE, {
    action: "begin",
    transitionId: "coordinator-stale-begin",
    expectedRevision: INITIAL_SETUP_LIFECYCLE.revision + 1,
    operationId: "stale-operation",
  });

  assert.deepEqual(result, { kind: "conflict", code: "stale_revision" });
  assert.equal("state" in result, false);
});

test("lifecycle coordinator requires database availability before completion", () => {
  const state = startedState();
  const result = coordinateSetupLifecycleTransition(state, {
    action: "complete",
    transitionId: "coordinator-incomplete",
    expectedRevision: state.revision,
    operationId: "operation-1",
    verifiedSteps: SETUP_STEPS.filter(
      (step) => step !== "database-availability-verified",
    ),
  });

  assert.deepEqual(result, {
    kind: "rejected",
    code: "completion_unverified",
  });
  assert.equal("state" in result, false);
});

test("initial setup can begin once and requires initialization scope", () => {
  const result = begin();

  assert.equal(result.kind, "planned");
  if (result.kind !== "planned") return;
  assert.equal(result.requiredScope, "setup:initialize");
  assert.deepEqual(result.nextState, {
    lifecycle: "in-progress",
    revision: 1,
    activeOperationId: "operation-1",
    failedOperationId: null,
    lastTransitionId: "transition-1",
    lastTransitionFingerprint: JSON.stringify({
      action: "begin",
      expectedRevision: 0,
      operationId: "operation-1",
    }),
  });
  assert.deepEqual(result.expectedState, INITIAL_SETUP_LIFECYCLE);
  assert.equal(
    planSetupLifecycleTransition(result.nextState, {
      action: "begin",
      transitionId: "transition-2",
      expectedRevision: 1,
      operationId: "operation-2",
    }).kind,
    "rejected",
  );
});

test("completion needs every verified setup milestone and the active operation", () => {
  const state = startedState();
  const missingDatabaseAvailability = planSetupLifecycleTransition(state, {
    action: "complete",
    transitionId: "complete-database-unavailable",
    expectedRevision: state.revision,
    operationId: "operation-1",
    verifiedSteps: SETUP_STEPS.filter(
      (step) => step !== "database-availability-verified",
    ),
  });
  assert.deepEqual(missingDatabaseAvailability, {
    kind: "rejected",
    code: "completion_unverified",
  });

  const incomplete = planSetupLifecycleTransition(state, {
    action: "complete",
    transitionId: "complete-1",
    expectedRevision: state.revision,
    operationId: "operation-1",
    verifiedSteps: SETUP_STEPS.slice(0, -1),
  });
  assert.deepEqual(incomplete, {
    kind: "rejected",
    code: "completion_unverified",
  });

  const wrongOperation = planSetupLifecycleTransition(state, {
    action: "complete",
    transitionId: "complete-2",
    expectedRevision: state.revision,
    operationId: "other-operation",
    verifiedSteps: SETUP_STEPS,
  });
  assert.deepEqual(wrongOperation, {
    kind: "rejected",
    code: "invalid_transition",
  });

  const completed = planSetupLifecycleTransition(state, {
    action: "complete",
    transitionId: "complete-3",
    expectedRevision: state.revision,
    operationId: "operation-1",
    verifiedSteps: SETUP_STEPS,
  });
  assert.equal(completed.kind, "planned");
  if (completed.kind !== "planned") return;
  assert.equal(completed.nextState.lifecycle, "completed");
  assert.equal(completed.requiredScope, "setup:initialize");
});

test("completed setup is terminal for ordinary transitions", () => {
  const started = startedState();
  const completion = planSetupLifecycleTransition(started, {
    action: "complete",
    transitionId: "complete",
    expectedRevision: started.revision,
    operationId: "operation-1",
    verifiedSteps: SETUP_STEPS,
  });
  assert.equal(completion.kind, "planned");
  if (completion.kind !== "planned") return;

  assert.deepEqual(
    planSetupLifecycleTransition(completion.nextState, {
      action: "begin",
      transitionId: "reopen",
      expectedRevision: completion.nextState.revision,
      operationId: "operation-2",
    }),
    { kind: "rejected", code: "invalid_transition" },
  );
});

test("failed or interrupted setup requires a matching verified recovery path", () => {
  const started = startedState();
  for (const outcome of ["failed", "interrupted"] as const) {
    const failed = planSetupLifecycleTransition(started, {
      action: "fail",
      transitionId: `failure-${outcome}`,
      expectedRevision: started.revision,
      operationId: "operation-1",
      outcome,
    });
    assert.equal(failed.kind, "planned");
    if (failed.kind !== "planned") return;
    assert.equal(failed.nextState.lifecycle, outcome);
    assert.equal(failed.requiredScope, "setup:record-failure");

    const mismatch = planSetupLifecycleTransition(failed.nextState, {
      action: "recover",
      transitionId: `recovery-mismatch-${outcome}`,
      expectedRevision: failed.nextState.revision,
      failedOperationId: "operation-1",
      recoveryVerifiedOperationId: "different-operation",
      nextOperationId: "operation-2",
    });
    assert.deepEqual(mismatch, {
      kind: "rejected",
      code: "recovery_unverified",
    });

    const recovered = planSetupLifecycleTransition(failed.nextState, {
      action: "recover",
      transitionId: `recovery-${outcome}`,
      expectedRevision: failed.nextState.revision,
      failedOperationId: "operation-1",
      recoveryVerifiedOperationId: "operation-1",
      nextOperationId: "operation-2",
    });
    assert.equal(recovered.kind, "planned");
    if (recovered.kind !== "planned") return;
    assert.equal(recovered.nextState.lifecycle, "in-progress");
    assert.equal(recovered.requiredScope, "setup:recover");
  }
});

test("stale revisions conflict and immediate transition replay is idempotent", () => {
  const first = begin();
  assert.equal(first.kind, "planned");
  if (first.kind !== "planned") return;

  assert.deepEqual(
    planSetupLifecycleTransition(first.nextState, {
      action: "begin",
      transitionId: "transition-1",
      expectedRevision: 0,
      operationId: "operation-1",
    }),
    { kind: "replay", transitionId: "transition-1" },
  );
  assert.deepEqual(
    planSetupLifecycleTransition(first.nextState, {
      action: "fail",
      transitionId: "transition-1",
      expectedRevision: 0,
      operationId: "operation-1",
      outcome: "failed",
    }),
    { kind: "conflict", code: "idempotency_key_reused" },
  );
  assert.deepEqual(
    planSetupLifecycleTransition(first.nextState, {
      action: "fail",
      transitionId: "stale-transition",
      expectedRevision: 0,
      operationId: "operation-1",
      outcome: "failed",
    }),
    { kind: "conflict", code: "stale_revision" },
  );
});

test("competing plans from one snapshot require persistent compare-and-swap", () => {
  const state = startedState();
  const first = planSetupLifecycleTransition(state, {
    action: "complete",
    transitionId: "competing-1",
    expectedRevision: state.revision,
    operationId: "operation-1",
    verifiedSteps: SETUP_STEPS,
  });
  const second = planSetupLifecycleTransition(state, {
    action: "complete",
    transitionId: "competing-2",
    expectedRevision: state.revision,
    operationId: "operation-1",
    verifiedSteps: SETUP_STEPS,
  });

  assert.equal(first.kind, "planned");
  assert.equal(second.kind, "planned");
  if (first.kind !== "planned" || second.kind !== "planned") return;
  assert.equal(first.nextState.revision, second.nextState.revision);
  assert.equal(first.nextState.lifecycle, "completed");
  assert.equal(second.nextState.lifecycle, "completed");
});

test("applying one plan rejects stale or divergent lifecycle snapshots", () => {
  const state = startedState();
  const first = planSetupLifecycleTransition(state, {
    action: "complete",
    transitionId: "apply-first",
    expectedRevision: state.revision,
    operationId: "operation-1",
    verifiedSteps: SETUP_STEPS,
  });
  const competing = planSetupLifecycleTransition(state, {
    action: "complete",
    transitionId: "apply-competing",
    expectedRevision: state.revision,
    operationId: "operation-1",
    verifiedSteps: SETUP_STEPS,
  });

  assert.equal(first.kind, "planned");
  assert.equal(competing.kind, "planned");
  if (first.kind !== "planned" || competing.kind !== "planned") return;

  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.expectedState), true);
  assert.equal(Object.isFrozen(first.nextState), true);
  assert.equal(
    Reflect.set(first, "expectedState", {
      ...first.expectedState,
      activeOperationId: "different-operation",
    }),
    false,
  );

  const applied = applySetupLifecyclePlan(state, first);
  assert.deepEqual(applied, { kind: "applied", state: first.nextState });
  assert.deepEqual(applySetupLifecyclePlan(applied.state, competing), {
    kind: "conflict",
    code: "stale_state",
  });
  assert.deepEqual(
    applySetupLifecyclePlan(
      { ...state, activeOperationId: "different-operation" },
      first,
    ),
    { kind: "conflict", code: "stale_state" },
  );
});

test("malformed state and transition identifiers fail closed", () => {
  assert.equal(
    isSetupLifecycleState({ ...INITIAL_SETUP_LIFECYCLE, revision: 1 }),
    false,
  );
  assert.equal(
    isSetupLifecycleState({
      ...INITIAL_SETUP_LIFECYCLE,
      lifecycle: "not-started",
      revision: 1,
      lastTransitionId: "transition-1",
      lastTransitionFingerprint: "{}",
    }),
    false,
  );

  assert.deepEqual(
    planSetupLifecycleTransition(
      {
        ...INITIAL_SETUP_LIFECYCLE,
        lifecycle: "completed",
        activeOperationId: "stale",
      },
      {
        action: "begin",
        transitionId: "transition",
        expectedRevision: 0,
        operationId: "operation-1",
      },
    ),
    { kind: "rejected", code: "invalid_state" },
  );
  assert.deepEqual(
    planSetupLifecycleTransition(INITIAL_SETUP_LIFECYCLE, {
      action: "begin",
      transitionId: "contains spaces",
      expectedRevision: 0,
      operationId: "operation-1",
    }),
    { kind: "rejected", code: "invalid_request" },
  );
  assert.deepEqual(
    planSetupLifecycleTransition(
      { ...INITIAL_SETUP_LIFECYCLE, revision: Number.MAX_SAFE_INTEGER },
      {
        action: "begin",
        transitionId: "transition",
        expectedRevision: Number.MAX_SAFE_INTEGER,
        operationId: "operation-1",
      },
    ),
    { kind: "rejected", code: "invalid_state" },
  );
});
