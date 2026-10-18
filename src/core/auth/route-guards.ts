import { env } from "@/config/env";
import { getCurrentUser } from "@/core/auth/current-user";
import { decideWorkspaceRouteAccess } from "@/core/auth/route-access-policy";
import { notFound, redirect } from "next/navigation";
import "server-only";

async function requireWorkspaceAccess(adminOnly: boolean) {
  const user = env.authEnabled ? await getCurrentUser() : null;
  const decision = decideWorkspaceRouteAccess(env.authEnabled, user, adminOnly);

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
