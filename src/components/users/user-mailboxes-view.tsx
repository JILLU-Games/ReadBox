"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { notify } from "@/components/ui/notifications";
import { CreateUserMailboxModal } from "@/components/users/create-user-mailbox-modal";
import { LiveWorkspaceNavigationBar } from "@/components/users/live-mail-notifier";
import type { MailboxActionResult } from "@/core/mailboxes/service";
import type {
  LiveUpdatePayload,
  UserMailboxListResult,
  UserMailboxSummaryItem,
} from "@/core/messages/service";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Copy,
  Database,
  Mail,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

export interface UserMailboxesViewProps {
  readonly listResult: UserMailboxListResult;
  readonly createMailboxAction: (input: {
    readonly localPart: string;
    readonly domainUuid?: string;
  }) => Promise<
    MailboxActionResult<{
      uuid: string;
      emailAddress: string;
      localPart: string;
    }>
  >;
  readonly deleteMailboxAction: (input: {
    readonly mailboxUuid: string;
    readonly confirmationEmail: string;
  }) => Promise<MailboxActionResult<{ emailAddress: string }>>;
  readonly bulkDeleteMailboxesAction: (input: {
    readonly mailboxUuids: readonly string[];
    readonly confirmed: boolean;
  }) => Promise<
    MailboxActionResult<{ purgedCount: number; purgedEmails: string[] }>
  >;
}

export function UserMailboxesView({
  listResult,
  createMailboxAction,
  deleteMailboxAction,
  bulkDeleteMailboxesAction,
}: UserMailboxesViewProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedUuids, setSelectedUuids] = useState<Set<string>>(new Set());
  const [purgeTarget, setPurgeTarget] = useState<UserMailboxSummaryItem | null>(
    null,
  );
  const [purgeConfirmation, setPurgeConfirmation] = useState("");
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [liveMailboxCounts, setLiveMailboxCounts] = useState<
    Record<
      string,
      {
        total: number;
        unread: number;
        lastReceivedAt: string | null;
        status: string;
      }
    >
  >({});
  const [isPending, startTransition] = useTransition();

  const canDeleteMailboxes = listResult.capabilities.canDeleteMailboxes;

  function handleLivePayload(payload: LiveUpdatePayload) {
    if (!payload.mailboxes?.length) return;
    setLiveMailboxCounts((prev) => {
      const next = { ...prev };
      for (const mbx of payload.mailboxes) {
        next[mbx.uuid] = {
          total: mbx.total_messages,
          unread: mbx.unread_messages,
          lastReceivedAt: mbx.last_received_at,
          status: mbx.status,
        };
      }
      return next;
    });
  }

  async function handleCopyEmail(emailAddress: string) {
    try {
      await navigator.clipboard?.writeText(emailAddress);
      notify.success(`Copied ${emailAddress}`);
    } catch {
      notify.error("Unable to copy address.");
    }
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedUuids(new Set(listResult.items.map((item) => item.uuid)));
    } else {
      setSelectedUuids(new Set());
    }
  }

  function toggleSelectOne(uuid: string, checked: boolean) {
    setSelectedUuids((prev) => {
      const next = new Set(prev);
      if (checked) next.add(uuid);
      else next.delete(uuid);
      return next;
    });
  }

  function handleConfirmSinglePurge() {
    if (!purgeTarget) return;
    setPurgeError(null);
    startTransition(async () => {
      const result = await deleteMailboxAction({
        mailboxUuid: purgeTarget.uuid,
        confirmationEmail: purgeConfirmation,
      });

      if (!result.ok) {
        setPurgeError(result.error);
        notify.error(result.error);
        return;
      }

      notify.success(
        result.message ??
          `Mailbox ${purgeTarget.emailAddress} permanently deleted.`,
      );
      setPurgeTarget(null);
      setPurgeConfirmation("");
      setSelectedUuids((prev) => {
        const next = new Set(prev);
        next.delete(purgeTarget.uuid);
        return next;
      });
    });
  }

  function handleConfirmBulkPurge() {
    const targets = Array.from(selectedUuids);
    if (targets.length === 0) return;
    startTransition(async () => {
      const result = await bulkDeleteMailboxesAction({
        mailboxUuids: targets,
        confirmed: true,
      });

      if (!result.ok) {
        notify.error(result.error);
        return;
      }

      notify.success(
        result.message ??
          `${result.data.purgedCount} mailbox(es) permanently deleted.`,
      );
      setSelectedUuids(new Set());
      setBulkConfirmOpen(false);
    });
  }

  const allSelected =
    listResult.items.length > 0 &&
    listResult.items.every((item) => selectedUuids.has(item.uuid));

  return (
    <div className="space-y-6">
      <LiveWorkspaceNavigationBar
        visibleMailboxUuids={listResult.items.map((item) => item.uuid)}
        pollingEnabled={listResult.databaseConfigured}
        onLivePayload={handleLivePayload}
      />

      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Icon glyph={Mail} />
              <span>Workspace Mailboxes</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              My Mailboxes
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Access your assigned receive-only mailboxes or create a new
              mailbox on an active verified domain.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={!listResult.databaseConfigured}
          >
            <Icon glyph={Plus} />
            Create mailbox
          </Button>
        </div>

        {!listResult.databaseConfigured ? (
          <div className="mt-4 flex items-center gap-2.5 rounded-md border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-xs text-foreground">
            <Icon glyph={Database} className="text-warning" />
            <span>
              Database connection is not configured in this preview environment.
            </span>
          </div>
        ) : null}

        <form
          method="get"
          action="/users/mailboxes"
          role="search"
          className="mt-5 flex flex-wrap items-center gap-2.5"
        >
          <div className="relative min-w-56 flex-1">
            <label htmlFor="user-mailboxes-q" className="sr-only">
              Search mailboxes
            </label>
            <input
              id="user-mailboxes-q"
              name="q"
              defaultValue={listResult.query}
              placeholder="Search local part or full address"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            />
          </div>

          <div>
            <label htmlFor="user-mailboxes-status" className="sr-only">
              Filter by status
            </label>
            <select
              id="user-mailboxes-status"
              name="status"
              defaultValue={
                listResult.statusFilter === "all" ? "" : listResult.statusFilter
              }
              className="flex h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          <Button type="submit" variant="secondary">
            <Icon glyph={Search} />
            Filter
          </Button>
        </form>
      </section>

      {canDeleteMailboxes && listResult.items.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-xs">
          <label className="inline-flex items-center gap-2 font-medium text-foreground">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => toggleSelectAll(e.target.checked)}
              className="size-4 rounded border-input"
            />
            Select all on page
          </label>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">
              {selectedUuids.size} selected
            </span>
            <Button
              type="button"
              variant="destructive"
              disabled={selectedUuids.size === 0 || isPending}
              onClick={() => setBulkConfirmOpen(true)}
            >
              <Icon glyph={Trash2} />
              Delete selected
            </Button>
          </div>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {canDeleteMailboxes ? (
                  <th className="w-10 px-4 py-3">
                    <span className="sr-only">Select</span>
                  </th>
                ) : null}
                <th className="px-4 py-3">Mailbox</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Messages</th>
                <th className="px-4 py-3">Unread</th>
                <th className="px-4 py-3">Last received</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {listResult.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={canDeleteMailboxes ? 8 : 7}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No matching mailboxes found in your workspace.
                  </td>
                </tr>
              ) : (
                listResult.items.map((mailbox) => {
                  const live = liveMailboxCounts[mailbox.uuid];
                  const status = live?.status ?? mailbox.status;
                  const totalMessages =
                    live !== undefined
                      ? String(live.total)
                      : mailbox.totalMessages;
                  const unreadMessages =
                    live !== undefined
                      ? String(live.unread)
                      : mailbox.unreadMessages;
                  const lastReceivedAt =
                    live !== undefined
                      ? live.lastReceivedAt
                      : mailbox.lastReceivedAt;

                  return (
                    <tr key={mailbox.uuid} className="hover:bg-muted/30">
                      {canDeleteMailboxes ? (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${mailbox.emailAddress}`}
                            checked={selectedUuids.has(mailbox.uuid)}
                            onChange={(e) =>
                              toggleSelectOne(mailbox.uuid, e.target.checked)
                            }
                            className="size-4 rounded border-input"
                          />
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleCopyEmail(mailbox.emailAddress)}
                          className="inline-flex items-center gap-1.5 font-mono text-sm font-medium text-foreground hover:text-primary"
                          title="Copy email address"
                        >
                          <span>{mailbox.emailAddress}</span>
                          <Icon glyph={Copy} className="size-3.5" />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize",
                            status === "active"
                              ? "bg-success/15 text-success"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">
                        {totalMessages}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">
                        {unreadMessages}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {lastReceivedAt
                          ? lastReceivedAt.slice(0, 16).replace("T", " ")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {mailbox.createdAt.slice(0, 10)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Link
                            href={`/users/inbox/${mailbox.uuid}`}
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            Open inbox
                            <Icon glyph={ArrowRight} className="size-3.5" />
                          </Link>
                          {canDeleteMailboxes ? (
                            <button
                              type="button"
                              onClick={() => {
                                setPurgeTarget(mailbox);
                                setPurgeConfirmation("");
                                setPurgeError(null);
                              }}
                              className="inline-flex min-h-8 items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
                            >
                              <Icon glyph={Trash2} className="size-3.5" />
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {listResult.totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>
              Page {listResult.page} of {listResult.totalPages} (
              {listResult.totalCount} total)
            </span>
            <div className="flex items-center gap-2">
              {listResult.page > 1 ? (
                <Link
                  href={`/users/mailboxes?page=${listResult.page - 1}&q=${encodeURIComponent(listResult.query)}&status=${listResult.statusFilter === "all" ? "" : listResult.statusFilter}`}
                  className="inline-flex min-h-8 items-center rounded-md border border-border bg-background px-3 font-medium text-foreground hover:bg-muted"
                >
                  Previous
                </Link>
              ) : null}
              {listResult.page < listResult.totalPages ? (
                <Link
                  href={`/users/mailboxes?page=${listResult.page + 1}&q=${encodeURIComponent(listResult.query)}&status=${listResult.statusFilter === "all" ? "" : listResult.statusFilter}`}
                  className="inline-flex min-h-8 items-center rounded-md border border-border bg-background px-3 font-medium text-foreground hover:bg-muted"
                >
                  Next
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <CreateUserMailboxModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        domains={listResult.availableDomains}
        createAction={createMailboxAction}
      />

      {purgeTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="purge-user-mailbox-title"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-destructive">
                <Icon glyph={AlertTriangle} />
                <h2
                  id="purge-user-mailbox-title"
                  className="text-base font-semibold"
                >
                  Permanently delete mailbox
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPurgeTarget(null)}
                aria-label="Close delete mailbox dialog"
                className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
              >
                <Icon glyph={X} />
              </button>
            </div>

            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              This permanently removes{" "}
              <strong className="font-mono text-foreground">
                {purgeTarget.emailAddress}
              </strong>
              , all indexed messages, stored attachments, and its Maildir folder.
              Type the full mailbox address to confirm.
            </p>

            <div className="mt-4">
              <label
                htmlFor="confirm-user-mailbox-delete"
                className="block text-xs font-medium text-foreground"
              >
                Confirm address
              </label>
              <input
                id="confirm-user-mailbox-delete"
                type="text"
                value={purgeConfirmation}
                onChange={(e) => {
                  setPurgeConfirmation(e.target.value);
                  setPurgeError(null);
                }}
                placeholder={purgeTarget.emailAddress}
                autoComplete="off"
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 font-mono text-sm text-foreground"
              />
            </div>

            {purgeError ? (
              <div
                role="alert"
                className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {purgeError}
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPurgeTarget(null)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={handleConfirmSinglePurge}
              >
                <Icon glyph={Trash2} />
                Permanently delete
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {bulkConfirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-purge-user-mailbox-title"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h2
              id="bulk-purge-user-mailbox-title"
              className="text-base font-semibold text-foreground"
            >
              Delete {selectedUuids.size} selected mailbox(es)?
            </h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Selected mailboxes, their indexed messages, extracted attachments,
              and Maildir storage will be permanently purged.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setBulkConfirmOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmBulkPurge}
                disabled={isPending}
              >
                <Icon glyph={Trash2} />
                Confirm bulk purge
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
