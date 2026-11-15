import { env } from "@/config/env";
import { getCurrentUser } from "@/core/auth/current-user";
import { getDevBypassUser } from "@/core/auth/dev-demo-auth";
import { decideWorkspaceRouteAccess } from "@/core/auth/route-access-policy";
import { notFound, redirect } from "next/navigation";
import "server-only";

async function resolveWorkspaceAccess(adminOnly: boolean) {
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

  return { user, decision };
}

async function requireWorkspaceAccess(adminOnly: boolean) {
  const { user, decision } = await resolveWorkspaceAccess(adminOnly);

  if (decision === "sign-in") redirect("/sign-in");
  if (decision === "not-found") notFound();
  if (!user) redirect("/sign-in");

  return user;
}

export async function getAuthorizedWorkspaceUser() {
  const { user, decision } = await resolveWorkspaceAccess(false);
  if (decision !== "allow" || !user) {
    return null;
  }
  return user;
}

export async function getAuthorizedAdminUser() {
  const { user, decision } = await resolveWorkspaceAccess(true);
  if (decision !== "allow" || !user) {
    return null;
  }
  return user;
}

export function requireWorkspaceUser() {
  return requireWorkspaceAccess(false);
}

export function requireAdminUser() {
  return requireWorkspaceAccess(true);
}

