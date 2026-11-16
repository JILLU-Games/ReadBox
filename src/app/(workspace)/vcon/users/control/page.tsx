import {
  decidePendingUserAction,
  saveUserControlSettingsAction,
  saveUserPolicyOverrideAction,
} from "@/app/(workspace)/vcon/users/control/actions";
import { UsersControlConsole } from "@/components/vcon/users-control-console";
import { env } from "@/config/env";
import { listUsersControlSnapshot } from "@/core/accounts/user-control-policy";
import { requireAdminUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";

export const dynamic = "force-dynamic";

export default async function AdminUsersControlPage() {
  await requireAdminUser();
  const prisma = env.databaseUrl ? getPrismaClient() : null;
  const snapshot = await listUsersControlSnapshot(prisma);

  return (
    <UsersControlConsole
      initialSettings={snapshot.settings}
      domains={snapshot.domains}
      pendingUsers={snapshot.pendingUsers}
      governedUsers={snapshot.governedUsers}
      onSaveSettings={saveUserControlSettingsAction}
      onDecidePendingUser={decidePendingUserAction}
      onSaveUserOverride={saveUserPolicyOverrideAction}
    />
  );
}
