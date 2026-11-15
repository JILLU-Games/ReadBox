import { signOutAction } from "@/app/sign-in/actions";
import { AppShell } from "@/components/layout/app-shell";
import { env } from "@/config/env";
import { requireWorkspaceUser } from "@/core/auth/route-guards";
import { getSiteSettings } from "@/core/settings/service";
import type { ReactNode } from "react";

export default async function WorkspaceLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [user, settings] = await Promise.all([
    requireWorkspaceUser(),
    getSiteSettings(),
  ]);
  const devBypassActive =
    env.nodeEnv === "development" && env.devAuthMode === "bypass";

  return (
    <AppShell
      user={{
        username: user.username,
        isAdministrator: user.isAdministrator,
      }}
      branding={{
        siteName: settings.siteName,
        siteTagline: settings.siteTagline,
        logoUrl: settings.logoUrl,
        statusLabel: settings.databaseConnected
          ? "PostgreSQL workspace"
          : "Workspace ready",
        statusDescription: settings.siteTagline,
      }}
      signOutAction={devBypassActive ? undefined : signOutAction}
    >
      {children}
    </AppShell>
  );
}
