import { updateUserAction } from "@/app/(workspace)/vcon/users/actions";
import { Button } from "@/components/ui/button";
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
      <section className="mx-auto max-w-xl rounded-lg border border-border bg-card p-5">
        <h1 className="text-base font-semibold">Database not configured</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Configure DATABASE_URL before editing persistent user accounts.
        </p>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href="/vcon/users">Back to users</Link>
          </Button>
        </div>
      </section>
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
      <section
        className="mx-auto max-w-xl rounded-lg border border-border bg-card p-5"
        role="alert"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Protected account
        </p>
        <h1 className="mt-1 text-base font-semibold">Edit not permitted</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {userResult.error}
        </p>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href="/vcon/users">Back to users</Link>
          </Button>
        </div>
      </section>
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
