import { decideWorkspaceRouteAccess } from "@/core/auth/route-access-policy";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const regularUser = { isStaff: false, isSuperuser: false };
const staffUser = { isStaff: true, isSuperuser: false };
const superuser = { isStaff: false, isSuperuser: true };

test("workspace access redirects when unauthenticated or auth is disabled", () => {
  assert.equal(decideWorkspaceRouteAccess(true, null), "sign-in");
  assert.equal(decideWorkspaceRouteAccess(false, regularUser), "sign-in");
  assert.equal(decideWorkspaceRouteAccess(false, staffUser, true), "sign-in");
});

test("regular active users may access user routes but not admin routes", () => {
  assert.equal(decideWorkspaceRouteAccess(true, regularUser), "allow");
  assert.equal(
    decideWorkspaceRouteAccess(true, regularUser, true),
    "not-found",
  );
});

test("staff and superusers may access admin routes", () => {
  assert.equal(decideWorkspaceRouteAccess(true, staffUser, true), "allow");
  assert.equal(decideWorkspaceRouteAccess(true, superuser, true), "allow");
});

test("public sign-in, reset, auth, and health routes stay outside workspace guard", () => {
  const publicRoutes = [
    "src/app/page.tsx",
    "src/app/sign-in/page.tsx",
    "src/app/sign-in/actions.ts",
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
