import {
  provisionMaildirsAction,
  rebuildMailIndexAction,
  recalculateCountersAction,
  repairMessageBodiesAction,
  syncMailserverMailboxesAction,
  verifyPostfixContractAction,
} from "@/app/(workspace)/vcon/operations/actions";
import { OperationsConsole } from "@/components/vcon/operations-console";
import { env } from "@/config/env";
import { requireAdminUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import {
  getOperationsOverview,
  type OperationsPrismaClient,
  type OperationsRuntimeConfig,
} from "@/core/operations/service";

export const dynamic = "force-dynamic";

function operationsConfig(): OperationsRuntimeConfig {
  return {
    mailStorageRoot: env.mailStorageRoot,
    attachmentStorageRoot: env.attachmentStorageRoot,
    ingestionLockFile: env.ingestionLockFile,
    mailboxProvisionLockRoot: env.mailboxProvisionLockRoot,
    ingestionStaleAfterSeconds: env.ingestionStaleAfterSeconds,
    maxMessageSizeMb: env.maxMessageSizeMb,
    maxAttachmentSizeMb: env.maxAttachmentSizeMb,
    maxAttachmentsPerMessage: env.maxAttachmentsPerMessage,
  };
}

export default async function AdminOperationsPage() {
  await requireAdminUser();

  const prisma = env.databaseUrl
    ? (getPrismaClient() as unknown as OperationsPrismaClient)
    : null;

  const overview = await getOperationsOverview(prisma, operationsConfig(), {
    hasDatabaseUrl: Boolean(env.databaseUrl),
  });

  return (
    <OperationsConsole
      overview={overview}
      onVerifyPostfix={verifyPostfixContractAction}
      onSyncMailserver={syncMailserverMailboxesAction}
      onProvisionMaildirs={provisionMaildirsAction}
      onRebuildIndex={rebuildMailIndexAction}
      onRecalculateCounters={recalculateCountersAction}
      onRepairBodies={repairMessageBodiesAction}
    />
  );
}
