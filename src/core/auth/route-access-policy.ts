export interface RouteUserRole {
  isAdministrator: boolean;
}

export type RouteAccessDecision = "allow" | "sign-in" | "not-found";

export function decideWorkspaceRouteAccess(
  authEnabled: boolean,
  user: RouteUserRole | null,
  adminOnly = false,
  devBypassActive = false,
): RouteAccessDecision {
  if (devBypassActive && user) {
    if (adminOnly && !user.isAdministrator) return "not-found";
    return "allow";
  }
  if (!authEnabled || !user) return "sign-in";
  if (adminOnly && !user.isAdministrator) return "not-found";
  return "allow";
}
