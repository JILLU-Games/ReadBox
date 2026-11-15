import { signOutAction } from "@/app/sign-in/actions";
import { AppShell } from "@/components/layout/app-shell";
import { env } from "@/config/env";
import { requireWorkspaceUser } from "@/core/auth/route-guards";
import type { ReactNode } from "react";

export default async function WorkspaceLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const user = await requireWorkspaceUser();
  const devBypassActive =
    env.nodeEnv === "development" && env.devAuthMode === "bypass";

  return (
    <AppShell
      user={{
        username: user.username,
        isAdministrator: user.isAdministrator,
      }}
      signOutAction={devBypassActive ? undefined : signOutAction}
    >
      {children}
    </AppShell>
  );
}
