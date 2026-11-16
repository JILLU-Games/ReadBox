import { updateUserAction } from "@/app/(workspace)/vcon/users/actions";
import {
  AlertBanner,
  Button,
  PageTitle,
  Panel,
  PanelBody,
} from "@/components/ui";
import { UserForm } from "@/components/vcon/user-form";
import { env } from "@/config/env";
import {
  getManagedUserForEdit,
  listAssignableMailboxes,
} from "@/core/accounts/users";
import { requireAdminUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminEditUserPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  await requireAdminUser();
  const { id } = await params;

  if (!env.databaseUrl) {
    return (
      <Panel className="mx-auto max-w-xl">
        <PanelBody className="space-y-3 p-4">
          <PageTitle>Database not configured</PageTitle>
          <AlertBanner variant="warning" role="status">
            Configure DATABASE_URL before editing persistent user accounts.
          </AlertBanner>
          <div>
            <Button asChild size="sm" variant="outline">
              <Link href="/vcon/users">Back to users</Link>
            </Button>
          </div>
        </PanelBody>
      </Panel>
    );
  }

  const prisma = getPrismaClient();
  const [userResult, mailboxes] = await Promise.all([
    getManagedUserForEdit(prisma, id),
    listAssignableMailboxes(prisma),
  ]);

  if (!userResult.ok) {
    if (userResult.code === "not_found") {
      notFound();
    }
    return (
      <Panel className="mx-auto max-w-xl">
        <PanelBody className="space-y-3 p-4">
          <PageTitle>Edit not permitted</PageTitle>
          <AlertBanner variant="error">{userResult.error}</AlertBanner>
          <div>
            <Button asChild size="sm" variant="outline">
              <Link href="/vcon/users">Back to users</Link>
            </Button>
          </div>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <UserForm
      mode="edit"
      initialUser={userResult.data}
      mailboxes={mailboxes}
      databaseConfigured={true}
      onUpdate={updateUserAction}
    />
  );
}
