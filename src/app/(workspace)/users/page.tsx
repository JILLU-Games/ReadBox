import { createUserMailboxAction } from "@/app/(workspace)/users/mailboxes/actions";
import { env } from "@/config/env";
import { requireWorkspaceUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import {
  getDemoUserOverview,
  isDemoPreviewWorkspaceActive,
} from "@/core/messages/demo-workspace";
import {
  createUnconfiguredUserWorkspaceOverview,
  getUserWorkspaceOverview,
} from "@/core/messages/service";
import { UserOverview } from "@/users/overview-panel";

export default async function UserWorkspacePage() {
  const user = await requireWorkspaceUser();
  let userId = BigInt(0);
  try {
    userId = BigInt(user.id);
  } catch {
    userId = BigInt(0);
  }

  let snapshot = createUnconfiguredUserWorkspaceOverview({
    isAdministrator: user.isAdministrator,
  });

  if (env.databaseUrl) {
    try {
      snapshot = await getUserWorkspaceOverview(getPrismaClient(), {
        userId,
        username: user.username,
        isAdministrator: user.isAdministrator,
      });
    } catch {
      snapshot = createUnconfiguredUserWorkspaceOverview({
        isAdministrator: user.isAdministrator,
      });
    }
  } else if (isDemoPreviewWorkspaceActive()) {
    snapshot = getDemoUserOverview(user.isAdministrator);
  }

  return (
    <UserOverview
      snapshot={snapshot}
      username={user.username}
      isAdministrator={user.isAdministrator}
      createMailboxAction={createUserMailboxAction}
    />
  );
}
