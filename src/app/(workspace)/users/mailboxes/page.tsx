import {
  bulkDeleteUserMailboxesAction,
  createUserMailboxAction,
  deleteUserMailboxAction,
} from "@/app/(workspace)/users/mailboxes/actions";
import { UserMailboxesView } from "@/components/users/user-mailboxes-view";
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

export default async function UserMailboxesPage(props: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const user = await requireWorkspaceUser();
  const searchParams = await props.searchParams;

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
        {
          query: searchParams.q,
          status: searchParams.status,
          page: Number(searchParams.page) || 1,
        },
      );
    } catch (error) {
      logger.error("users_mailboxes_db_unavailable", {
        reason: error instanceof Error ? error.name : "unknown_error",
      });
      listResult = createUnconfiguredUserMailboxList(
        { isAdministrator: user.isAdministrator },
        "Unable to load mailboxes from PostgreSQL right now. Verify connectivity and refresh.",
      );
    }
  } else if (isDemoPreviewWorkspaceActive()) {
    listResult = listDemoUserMailboxes(
      user.isAdministrator,
      {
        query: searchParams.q,
        status: searchParams.status,
        page: Number(searchParams.page) || 1,
      },
      user.id,
    );
  }

  return (
    <UserMailboxesView
      listResult={listResult}
      createMailboxAction={createUserMailboxAction}
      deleteMailboxAction={deleteUserMailboxAction}
      bulkDeleteMailboxesAction={bulkDeleteUserMailboxesAction}
    />
  );
}
