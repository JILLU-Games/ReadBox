import { signOutAction } from "@/app/sign-in/actions";
import { AppShell, type AppShellMailboxLink } from "@/components/layout/app-shell";
import { env } from "@/config/env";
import { getAuthorizedWorkspaceUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import {
  isDemoPreviewWorkspaceActive,
  listDemoUserMailboxes,
} from "@/core/messages/demo-workspace";
import { listUserMailboxes } from "@/core/messages/service";
import { getSiteSettings } from "@/core/settings/service";
import type { ReactNode } from "react";

async function loadSidebarMailboxes(user: {
  readonly id: bigint;
  readonly username: string;
  readonly isAdministrator: boolean;
}): Promise<readonly AppShellMailboxLink[]> {
  let items: readonly AppShellMailboxLink[] = [];
  if (env.databaseUrl) {
    try {
      const listResult = await listUserMailboxes(
        getPrismaClient(),
        {
          userId: user.id,
          username: user.username,
          isAdministrator: user.isAdministrator,
        },
        { page: 1 },
      );
      items = listResult.items;
    } catch {
      items = [];
    }
  } else if (isDemoPreviewWorkspaceActive()) {
    items = listDemoUserMailboxes(user.isAdministrator, { page: 1 }).items;
  }

  return items.map((mbx) => ({
    uuid: mbx.uuid,
    emailAddress: mbx.emailAddress,
    unreadMessages: mbx.unreadMessages,
    totalMessages: mbx.totalMessages,
  }));
}

export default async function WorkspaceLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const user = await getAuthorizedWorkspaceUser();
  const [settings, mailboxes] = await Promise.all([
    getSiteSettings(),
    user ? loadSidebarMailboxes(user) : Promise.resolve([]),
  ]);
  const devBypassActive =
    env.nodeEnv === "development" && env.devAuthMode === "bypass";

  return (
    <AppShell
      user={
        user
          ? {
              username: user.username,
              isAdministrator: user.isAdministrator,
            }
          : null
      }
      branding={{
        siteName: settings.siteName,
        siteTagline: settings.siteTagline,
        logoUrl: settings.logoUrl,
        statusLabel: settings.databaseConnected
          ? "PostgreSQL workspace"
          : "Workspace ready",
        statusDescription: settings.siteTagline,
      }}
      mailboxes={mailboxes}
      signOutAction={devBypassActive ? undefined : signOutAction}
    >
      {children}
    </AppShell>
  );
}
