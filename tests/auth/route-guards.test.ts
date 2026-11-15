import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";

interface TestUser {
  id: string;
  isActive: boolean;
  passwordResetRequired: boolean;
  isAdministrator: boolean;
  isSuperuser: boolean;
}

class RedirectSignal extends Error {
  constructor(readonly destination: string) {
    super(`redirect:${destination}`);
  }
}

class NotFoundSignal extends Error {}

const testEnvironment = { authEnabled: true };
let serverUser: TestUser | null = null;
let currentUserCalls = 0;

mock.module(new URL("../../src/config/env.ts", import.meta.url).href, {
  namedExports: { env: testEnvironment },
});
mock.module(
  new URL("../../src/core/auth/current-user.ts", import.meta.url).href,
  {
    namedExports: {
      getCurrentUser: async () => {
        currentUserCalls += 1;
        if (!serverUser?.isActive || serverUser.passwordResetRequired) {
          return null;
        }
        return serverUser;
      },
    },
  },
);
mock.module("next/navigation", {
  namedExports: {
    redirect(destination: string): never {
      throw new RedirectSignal(destination);
    },
    notFound(): never {
      throw new NotFoundSignal();
    },
  },
});

let routeGuards: typeof import("../../src/core/auth/route-guards");

before(async () => {
  routeGuards = await import("../../src/core/auth/route-guards");
});

beforeEach(() => {
  testEnvironment.authEnabled = true;
  serverUser = null;
  currentUserCalls = 0;
});

afterEach(() => {
  testEnvironment.authEnabled = true;
  serverUser = null;
  currentUserCalls = 0;
});

after(() => {
  mock.restoreAll();
});

function makeUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: "synthetic-user-id",
    isActive: true,
    passwordResetRequired: false,
    isAdministrator: false,
    isSuperuser: false,
    ...overrides,
  };
}

async function assertRedirect(action: () => Promise<unknown>) {
  await assert.rejects(action(), (error: unknown) => {
    assert.ok(error instanceof RedirectSignal);
    assert.equal(error.destination, "/sign-in");
    return true;
  });
}

test("active authenticated users can access the workspace from server identity", async () => {
  testEnvironment.authEnabled = true;
  serverUser = makeUser();
  currentUserCalls = 0;

  assert.strictEqual(await routeGuards.requireWorkspaceUser(), serverUser);
  assert.equal(currentUserCalls, 1);
});

test("anonymous and inactive users are redirected from workspace routes", async () => {
  testEnvironment.authEnabled = true;
  serverUser = null;
  await assertRedirect(routeGuards.requireWorkspaceUser);

  serverUser = makeUser({ isActive: false });
  await assertRedirect(routeGuards.requireWorkspaceUser);

  serverUser = makeUser({ passwordResetRequired: true });
  await assertRedirect(routeGuards.requireWorkspaceUser);
});

test("regular users cannot access admin routes when legacy flags are client-supplied", async () => {
  testEnvironment.authEnabled = true;
  serverUser = makeUser();
  const clientSuppliedAdmin = { isAdministrator: true, isSuperuser: true };

  await assert.rejects(
    Reflect.apply(routeGuards.requireAdminUser, undefined, [
      clientSuppliedAdmin,
    ]),
    NotFoundSignal,
  );
});

test("profile-backed application administrators may access admin routes", async () => {
  testEnvironment.authEnabled = true;
  serverUser = makeUser({ isAdministrator: true });
  assert.strictEqual(await routeGuards.requireAdminUser(), serverUser);
});

test("auth-disabled mode denies protected routes without trusting an available identity", async () => {
  testEnvironment.authEnabled = false;
  serverUser = makeUser({ isAdministrator: true, isSuperuser: true });
  currentUserCalls = 0;

  await assertRedirect(routeGuards.requireWorkspaceUser);
  await assertRedirect(routeGuards.requireAdminUser);
  assert.equal(currentUserCalls, 0);
});
