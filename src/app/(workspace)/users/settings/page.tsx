import {
  revokeOtherUserSessionsAction,
  revokeUserSessionAction,
  updateUserPasswordAction,
  updateUserProfileAction,
} from "@/app/(workspace)/users/settings/actions";
import { getCurrentServerSessionId } from "@/app/(workspace)/users/settings/current-session";
import { UserSettingsView } from "@/components/users/user-settings-view";
import { env } from "@/config/env";
import { getDemoUserControlSettings } from "@/core/accounts/user-control-policy";
import {
  getUserProfile,
  getUserSecuritySnapshot,
} from "@/core/accounts/user-profile";
import {
  DEFAULT_USER_PASSWORD_POLICY,
  type UserProfileRecord,
  type UserSecuritySnapshot,
} from "@/core/accounts/user-profile-schema";
import {
  getDevDemoProfile,
  getDevDemoSecuritySnapshot,
} from "@/core/auth/dev-demo-auth";
import { requireWorkspaceUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import {
  isDemoPreviewWorkspaceActive,
  listDemoUserMailboxes,
} from "@/core/messages/demo-workspace";
import { listUserMailboxes } from "@/core/messages/service";
import { logger } from "@/core/server/logger";

export default async function UserSettingsPage() {
  const user = await requireWorkspaceUser();
  let userId = BigInt(0);
  try {
    userId = BigInt(user.id);
  } catch {
    userId = BigInt(0);
  }

  const fallbackProfile: UserProfileRecord = {
    id: user.id.toString(),
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: "",
    isAdministrator: user.isAdministrator,
    authSource: user.authSource,
    editable: true,
    dateJoined: null,
    lastLogin: null,
  };

  let profile = fallbackProfile;
  let security: UserSecuritySnapshot = {
    passwordPolicy: DEFAULT_USER_PASSWORD_POLICY,
    activeSessions: [],
    recentEvents: [],
    canManageSecurity: true,
  };
  let databaseConfigured = false;
  let databaseError: string | undefined =
    env.nodeEnv === "production" && !env.databaseUrl
      ? "Database connection is not configured."
      : undefined;
  let mailboxUsed = 0;
  let mailboxMax = 0;

  const currentSessionId = await getCurrentServerSessionId();

  if (env.databaseUrl) {
    databaseConfigured = true;
    try {
      const prisma = getPrismaClient();
      const [profileResult, securitySnapshot, mailboxList] = await Promise.all([
        getUserProfile(prisma, { userId, authSource: user.authSource }),
        getUserSecuritySnapshot(
          prisma,
          {
            userId,
            authSource: user.authSource,
            username: user.username,
          },
          { currentSessionId },
        ),
        listUserMailboxes(
          prisma,
          {
            userId,
            authSource: user.authSource,
            username: user.username,
            isAdministrator: user.isAdministrator,
          },
          { page: 1 },
        ),
      ]);

      if (profileResult.ok) {
        profile = profileResult.data;
        security = securitySnapshot;
        mailboxUsed = mailboxList.totalCount;
        mailboxMax = mailboxList.capabilities.maxMailboxes ?? 0;
      } else if (isDemoPreviewWorkspaceActive()) {
        const demoProfile = getDevDemoProfile(user.id.toString());
        if (demoProfile) {
          profile = demoProfile;
        }
        const demoControl = getDemoUserControlSettings();
        security = getDevDemoSecuritySnapshot(
          user.id.toString(),
          currentSessionId,
          {
            minLength: Math.max(8, demoControl.minPasswordLength),
            requireStrongPassword: demoControl.requireStrongPassword,
          },
        );
        const demoMailboxes = listDemoUserMailboxes(
          user.isAdministrator,
          { page: 1 },
          user.id,
        );
        mailboxUsed = demoMailboxes.totalCount;
        mailboxMax = demoMailboxes.capabilities.maxMailboxes ?? 0;
      } else {
        databaseError =
          profileResult.error ||
          "Unable to load live profile settings from PostgreSQL.";
        security = securitySnapshot;
        mailboxUsed = mailboxList.totalCount;
        mailboxMax = mailboxList.capabilities.maxMailboxes ?? 0;
      }
    } catch (error) {
      if (isDemoPreviewWorkspaceActive()) {
        databaseConfigured = true;
        const demoProfile = getDevDemoProfile(user.id.toString());
        if (demoProfile) {
          profile = demoProfile;
        }
        const demoControl = getDemoUserControlSettings();
        security = getDevDemoSecuritySnapshot(
          user.id.toString(),
          currentSessionId,
          {
            minLength: Math.max(8, demoControl.minPasswordLength),
            requireStrongPassword: demoControl.requireStrongPassword,
          },
        );
        const demoMailboxes = listDemoUserMailboxes(
          user.isAdministrator,
          { page: 1 },
          user.id,
        );
        mailboxUsed = demoMailboxes.totalCount;
        mailboxMax = demoMailboxes.capabilities.maxMailboxes ?? 0;
      } else {
        databaseConfigured = false;
        logger.error("users_settings_db_unavailable", {
          reason: error instanceof Error ? error.name : "unknown_error",
        });
        databaseError =
          "Unable to connect to PostgreSQL right now. Profile and session controls are temporarily unavailable.";
      }
    }
  } else if (isDemoPreviewWorkspaceActive()) {
    databaseConfigured = true;
    const demoProfile = getDevDemoProfile(user.id.toString());
    if (demoProfile) {
      profile = demoProfile;
    }
    const demoControl = getDemoUserControlSettings();
    security = getDevDemoSecuritySnapshot(user.id.toString(), currentSessionId, {
      minLength: Math.max(8, demoControl.minPasswordLength),
      requireStrongPassword: demoControl.requireStrongPassword,
    });
    const demoMailboxes = listDemoUserMailboxes(
      user.isAdministrator,
      { page: 1 },
      user.id,
    );
    mailboxUsed = demoMailboxes.totalCount;
    mailboxMax = demoMailboxes.capabilities.maxMailboxes ?? 0;
  }

  return (
    <UserSettingsView
      profile={profile}
      security={security}
      mailboxQuota={{ used: mailboxUsed, max: mailboxMax }}
      databaseConfigured={databaseConfigured}
      databaseError={databaseError}
      updateProfileAction={updateUserProfileAction}
      updatePasswordAction={updateUserPasswordAction}
      revokeSessionAction={revokeUserSessionAction}
      revokeOtherSessionsAction={revokeOtherUserSessionsAction}
    />
  );
}
