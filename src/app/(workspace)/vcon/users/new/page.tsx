import { createUserAction } from "@/app/(workspace)/vcon/users/actions";
import { UserForm } from "@/components/vcon/user-form";
import { env } from "@/config/env";
import {
  listAssignableMailboxes,
  type AssignableMailboxOption,
} from "@/core/accounts/users";
import { requireAdminUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import { logger } from "@/core/server/logger";

export const dynamic = "force-dynamic";

export default async function AdminCreateUserPage() {
  await requireAdminUser();

  let mailboxes: AssignableMailboxOption[] = [];
  if (env.databaseUrl) {
    try {
      mailboxes = await listAssignableMailboxes(getPrismaClient());
    } catch {
      logger.error("admin_assignable_mailboxes_failed");
    }
  }

  return (
    <UserForm
      mode="create"
      mailboxes={mailboxes}
      databaseConfigured={Boolean(env.databaseUrl)}
      onCreate={createUserAction}
    />
  );
}
