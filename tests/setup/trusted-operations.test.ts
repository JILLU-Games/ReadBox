import {
  type InstallerOperationScope,
  type SetupAuthorizationDecision,
} from "@/core/setup/authorization";
import {
  createDefaultSetupOperationRunner,
  createDefaultSetupOperations,
  createTrustedOperationRunner,
  defineInstallerOperation,
  runSetupVerificationInspection,
} from "@/core/setup/trusted-operations";
import assert from "node:assert/strict";
import test from "node:test";

interface SyntheticInput {
  readonly approval: "synthetic";
}

function isSyntheticInput(input: unknown): input is SyntheticInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "approval" in input &&
    input.approval === "synthetic"
  );
}

function allowDecision(request: {
  readonly operationId: string;
  readonly requiredScope: InstallerOperationScope;
}): Extract<
  SetupAuthorizationDecision,
  { readonly kind: "allow"; readonly principalKind: "trusted-installer" }
> {
  return {
    kind: "allow",
    principalKind: "trusted-installer",
    operationId: request.operationId,
    scope: request.requiredScope,
    lifecycle: "completed",
  };
}

function authorized() {
  return async (request: {
    readonly operationId: string;
    readonly requiredScope: InstallerOperationScope;
  }) => allowDecision(request);
}

test("unknown operations are rejected without authorization or execution", async () => {
  let authorizationCalls = 0;
  let executionCalls = 0;
  const operation = defineInstallerOperation({
    id: "synthetic.probe",
    requiredScope: "installer:manage",
    supportedLifecycles: ["completed"],
    validateInput: isSyntheticInput,
    execute: async () => {
      executionCalls += 1;
    },
  });
  const runner = createTrustedOperationRunner([operation], async (request) => {
    authorizationCalls += 1;
    return allowDecision(request);
  });

  assert.deepEqual(await runner.run("synthetic.unknown", {}), {
    kind: "rejected",
    code: "unknown_operation",
  });
  assert.equal(authorizationCalls, 0);
  assert.equal(executionCalls, 0);
});

test("invalid input is rejected before authorization and execution", async () => {
  let authorizationCalls = 0;
  let executionCalls = 0;
  const operation = defineInstallerOperation({
    id: "synthetic.probe",
    requiredScope: "installer:manage",
    supportedLifecycles: ["completed"],
    validateInput: isSyntheticInput,
    execute: async () => {
      executionCalls += 1;
    },
  });
  const runner = createTrustedOperationRunner([operation], async (request) => {
    authorizationCalls += 1;
    return allowDecision(request);
  });

  const sensitiveMarker = "synthetic-sensitive-input-marker";
  const result = await runner.run("synthetic.probe", {
    approval: "wrong",
    password: sensitiveMarker,
  });

  assert.deepEqual(result, { kind: "rejected", code: "invalid_input" });
  assert.equal(JSON.stringify(result).includes(sensitiveMarker), false);
  assert.equal(authorizationCalls, 0);
  assert.equal(executionCalls, 0);
});

test("missing or denied authorization never invokes the executor", async () => {
  let executionCalls = 0;
  const operation = defineInstallerOperation({
    id: "synthetic.probe",
    requiredScope: "installer:manage",
    supportedLifecycles: ["completed"],
    validateInput: isSyntheticInput,
    execute: async () => {
      executionCalls += 1;
    },
  });

  const defaultDeniedRunner = createTrustedOperationRunner([operation]);
  assert.deepEqual(
    await defaultDeniedRunner.run("synthetic.probe", { approval: "synthetic" }),
    { kind: "rejected", code: "unauthorized" },
  );

  const deniedRunner = createTrustedOperationRunner([operation], async () => ({
    kind: "deny",
    code: "forbidden",
  }));
  assert.deepEqual(
    await deniedRunner.run("synthetic.probe", { approval: "synthetic" }),
    { kind: "rejected", code: "unauthorized" },
  );
  assert.equal(executionCalls, 0);
});

test("registered operations without an executor remain unsupported", async () => {
  const operation = defineInstallerOperation({
    id: "synthetic.unsupported",
    requiredScope: "installer:manage",
    supportedLifecycles: ["completed"],
    validateInput: isSyntheticInput,
  });
  const runner = createTrustedOperationRunner([operation], authorized());

  assert.deepEqual(
    await runner.run("synthetic.unsupported", { approval: "synthetic" }),
    { kind: "unsupported", operationId: "synthetic.unsupported" },
  );
});

test("executor exceptions return a fixed safe error without exception details", async () => {
  const sensitiveMarker = "synthetic-secret-error-marker";
  const operation = defineInstallerOperation({
    id: "synthetic.failure",
    requiredScope: "installer:manage",
    supportedLifecycles: ["completed"],
    validateInput: isSyntheticInput,
    execute: async () => {
      throw new Error(sensitiveMarker);
    },
  });
  const runner = createTrustedOperationRunner([operation], authorized());

  const result = await runner.run("synthetic.failure", {
    approval: "synthetic",
  });

  assert.deepEqual(result, { kind: "failure", code: "operation_failed" });
  assert.equal(JSON.stringify(result).includes(sensitiveMarker), false);
});

test("validated input is snapshotted before awaiting authorization", async () => {
  let approve!: (decision: SetupAuthorizationDecision) => void;
  let receivedApproval: string | undefined;
  const authorization = new Promise<SetupAuthorizationDecision>((resolve) => {
    approve = resolve;
  });
  const operation = defineInstallerOperation({
    id: "synthetic.snapshot",
    requiredScope: "installer:manage",
    supportedLifecycles: ["completed"],
    validateInput: isSyntheticInput,
    execute: async (input) => {
      receivedApproval = input.approval;
    },
  });
  const runner = createTrustedOperationRunner(
    [operation],
    async () => authorization,
  );
  const input: { approval: "synthetic" | "changed" } = {
    approval: "synthetic",
  };
  const resultPromise = runner.run("synthetic.snapshot", input);
  input.approval = "changed";
  approve(
    allowDecision({
      operationId: "synthetic.snapshot",
      requiredScope: "installer:manage",
    }),
  );

  assert.deepEqual(await resultPromise, {
    kind: "success",
    operationId: "synthetic.snapshot",
  });
  assert.equal(receivedApproval, "synthetic");
});

test("malformed authorization decisions are rejected", async () => {
  let executionCalls = 0;
  const operation = defineInstallerOperation({
    id: "synthetic.malformed-authorization",
    requiredScope: "installer:manage",
    supportedLifecycles: ["completed"],
    validateInput: isSyntheticInput,
    execute: async () => {
      executionCalls += 1;
    },
  });
  const runner = createTrustedOperationRunner(
    [operation],
    async () => null as never,
  );

  assert.deepEqual(
    await runner.run("synthetic.malformed-authorization", {
      approval: "synthetic",
    }),
    { kind: "rejected", code: "unauthorized" },
  );
  assert.equal(executionCalls, 0);
});

test("authorization exceptions fail closed with a sanitized result", async () => {
  const sensitiveMarker = "synthetic-authorization-secret-marker";
  let executionCalls = 0;
  const operation = defineInstallerOperation({
    id: "synthetic.authorization-failure",
    requiredScope: "installer:manage",
    supportedLifecycles: ["completed"],
    validateInput: isSyntheticInput,
    execute: async () => {
      executionCalls += 1;
    },
  });
  const runner = createTrustedOperationRunner([operation], async () => {
    throw new Error(sensitiveMarker);
  });

  const result = await runner.run("synthetic.authorization-failure", {
    approval: "synthetic",
  });

  assert.deepEqual(result, {
    kind: "failure",
    code: "authorization_unavailable",
  });
  assert.equal(JSON.stringify(result).includes(sensitiveMarker), false);
  assert.equal(executionCalls, 0);
});

test("only the privileged-operation authorization scope can execute", async () => {
  let executionCalls = 0;
  const operation = defineInstallerOperation({
    id: "synthetic.scope-check",
    requiredScope: "installer:manage",
    supportedLifecycles: ["completed"],
    validateInput: isSyntheticInput,
    execute: async () => {
      executionCalls += 1;
    },
  });
  const runner = createTrustedOperationRunner([operation], async (request) => ({
    ...allowDecision(request),
    scope: "setup:recover",
  }));

  assert.deepEqual(
    await runner.run("synthetic.scope-check", { approval: "synthetic" }),
    { kind: "rejected", code: "unauthorized" },
  );
  assert.equal(executionCalls, 0);
});

test("operation grants must match the exact operation and lifecycle", async () => {
  let executionCalls = 0;
  const operation = defineInstallerOperation({
    id: "synthetic.binding",
    requiredScope: "installer:manage",
    supportedLifecycles: ["completed"],
    validateInput: isSyntheticInput,
    execute: async () => {
      executionCalls += 1;
    },
  });
  const operationMismatch = createTrustedOperationRunner(
    [operation],
    async (request) => ({
      ...allowDecision(request),
      operationId: "synthetic.other",
    }),
  );
  const lifecycleMismatch = createTrustedOperationRunner(
    [operation],
    async (request) => ({
      ...allowDecision(request),
      lifecycle: "in-progress",
    }),
  );

  assert.deepEqual(
    await operationMismatch.run("synthetic.binding", { approval: "synthetic" }),
    { kind: "rejected", code: "unauthorized" },
  );
  assert.deepEqual(
    await lifecycleMismatch.run("synthetic.binding", {
      approval: "synthetic",
    }),
    { kind: "rejected", code: "unauthorized" },
  );
  assert.equal(executionCalls, 0);
});

test("Phase 06 BUG-09: default setup operations and runSetupVerificationInspection verify setup lifecycle progress", async () => {
  const operations = createDefaultSetupOperations();
  assert.equal(operations.length >= 3, true);

  const runner = createDefaultSetupOperationRunner(async (req) => ({
    kind: "allow",
    principalKind: "trusted-installer",
    operationId: req.operationId,
    scope: req.requiredScope,
    lifecycle: "completed",
  }));

  const envResult = await runner.run("setup.environment.validate", {});
  assert.equal(envResult.kind, "success");

  // Inspect setup verification steps with fake prisma
  const inspection = await runSetupVerificationInspection({
    prisma: {
      async $queryRaw() {
        return [{ ok: 1 }];
      },
      adminAccount: {
        async count() {
          return 1;
        },
      },
    },
  });

  assert.equal(typeof inspection.overallReady, "boolean");
  assert.equal(inspection.totalSteps, 6);
  assert.equal(inspection.steps.length, 6);
  assert.equal(inspection.steps[0]?.step, "environment-validated");
  assert.equal(inspection.steps[1]?.step, "database-availability-verified");
  assert.equal(inspection.steps[2]?.step, "database-verified");
  assert.equal(inspection.steps[3]?.step, "schema-verified");
  assert.equal(inspection.steps[4]?.step, "administrator-created");
  assert.equal(inspection.steps[5]?.step, "completion-verified");
});

