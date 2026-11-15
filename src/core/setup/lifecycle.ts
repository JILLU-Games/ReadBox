import { SETUP_STEPS, type SetupStep } from "@/core/setup/progress";

export type SetupLifecycle =
  | "not-started"
  | "in-progress"
  | "completed"
  | "failed"
  | "interrupted";

export type SetupTransitionScope =
  | "setup:initialize"
  | "setup:record-failure"
  | "setup:recover";

export interface SetupLifecycleState {
  readonly lifecycle: SetupLifecycle;
  readonly revision: number;
  readonly activeOperationId: string | null;
  readonly failedOperationId: string | null;
  readonly lastTransitionId: string | null;
  readonly lastTransitionFingerprint: string | null;
}

export const INITIAL_SETUP_LIFECYCLE: SetupLifecycleState = Object.freeze({
  lifecycle: "not-started",
  revision: 0,
  activeOperationId: null,
  failedOperationId: null,
  lastTransitionId: null,
  lastTransitionFingerprint: null,
});

export type SetupLifecycleRequest =
  | {
      readonly action: "begin";
      readonly transitionId: string;
      readonly expectedRevision: number;
      readonly operationId: string;
    }
  | {
      readonly action: "complete";
      readonly transitionId: string;
      readonly expectedRevision: number;
      readonly operationId: string;
      /** Policy assertion only; this pure planner does not verify external postconditions. */
      readonly verifiedSteps: readonly SetupStep[];
    }
  | {
      readonly action: "fail";
      readonly transitionId: string;
      readonly expectedRevision: number;
      readonly operationId: string;
      readonly outcome: "failed" | "interrupted";
    }
  | {
      readonly action: "recover";
      readonly transitionId: string;
      readonly expectedRevision: number;
      readonly failedOperationId: string;
      readonly recoveryVerifiedOperationId: string;
      readonly nextOperationId: string;
    };

export type SetupLifecyclePlan =
  | {
      readonly kind: "planned";
      readonly expectedState: SetupLifecycleState;
      readonly nextState: SetupLifecycleState;
      readonly requiredScope: SetupTransitionScope;
    }
  | { readonly kind: "replay"; readonly transitionId: string }
  | {
      readonly kind: "conflict";
      readonly code: "stale_revision" | "idempotency_key_reused";
    }
  | {
      readonly kind: "rejected";
      readonly code:
        | "invalid_state"
        | "invalid_request"
        | "invalid_transition"
        | "completion_unverified"
        | "recovery_unverified";
    };

export type SetupLifecycleApplyResult =
  | { readonly kind: "applied"; readonly state: SetupLifecycleState }
  | { readonly kind: "conflict"; readonly code: "stale_state" }
  | {
      readonly kind: "rejected";
      readonly code: "invalid_state" | "invalid_plan";
    };

export type SetupLifecycleCoordinatorResult =
  | {
      readonly kind: "applied";
      readonly state: SetupLifecycleState;
      readonly requiredScope: SetupTransitionScope;
    }
  | Exclude<SetupLifecyclePlan, { readonly kind: "planned" }>
  | Exclude<SetupLifecycleApplyResult, { readonly kind: "applied" }>;

const lifecycleValues = new Set<SetupLifecycle>([
  "not-started",
  "in-progress",
  "completed",
  "failed",
  "interrupted",
]);
const setupStepValues = new Set<string>(SETUP_STEPS);

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
  );
}

export function isSetupLifecycleState(
  value: unknown,
): value is SetupLifecycleState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Record<string, unknown>;
  if (
    typeof state.lifecycle !== "string" ||
    !lifecycleValues.has(state.lifecycle as SetupLifecycle) ||
    !Number.isSafeInteger(state.revision) ||
    (state.revision as number) < 0 ||
    (state.revision as number) >= Number.MAX_SAFE_INTEGER ||
    !(
      state.activeOperationId === null || isIdentifier(state.activeOperationId)
    ) ||
    !(
      state.failedOperationId === null || isIdentifier(state.failedOperationId)
    ) ||
    !(
      state.lastTransitionId === null || isIdentifier(state.lastTransitionId)
    ) ||
    !(
      state.lastTransitionFingerprint === null ||
      (typeof state.lastTransitionFingerprint === "string" &&
        state.lastTransitionFingerprint.length > 0 &&
        state.lastTransitionFingerprint.length <= 1024)
    ) ||
    (state.lastTransitionId === null) !==
      (state.lastTransitionFingerprint === null)
  ) {
    return false;
  }

  if (
    (state.revision === 0) !== (state.lastTransitionId === null) ||
    (state.lifecycle === "not-started") !== (state.revision === 0)
  ) {
    return false;
  }

  if (state.lifecycle === "in-progress") {
    return (
      isIdentifier(state.activeOperationId) && state.failedOperationId === null
    );
  }
  if (state.lifecycle === "failed" || state.lifecycle === "interrupted") {
    return (
      state.activeOperationId === null && isIdentifier(state.failedOperationId)
    );
  }
  return state.activeOperationId === null && state.failedOperationId === null;
}

function isRequest(value: unknown): value is SetupLifecycleRequest {
  if (typeof value !== "object" || value === null) return false;
  const request = value as Record<string, unknown>;
  if (
    !isIdentifier(request.transitionId) ||
    !Number.isSafeInteger(request.expectedRevision) ||
    (request.expectedRevision as number) < 0
  ) {
    return false;
  }

  if (request.action === "begin") {
    return isIdentifier(request.operationId);
  }
  if (request.action === "complete") {
    return (
      isIdentifier(request.operationId) &&
      Array.isArray(request.verifiedSteps) &&
      request.verifiedSteps.every(
        (step) => typeof step === "string" && setupStepValues.has(step),
      )
    );
  }
  if (request.action === "fail") {
    return (
      isIdentifier(request.operationId) &&
      (request.outcome === "failed" || request.outcome === "interrupted")
    );
  }
  if (request.action === "recover") {
    return (
      isIdentifier(request.failedOperationId) &&
      isIdentifier(request.recoveryVerifiedOperationId) &&
      isIdentifier(request.nextOperationId)
    );
  }
  return false;
}

function plan(
  state: SetupLifecycleState,
  request: SetupLifecycleRequest,
  lifecycle: SetupLifecycle,
  activeOperationId: string | null,
  failedOperationId: string | null,
  requiredScope: SetupTransitionScope,
): SetupLifecyclePlan {
  return Object.freeze({
    kind: "planned",
    expectedState: snapshotLifecycleState(state),
    requiredScope,
    nextState: Object.freeze({
      lifecycle,
      revision: state.revision + 1,
      activeOperationId,
      failedOperationId,
      lastTransitionId: request.transitionId,
      lastTransitionFingerprint: transitionFingerprint(request),
    }),
  });
}

function snapshotLifecycleState(
  state: SetupLifecycleState,
): SetupLifecycleState {
  return Object.freeze({
    lifecycle: state.lifecycle,
    revision: state.revision,
    activeOperationId: state.activeOperationId,
    failedOperationId: state.failedOperationId,
    lastTransitionId: state.lastTransitionId,
    lastTransitionFingerprint: state.lastTransitionFingerprint,
  });
}

function sameLifecycleState(
  left: SetupLifecycleState,
  right: SetupLifecycleState,
): boolean {
  return (
    left.lifecycle === right.lifecycle &&
    left.revision === right.revision &&
    left.activeOperationId === right.activeOperationId &&
    left.failedOperationId === right.failedOperationId &&
    left.lastTransitionId === right.lastTransitionId &&
    left.lastTransitionFingerprint === right.lastTransitionFingerprint
  );
}

export function applySetupLifecyclePlan(
  currentStateValue: unknown,
  planValue: Extract<SetupLifecyclePlan, { readonly kind: "planned" }>,
): SetupLifecycleApplyResult {
  if (!isSetupLifecycleState(currentStateValue)) {
    return { kind: "rejected", code: "invalid_state" };
  }
  if (
    !isSetupLifecycleState(planValue.expectedState) ||
    !isSetupLifecycleState(planValue.nextState)
  ) {
    return { kind: "rejected", code: "invalid_plan" };
  }
  if (!sameLifecycleState(currentStateValue, planValue.expectedState)) {
    return { kind: "conflict", code: "stale_state" };
  }
  return { kind: "applied", state: planValue.nextState };
}

export function coordinateSetupLifecycleTransition(
  currentStateValue: unknown,
  requestValue: unknown,
): SetupLifecycleCoordinatorResult {
  const lifecyclePlan = planSetupLifecycleTransition(
    currentStateValue,
    requestValue,
  );
  if (lifecyclePlan.kind !== "planned") return lifecyclePlan;

  const applied = applySetupLifecyclePlan(currentStateValue, lifecyclePlan);
  if (applied.kind !== "applied") return applied;

  return {
    kind: "applied",
    state: applied.state,
    requiredScope: lifecyclePlan.requiredScope,
  };
}

function transitionFingerprint(request: SetupLifecycleRequest): string {
  const verifiedSteps =
    request.action === "complete"
      ? [...request.verifiedSteps].sort()
      : undefined;
  return JSON.stringify({
    action: request.action,
    expectedRevision: request.expectedRevision,
    operationId: "operationId" in request ? request.operationId : undefined,
    outcome: "outcome" in request ? request.outcome : undefined,
    failedOperationId:
      "failedOperationId" in request ? request.failedOperationId : undefined,
    recoveryVerifiedOperationId:
      "recoveryVerifiedOperationId" in request
        ? request.recoveryVerifiedOperationId
        : undefined,
    nextOperationId:
      "nextOperationId" in request ? request.nextOperationId : undefined,
    verifiedSteps,
  });
}

export function planSetupLifecycleTransition(
  stateValue: unknown,
  requestValue: unknown,
): SetupLifecyclePlan {
  if (!isSetupLifecycleState(stateValue)) {
    return { kind: "rejected", code: "invalid_state" };
  }
  if (!isRequest(requestValue)) {
    return { kind: "rejected", code: "invalid_request" };
  }
  if (stateValue.lastTransitionId === requestValue.transitionId) {
    return stateValue.lastTransitionFingerprint ===
      transitionFingerprint(requestValue)
      ? { kind: "replay", transitionId: requestValue.transitionId }
      : { kind: "conflict", code: "idempotency_key_reused" };
  }
  if (requestValue.expectedRevision !== stateValue.revision) {
    return { kind: "conflict", code: "stale_revision" };
  }

  if (requestValue.action === "begin") {
    if (stateValue.lifecycle !== "not-started") {
      return { kind: "rejected", code: "invalid_transition" };
    }
    return plan(
      stateValue,
      requestValue,
      "in-progress",
      requestValue.operationId,
      null,
      "setup:initialize",
    );
  }

  if (requestValue.action === "complete") {
    if (
      stateValue.lifecycle !== "in-progress" ||
      stateValue.activeOperationId !== requestValue.operationId
    ) {
      return { kind: "rejected", code: "invalid_transition" };
    }
    const verifiedSteps = new Set(requestValue.verifiedSteps);
    if (!SETUP_STEPS.every((step) => verifiedSteps.has(step))) {
      return { kind: "rejected", code: "completion_unverified" };
    }
    return plan(
      stateValue,
      requestValue,
      "completed",
      null,
      null,
      "setup:initialize",
    );
  }

  if (requestValue.action === "fail") {
    if (
      stateValue.lifecycle !== "in-progress" ||
      stateValue.activeOperationId !== requestValue.operationId
    ) {
      return { kind: "rejected", code: "invalid_transition" };
    }
    return plan(
      stateValue,
      requestValue,
      requestValue.outcome,
      null,
      requestValue.operationId,
      "setup:record-failure",
    );
  }

  if (
    (stateValue.lifecycle !== "failed" &&
      stateValue.lifecycle !== "interrupted") ||
    stateValue.failedOperationId !== requestValue.failedOperationId ||
    requestValue.recoveryVerifiedOperationId !==
      requestValue.failedOperationId ||
    requestValue.nextOperationId === requestValue.failedOperationId
  ) {
    return { kind: "rejected", code: "recovery_unverified" };
  }
  return plan(
    stateValue,
    requestValue,
    "in-progress",
    requestValue.nextOperationId,
    null,
    "setup:recover",
  );
}
