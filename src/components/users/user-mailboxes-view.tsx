"use client";

import {
  AlertBanner,
  Badge,
  Button,
  Checkbox,
  CopyButton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  FormField,
  Icon,
  Input,
  Label,
  notify,
  PageHeader,
  Pagination,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { CreateUserMailboxModal } from "@/components/users/create-user-mailbox-modal";
import {
  LiveWorkspaceNavigationBar,
  useUsersLiveUpdates,
} from "@/components/users/live-mail-notifier";
import {
  buildMailboxesUrl,
  formatCompactTimestamp,
} from "@/components/users/user-workspace-helpers";
import type { MailboxActionResult } from "@/core/mailboxes/service";
import type {
  LiveUpdatePayload,
  UserMailboxListResult,
  UserMailboxSummaryItem,
} from "@/core/messages/service";
import {
  ArrowRight,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const liveContext = useUsersLiveUpdates();
  const usesShellModal = Boolean(
    liveContext.active && liveContext.openCreateMailboxModal,
  );
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
  const hasFilters =
    listResult.query.length > 0 || listResult.statusFilter !== "all";

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
      router.refresh();
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
      router.refresh();
    });
  }

  const allSelected =
    listResult.items.length > 0 &&
    listResult.items.every((item) => selectedUuids.has(item.uuid));
  const maxMailboxes = listResult.capabilities.maxMailboxes ?? 0;
  const canCreate =
    listResult.capabilities.canCreateMailboxes !== false &&
    (maxMailboxes <= 0 || listResult.totalCount < maxMailboxes);

  return (
    <div className="space-y-3">
      <LiveWorkspaceNavigationBar
        visibleMailboxUuids={listResult.items.map((item) => item.uuid)}
        pollingEnabled={listResult.databaseConfigured}
        onLivePayload={handleLivePayload}
      />

      <PageHeader
        title="My Mailboxes"
        actions={
          <Button
            type="button"
            onClick={() =>
              usesShellModal
                ? liveContext.openCreateMailboxModal?.()
                : setCreateOpen(true)
            }
            disabled={!listResult.databaseConfigured || !canCreate}
          >
            <Icon glyph={Plus} />
            Create mailbox
          </Button>
        }
      >
        {!listResult.databaseConfigured ? (
          <AlertBanner variant="warning" className="mb-2.5">
            Database connection is not configured.
          </AlertBanner>
        ) : null}

        <form
          method="get"
          action="/users/mailboxes"
          role="search"
          className="flex flex-wrap items-center gap-2"
        >
          <div className="min-w-48 flex-1">
            <Label htmlFor="user-mailboxes-q" className="sr-only">
              Search mailboxes
            </Label>
            <Input
              id="user-mailboxes-q"
              name="q"
              defaultValue={listResult.query}
              placeholder="Search local part or address"
            />
          </div>

          <div>
            <Label htmlFor="user-mailboxes-status" className="sr-only">
              Filter by status
            </Label>
            <Select
              id="user-mailboxes-status"
              name="status"
              defaultValue={
                listResult.statusFilter === "all" ? "" : listResult.statusFilter
              }
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </Select>
          </div>

          <Button type="submit" variant="secondary">
            <Icon glyph={Search} />
            Filter
          </Button>

          {hasFilters ? (
            <Button asChild variant="outline">
              <Link href="/users/mailboxes">
                <Icon glyph={RotateCcw} className="size-3" />
                Reset
              </Link>
            </Button>
          ) : null}
        </form>
      </PageHeader>

      {canDeleteMailboxes && listResult.items.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-card px-3 py-2 text-xs">
          <Label className="inline-flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={allSelected}
              onChange={(e) => toggleSelectAll(e.target.checked)}
            />
            Select all on page
          </Label>
          <div className="flex items-center gap-2.5">
            <span className="tabular-nums text-muted-foreground">
              {selectedUuids.size} selected
            </span>
            <Button
              type="button"
              size="sm"
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

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {canDeleteMailboxes ? (
              <TableHead className="w-8">
                <span className="sr-only">Select</span>
              </TableHead>
            ) : null}
            <TableHead>Mailbox</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Messages</TableHead>
            <TableHead className="text-right">Unread</TableHead>
            <TableHead>Last received</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {listResult.items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={canDeleteMailboxes ? 8 : 7}
                className="py-8 text-center text-muted-foreground"
              >
                No matching mailboxes found.
              </TableCell>
            </TableRow>
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
                <TableRow key={mailbox.uuid}>
                  {canDeleteMailboxes ? (
                    <TableCell>
                      <Checkbox
                        aria-label={`Select ${mailbox.emailAddress}`}
                        checked={selectedUuids.has(mailbox.uuid)}
                        onChange={(e) =>
                          toggleSelectOne(mailbox.uuid, e.target.checked)
                        }
                      />
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <CopyButton
                      value={mailbox.emailAddress}
                      title="Copy email address"
                      successMessage={`Copied ${mailbox.emailAddress}`}
                      errorMessage="Unable to copy address."
                      className="font-mono"
                    >
                      <span>{mailbox.emailAddress}</span>
                    </CopyButton>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={status === "active" ? "success" : "default"}
                    >
                      {status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-foreground">
                    {totalMessages}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium tabular-nums text-primary">
                    {unreadMessages}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums text-muted-foreground">
                    {formatCompactTimestamp(lastReceivedAt, "—")}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums text-muted-foreground">
                    {mailbox.createdAt.slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/users/inbox/${mailbox.uuid}`}>
                          Open inbox
                          <Icon glyph={ArrowRight} className="size-3" />
                        </Link>
                      </Button>
                      {canDeleteMailboxes ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPurgeTarget(mailbox);
                            setPurgeConfirmation("");
                            setPurgeError(null);
                          }}
                          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Icon glyph={Trash2} />
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <Pagination
        variant="boxed"
        page={listResult.page}
        totalPages={listResult.totalPages}
        totalCount={listResult.totalCount}
        prevHref={
          listResult.page > 1
            ? buildMailboxesUrl({
                page: listResult.page - 1,
                q: listResult.query,
                status: listResult.statusFilter,
              })
            : null
        }
        nextHref={
          listResult.page < listResult.totalPages
            ? buildMailboxesUrl({
                page: listResult.page + 1,
                q: listResult.query,
                status: listResult.statusFilter,
              })
            : null
        }
      />

      {!usesShellModal ? (
        <CreateUserMailboxModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          domains={listResult.availableDomains}
          createAction={createMailboxAction}
        />
      ) : null}

      <Dialog
        open={Boolean(purgeTarget)}
        onOpenChange={(open) => (!open ? setPurgeTarget(null) : undefined)}
      >
        <DialogContent className="max-w-md">
          <DialogTitle>Permanently delete mailbox</DialogTitle>
          {purgeTarget ? (
            <>
              <DialogDescription>
                Type{" "}
                <strong className="font-mono text-foreground">
                  {purgeTarget.emailAddress}
                </strong>{" "}
                to permanently remove this mailbox and all stored messages.
              </DialogDescription>
              <FormField
                id="confirm-user-mailbox-delete"
                label="Confirm address"
                error={purgeError ?? undefined}
              >
                <Input
                  id="confirm-user-mailbox-delete"
                  type="text"
                  value={purgeConfirmation}
                  onChange={(e) => {
                    setPurgeConfirmation(e.target.value);
                    setPurgeError(null);
                  }}
                  placeholder={purgeTarget.emailAddress}
                  autoComplete="off"
                  aria-invalid={Boolean(purgeError)}
                  aria-describedby={
                    purgeError ? "confirm-user-mailbox-delete-error" : undefined
                  }
                  className="font-mono"
                />
              </FormField>
              <DialogFooter>
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
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkConfirmOpen}
        onOpenChange={(open) => (!open ? setBulkConfirmOpen(false) : undefined)}
      >
        <DialogContent className="max-w-md">
          <DialogTitle>
            Delete {selectedUuids.size} selected mailbox(es)?
          </DialogTitle>
          <DialogDescription>
            Selected mailboxes and all of their messages and attachments will
            be permanently deleted.
          </DialogDescription>
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
