"use client";

import {
  AlertBanner,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Icon,
  Input,
  Label,
  notify,
  PageTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import type {
  ManagedUserListItem,
  ManagedUserListResult,
  ManagedUserResult,
} from "@/core/accounts/users";
import { Search, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function formatShortDate(iso: string | null, fallback: string): string {
  if (!iso) return fallback;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function buildUsersHref(query: string, page: number): string {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/vcon/users?${suffix}` : "/vcon/users";
}

export function UsersDirectory({
  list,
  databaseConfigured,
  databaseConnected,
  onDeleteUser,
}: {
  readonly list: ManagedUserListResult;
  readonly databaseConfigured: boolean;
  readonly databaseConnected: boolean;
  readonly onDeleteUser: (
    userId: string,
  ) => Promise<ManagedUserResult<{ username: string }>>;
}) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<ManagedUserListItem | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  async function handleConfirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const result = await onDeleteUser(deleteTarget.id);
      if (!result.ok) {
        notify.error(result.error);
        setDeleteTarget(null);
        return;
      }
      notify.success(
        `User ${result.data.username} deleted. Mailboxes and messages were preserved.`,
      );
      setDeleteTarget(null);
      router.refresh();
    } catch {
      notify.error("Could not delete user. Try again later.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <PageTitle>User management</PageTitle>
        <Button asChild size="sm">
          <Link href="/vcon/users/new">
            <Icon glyph={UserPlus} />
            <span>Add user</span>
          </Link>
        </Button>
      </header>

      {!databaseConfigured ? (
        <AlertBanner variant="warning" role="status">
          Database is not configured in this local environment. User accounts
          stored in PostgreSQL will appear here once DATABASE_URL is set.
        </AlertBanner>
      ) : !databaseConnected ? (
        <AlertBanner variant="error">
          Unable to load users from PostgreSQL right now.
        </AlertBanner>
      ) : null}

      <form
        method="get"
        action="/vcon/users"
        role="search"
        className="flex flex-wrap items-center gap-2"
      >
        <div className="relative min-w-56 flex-1">
          <Label className="sr-only" htmlFor="users-search">
            Search users
          </Label>
          <Icon
            glyph={Search}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="users-search"
            name="q"
            defaultValue={list.query}
            placeholder="Search username, name, or email"
            className="pl-8"
          />
        </div>
        <Button type="submit" size="sm" variant="outline">
          Search
        </Button>
        {list.query ? (
          <Button asChild size="sm" variant="ghost">
            <Link href="/vcon/users">Clear</Link>
          </Button>
        ) : null}
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Mailboxes</TableHead>
            <TableHead>Delete messages</TableHead>
            <TableHead>Delete mailboxes</TableHead>
            <TableHead>Last login</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.items.length > 0 ? (
            list.items.map((item) => {
              const fullName = [item.firstName, item.lastName]
                .filter(Boolean)
                .join(" ");
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {item.username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fullName ||
                          item.email ||
                          `Joined ${item.dateJoined.slice(0, 10)}`}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.isAdministrator ? "success" : "default"}>
                      {item.isAdministrator ? "Administrator" : "User"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.isActive ? "success" : "warning"}>
                      {item.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {item.mailboxCount}
                  </TableCell>
                  <TableCell>
                    {item.canDeleteMessages ? "Yes" : "No"}
                  </TableCell>
                  <TableCell>
                    {item.canDeleteMailboxes ? "Yes" : "No"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatShortDate(item.lastLogin, "Never")}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.isAdministrator ? (
                      <span className="text-xs text-muted-foreground">
                        Managed outside this screen
                      </span>
                    ) : (
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/vcon/users/${item.id}/edit`}>Edit</Link>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Icon glyph={Trash2} />
                          <span>Delete</span>
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={8}
                className="py-8 text-center text-xs text-muted-foreground"
              >
                No users found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {list.totalPages > 1 ? (
        <nav
          aria-label="Users pagination"
          className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
        >
          <span>
            Showing page {list.page} of {list.totalPages} ({list.totalCount}{" "}
            total)
          </span>
          <div className="flex items-center gap-2">
            {list.page > 1 ? (
              <Button asChild size="sm" variant="outline">
                <Link href={buildUsersHref(list.query, list.page - 1)}>
                  Previous
                </Link>
              </Button>
            ) : null}
            {list.page < list.totalPages ? (
              <Button asChild size="sm" variant="outline">
                <Link href={buildUsersHref(list.query, list.page + 1)}>
                  Next
                </Link>
              </Button>
            ) : null}
          </div>
        </nav>
      ) : null}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Delete user {deleteTarget?.username}?</DialogTitle>
          <DialogDescription>
            This deletes the user login and removes their mailbox memberships.
            Mailboxes, messages, attachments, and audit history are preserved.
          </DialogDescription>
          <DialogFooter>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={deleting}
              onClick={() => void handleConfirmDelete()}
            >
              {deleting ? "Deleting..." : "Confirm delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
