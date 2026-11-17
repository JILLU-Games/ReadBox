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
import { logger } from "@/core/server/logger";
import { UserOverview } from "@/users/overview-panel";

export default async function UserWorkspacePage() {
  const user = await requireWorkspaceUser();
  let userId = BigInt(0);
  try {
    userId = BigInt(user.id);
  } catch {
    userId = BigInt(0);
  }

  let snapshot = createUnconfiguredUserWorkspaceOverview(
    { isAdministrator: user.isAdministrator },
    env.nodeEnv === "production" && !env.databaseUrl
      ? "Database connection is not configured."
      : undefined,
  );

  if (env.databaseUrl) {
    try {
      snapshot = await getUserWorkspaceOverview(getPrismaClient(), {
        userId,
        authSource: user.authSource,
        username: user.username,
        isAdministrator: user.isAdministrator,
      });
    } catch (error) {
      logger.error("users_overview_db_unavailable", {
        reason: error instanceof Error ? error.name : "unknown_error",
      });
      snapshot = createUnconfiguredUserWorkspaceOverview(
        { isAdministrator: user.isAdministrator },
        "Unable to load your workspace overview from PostgreSQL right now. Verify connectivity and refresh.",
      );
    }
  } else if (isDemoPreviewWorkspaceActive()) {
    snapshot = getDemoUserOverview(user.isAdministrator, user.id);
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
