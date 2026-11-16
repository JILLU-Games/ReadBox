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

  let listResult = createUnconfiguredUserMailboxList({
    isAdministrator: user.isAdministrator,
  });

  if (env.databaseUrl) {
    try {
      listResult = await listUserMailboxes(
        getPrismaClient(),
        {
          userId,
          username: user.username,
          isAdministrator: user.isAdministrator,
        },
        { page: 1 },
      );
    } catch {
      listResult = createUnconfiguredUserMailboxList({
        isAdministrator: user.isAdministrator,
      });
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
      domains={listResult.availableDomains}
      capabilities={listResult.capabilities}
      databaseConfigured={listResult.databaseConfigured}
      createMailboxAction={createUserMailboxAction}
    >
      {children}
    </UsersWorkspaceShell>
  );
}
