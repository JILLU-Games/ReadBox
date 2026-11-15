import assert from "node:assert/strict";
import { after, before, beforeEach, mock, test } from "node:test";

interface MockUser {
  readonly isAdministrator: boolean;
}

let currentUser: MockUser | null = null;

mock.module(
  new URL("../../src/core/auth/current-user.ts", import.meta.url).href,
  {
    namedExports: {
      getCurrentUser: async () => currentUser,
    },
  },
);

let setupAuthorization: typeof import("../../src/core/setup/authorization");

before(async () => {
  setupAuthorization = await import("../../src/core/setup/authorization");
});

beforeEach(() => {
  currentUser = null;
});

after(() => {
  mock.restoreAll();
});

test("anonymous principal can inspect only the public status projection", async () => {
  const principal = await setupAuthorization.resolveSetupPrincipal();

  assert.deepEqual(
    setupAuthorization.authorizeSetupRequest(
      principal,
      { action: "inspect-status" },
      "in-progress",
    ),
    { kind: "allow", scope: "status-summary" },
  );
  assert.deepEqual(
    setupAuthorization.toPublicSetupStatus({
      lifecycle: "in-progress",
      databaseName: "private-db-name",
      credentials: "private-marker",
      hostDetails: { internal: true },
    }),
    { lifecycle: "in-progress" },
  );
});

test("anonymous setup initialization is denied even in an allowed lifecycle", async () => {
  const principal = await setupAuthorization.resolveSetupPrincipal();

  assert.deepEqual(
    setupAuthorization.authorizeSetupRequest(
      principal,
      {
        action: "privileged-operation",
        operationId: "setup.initialize",
        requiredScope: "setup:initialize",
      },
      "not-started",
    ),
    { kind: "deny", code: "unauthenticated" },
  );
});

test("verified application users and administrators cannot run installer operations", async () => {
  for (const { user, expectedKind } of [
    {
      user: { isAdministrator: false },
      expectedKind: "application-user",
    },
    {
      user: { isAdministrator: true },
      expectedKind: "application-admin",
    },
  ]) {
    currentUser = user;
    const principal = await setupAuthorization.resolveSetupPrincipal();
    assert.equal(principal.kind, expectedKind);
    assert.notEqual(principal.kind, "trusted-installer");
    assert.deepEqual(
      setupAuthorization.authorizeSetupRequest(
        principal,
        {
          action: "privileged-operation",
          operationId: "installer.synthetic",
          requiredScope: "installer:manage",
        },
        "completed",
      ),
      { kind: "deny", code: "forbidden" },
    );
  }
});

test("authenticated application access delegates to existing route guards", async () => {
  currentUser = { isAdministrator: false };
  const principal = await setupAuthorization.resolveSetupPrincipal();

  assert.deepEqual(
    setupAuthorization.authorizeSetupRequest(
      principal,
      { action: "application-access" },
      "not-started",
    ),
    { kind: "delegate", target: "application-route-guards" },
  );
});

test("ordinary input cannot forge a trusted installer principal", () => {
  const forgedPrincipal = {
    kind: "trusted-installer",
    scopes: ["installer:manage"],
    operationIds: ["installer.synthetic"],
    expiresAt: Number.MAX_SAFE_INTEGER,
    revoked: false,
    consumed: false,
  };

  assert.deepEqual(
    setupAuthorization.authorizeSetupRequest(
      forgedPrincipal,
      {
        action: "privileged-operation",
        operationId: "installer.synthetic",
        requiredScope: "installer:manage",
      },
      "completed",
    ),
    { kind: "deny", code: "invalid-principal" },
  );
  assert.deepEqual(
    setupAuthorization.authorizeSetupRequest(
      null,
      { action: "inspect-status" },
      "not-started",
    ),
    { kind: "deny", code: "invalid-principal" },
  );
});

test("completed setup cannot be reopened by an application administrator", async () => {
  currentUser = { isAdministrator: true };
  const principal = await setupAuthorization.resolveSetupPrincipal();

  assert.deepEqual(
    setupAuthorization.authorizeSetupRequest(
      principal,
      {
        action: "privileged-operation",
        operationId: "setup.initialize",
        requiredScope: "setup:initialize",
      },
      "completed",
    ),
    { kind: "deny", code: "setup-state-mismatch" },
  );
});

test("recovery is restricted to failed or interrupted lifecycle states", async () => {
  const anonymous = await setupAuthorization.resolveSetupPrincipal();
  const request = {
    action: "privileged-operation",
    operationId: "setup.recover",
    requiredScope: "setup:recover",
  } as const;

  assert.deepEqual(
    setupAuthorization.authorizeSetupRequest(anonymous, request, "in-progress"),
    { kind: "deny", code: "setup-state-mismatch" },
  );
  assert.deepEqual(
    setupAuthorization.authorizeSetupRequest(anonymous, request, "failed"),
    { kind: "deny", code: "unauthenticated" },
  );
});

test("unknown scope, malformed lifecycle, and transition checks fail closed", async () => {
  const principal = await setupAuthorization.resolveSetupPrincipal();

  assert.deepEqual(
    setupAuthorization.authorizeSetupRequest(
      principal,
      {
        action: "privileged-operation",
        operationId: "installer.synthetic",
        requiredScope: "root" as never,
      },
      "completed",
    ),
    { kind: "invalid", code: "invalid-request" },
  );
  assert.deepEqual(
    setupAuthorization.authorizeSetupRequest(
      principal,
      { action: "inspect-status" },
      "unknown-state",
    ),
    { kind: "invalid", code: "invalid-request" },
  );
  assert.deepEqual(
    setupAuthorization.authorizeSetupRequest(
      principal,
      { action: "validate-transition" },
      "not-started",
    ),
    {
      kind: "unsupported",
      code: "transition-validation-internal-only",
    },
  );
});
