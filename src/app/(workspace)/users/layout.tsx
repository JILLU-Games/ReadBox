import { createUserMailboxAction } from "@/app/(workspace)/users/mailboxes/actions";
import { UsersWorkspaceShell } from "@/components/users/users-workspace-shell";
import { env } from "@/config/env";
import { requireWorkspaceUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import {
  isDemoPreviewWorkspaceActive,
  listDemoUserMailboxes,
} from "@/core/messages/demo-workspace";
import {
  createUnconfiguredUserMailboxList,
  listUserMailboxes,
} from "@/core/messages/service";
import { logger } from "@/core/server/logger";
import type { ReactNode } from "react";

export default async function UsersWorkspaceLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const user = await requireWorkspaceUser();
  let userId = BigInt(0);
  try {
    userId = BigInt(user.id);
  } catch {
    userId = BigInt(0);
  }

  let listResult = createUnconfiguredUserMailboxList(
    { isAdministrator: user.isAdministrator },
    env.nodeEnv === "production" && !env.databaseUrl
      ? "Database connection is not configured."
      : undefined,
  );

  if (env.databaseUrl) {
    try {
      listResult = await listUserMailboxes(
        getPrismaClient(),
        {
          userId,
          authSource: user.authSource,
          username: user.username,
          isAdministrator: user.isAdministrator,
        },
        { page: 1 },
      );
    } catch (error) {
      logger.error("users_layout_db_unavailable", {
        reason: error instanceof Error ? error.name : "unknown_error",
      });
      listResult = createUnconfiguredUserMailboxList(
        { isAdministrator: user.isAdministrator },
        "Unable to connect to PostgreSQL right now. Mailbox navigation is temporarily unavailable.",
      );
    }
  } else if (isDemoPreviewWorkspaceActive()) {
    listResult = listDemoUserMailboxes(
      user.isAdministrator,
      { page: 1 },
      user.id,
    );
  }

  return (
    <UsersWorkspaceShell
      mailboxes={listResult.items}
      totalMailboxCount={listResult.totalCount}
      domains={listResult.availableDomains}
      capabilities={listResult.capabilities}
      databaseConfigured={listResult.databaseConfigured}
      databaseError={listResult.databaseError}
      createMailboxAction={createUserMailboxAction}
    >
      {children}
    </UsersWorkspaceShell>
  );
}
