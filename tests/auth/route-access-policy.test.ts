import { decideWorkspaceRouteAccess } from "@/core/auth/route-access-policy";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const regularUser = { isAdministrator: false };
const administrator = { isAdministrator: true };

test("workspace access redirects when unauthenticated or auth is disabled", () => {
  assert.equal(decideWorkspaceRouteAccess(true, null), "sign-in");
  assert.equal(decideWorkspaceRouteAccess(false, regularUser), "sign-in");
  assert.equal(
    decideWorkspaceRouteAccess(false, administrator, true),
    "sign-in",
  );
});

test("regular active users may access user routes but not admin routes", () => {
  assert.equal(decideWorkspaceRouteAccess(true, regularUser), "allow");
  assert.equal(
    decideWorkspaceRouteAccess(true, regularUser, true),
    "not-found",
  );
});

test("only a profile-backed administrator may access admin routes", () => {
  assert.equal(decideWorkspaceRouteAccess(true, administrator, true), "allow");
});

test("dev bypass allows workspace routes only when explicitly active with a user", () => {
  assert.equal(
    decideWorkspaceRouteAccess(false, regularUser, false, true),
    "allow",
  );
  assert.equal(
    decideWorkspaceRouteAccess(false, regularUser, true, true),
    "not-found",
  );
  assert.equal(
    decideWorkspaceRouteAccess(false, administrator, true, true),
    "allow",
  );
  assert.equal(
    decideWorkspaceRouteAccess(false, null, false, true),
    "sign-in",
  );
});

test("public sign-in, sign-up, admin login, reset, auth, and health routes stay outside workspace guard", () => {
  const publicRoutes = [
    "src/app/page.tsx",
    "src/app/sign-in/page.tsx",
    "src/app/sign-in/actions.ts",
    "src/app/sign-up/page.tsx",
    "src/app/sign-up/actions.ts",
    "src/app/vcon/login/page.tsx",
    "src/app/reset-password/page.tsx",
    "src/app/reset-password/actions.ts",
    "src/app/api/auth/[...nextauth]/route.ts",
    "src/app/health/live/route.ts",
    "src/app/health/ready/route.ts",
  ];

  for (const route of publicRoutes) {
    assert.equal(existsSync(resolve(process.cwd(), route)), true, route);
    assert.equal(route.includes("(workspace)"), false, route);
  }
});
