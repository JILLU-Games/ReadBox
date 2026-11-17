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
import { logger } from "@/core/server/logger";

export const dynamic = "force-dynamic";

export default async function AdminUsersControlPage() {
  await requireAdminUser();
  const demoMode =
    env.nodeEnv === "development" && env.devAuthMode === "demo";

  let prisma = null;
  let clientInitFailed = false;
  if (env.databaseUrl) {
    try {
      prisma = getPrismaClient();
    } catch (error) {
      clientInitFailed = true;
      logger.error("vcon_users_control_db_init_failed", {
        reason: error instanceof Error ? error.name : "unknown_error",
      });
    }
  }

  const snapshot = await listUsersControlSnapshot(prisma, {
    allowDemoFallback: demoMode,
  });
  const databaseError = clientInitFailed
    ? "Could not connect to PostgreSQL to load user governance settings."
    : snapshot.databaseError;

  return (
    <UsersControlConsole
      initialSettings={snapshot.settings}
      domains={snapshot.domains}
      pendingUsers={snapshot.pendingUsers}
      governedUsers={snapshot.governedUsers}
      databaseConfigured={Boolean(env.databaseUrl)}
      databaseConnected={!clientInitFailed && snapshot.databaseConnected}
      databaseError={databaseError}
      demoMode={demoMode}
      onSaveSettings={saveUserControlSettingsAction}
      onDecidePendingUser={decidePendingUserAction}
      onSaveUserOverride={saveUserPolicyOverrideAction}
    />
  );
}
