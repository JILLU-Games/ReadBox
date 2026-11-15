import { deleteUserAction } from "@/app/(workspace)/vcon/users/actions";
import { UsersDirectory } from "@/components/vcon/users-directory";
import { env } from "@/config/env";
import { listManagedUsers, type ManagedUserListResult } from "@/core/accounts/users";
import { requireAdminUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import { logger } from "@/core/server/logger";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdminUser();
  const resolvedParams = await searchParams;
  const query = typeof resolvedParams.q === "string" ? resolvedParams.q : "";
  const page = Number.parseInt(resolvedParams.page ?? "1", 10) || 1;

  const emptyList: ManagedUserListResult = {
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 25,
    totalPages: 1,
    query: query.trim(),
  };

  let list = emptyList;
  let databaseConnected = false;

  if (env.databaseUrl) {
    try {
      list = await listManagedUsers(getPrismaClient(), { query, page });
      databaseConnected = true;
    } catch {
      logger.error("admin_users_list_failed");
    }
  }

  return (
    <UsersDirectory
      list={list}
      databaseConfigured={Boolean(env.databaseUrl)}
      databaseConnected={databaseConnected}
      onDeleteUser={deleteUserAction}
    />
  );
}
