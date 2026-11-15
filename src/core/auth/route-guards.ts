import { env } from "@/config/env";
import { getCurrentUser } from "@/core/auth/current-user";
import { getDevBypassUser } from "@/core/auth/dev-demo-auth";
import { decideWorkspaceRouteAccess } from "@/core/auth/route-access-policy";
import { notFound, redirect } from "next/navigation";
import "server-only";

async function requireWorkspaceAccess(adminOnly: boolean) {
  const devBypassActive =
    env.nodeEnv === "development" && env.devAuthMode === "bypass";
  const devDemoActive =
    env.nodeEnv === "development" && env.devAuthMode === "demo";

  const user = devBypassActive
    ? getDevBypassUser(env.devAuthRole ?? "admin")
    : env.authEnabled || devDemoActive
      ? await getCurrentUser()
      : null;

  const decision = decideWorkspaceRouteAccess(
    env.authEnabled || devDemoActive,
    user,
    adminOnly,
    devBypassActive,
  );

  if (decision === "sign-in") redirect("/sign-in");
  if (decision === "not-found") notFound();
  if (!user) redirect("/sign-in");

  return user;
}

export function requireWorkspaceUser() {
  return requireWorkspaceAccess(false);
}

export function requireAdminUser() {
  return requireWorkspaceAccess(true);
}
