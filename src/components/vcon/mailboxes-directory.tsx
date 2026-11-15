"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CopyMailboxButton } from "@/components/vcon/copy-mailbox-button";
import type {
  AdminMailboxListItem,
  AdminMailboxListResult,
  MailboxActionResult,
  MailboxCreationDomainOption,
} from "@/core/mailboxes/service";
import type { SystemMailboxLocalPart } from "@/core/mailboxes/validators";
import { MailPlus, Search, ShieldAlert, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function formatShortDate(iso: string | null, fallback: string): string {
  if (!iso) return fallback;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function buildMailboxesHref(
  query: string,
  status: string,
  domainUuid: string,
  page: number,
): string {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (status && status !== "all") params.set("status", status);
  if (domainUuid.trim()) params.set("domain", domainUuid.trim());
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/vcon/mailboxes?${suffix}` : "/vcon/mailboxes";
}

export function MailboxesDirectory({
  list,
  verifiedDomains,
  databaseConfigured,
  databaseConnected,
  onToggleActive,
  onBulkPurge,
  onCreateSystemMailbox,
}: {
  readonly list: AdminMailboxListResult;
  readonly verifiedDomains: readonly MailboxCreationDomainOption[];
  readonly databaseConfigured: boolean;
  readonly databaseConnected: boolean;
  readonly onToggleActive: (
    uuid: string,
    active: boolean,
  ) => Promise<MailboxActionResult<{ uuid: string; status: string }>>;
  readonly onBulkPurge: (
    uuids: readonly string[],
    confirmed: boolean,
  ) => Promise<MailboxActionResult<{ purgedCount: number; purgedEmails: string[] }>>;
  readonly onCreateSystemMailbox: (input: {
    readonly localPart: SystemMailboxLocalPart;
    readonly domainUuid?: string;
    readonly confirm: boolean;
  }) => Promise<
    MailboxActionResult<{ uuid: string; emailAddress: string; localPart: string }>
  >;
}) {
  const router = useRouter();
  const [selectedUuids, setSelectedUuids] = useState<string[]>([]);
  const [togglingUuid, setTogglingUuid] = useState<string | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkConfirmed, setBulkConfirmed] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);

  const [systemDialogOpen, setSystemDialogOpen] = useState(false);
  const [systemLocalPart, setSystemLocalPart] =
    useState<SystemMailboxLocalPart>("postmaster");
  const [systemDomainUuid, setSystemDomainUuid] = useState<string>(
    () =>
      verifiedDomains.find((d) => d.isDefault)?.uuid ??
      verifiedDomains[0]?.uuid ??
      "",
  );
  const [systemConfirmed, setSystemConfirmed] = useState(false);
  const [systemPending, setSystemPending] = useState(false);

  const selectedItems = useMemo(() => {
    const selectedSet = new Set(selectedUuids);
    return list.items.filter((item) => selectedSet.has(item.uuid));
  }, [list.items, selectedUuids]);

  const allOnPageSelected =
    list.items.length > 0 &&
    list.items.every((item) => selectedUuids.includes(item.uuid));

  function toggleRowSelection(uuid: string) {
    setSelectedUuids((current) =>
      current.includes(uuid)
        ? current.filter((item) => item !== uuid)
        : [...current, uuid],
    );
  }

  function toggleAllOnPage() {
    if (allOnPageSelected) {
      const pageSet = new Set(list.items.map((item) => item.uuid));
      setSelectedUuids((current) =>
        current.filter((uuid) => !pageSet.has(uuid)),
      );
      return;
    }
    const merged = new Set(selectedUuids);
    for (const item of list.items) {
      merged.add(item.uuid);
    }
    setSelectedUuids(Array.from(merged));
  }

  async function handleToggle(mailbox: AdminMailboxListItem) {
    if (togglingUuid) return;
    setTogglingUuid(mailbox.uuid);
    try {
      const targetActive = mailbox.status !== "active";
      const result = await onToggleActive(mailbox.uuid, targetActive);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.message ??
          (targetActive ? "Mailbox enabled." : "Mailbox disabled."),
      );
      router.refresh();
    } catch {
      toast.error("Unable to update mailbox status right now.");
    } finally {
      setTogglingUuid(null);
    }
  }

  async function handleConfirmBulkPurge() {
    if (bulkPending || !bulkConfirmed || selectedItems.length === 0) return;
    setBulkPending(true);
    try {
      const result = await onBulkPurge(
        selectedItems.map((item) => item.uuid),
        true,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.message ??
          `${result.data.purgedCount} mailbox(es) permanently deleted.`,
      );
      setSelectedUuids([]);
      setBulkConfirmed(false);
      setBulkDialogOpen(false);
      router.refresh();
    } catch {
      toast.error("Unable to purge selected mailboxes right now.");
    } finally {
      setBulkPending(false);
    }
  }

  async function handleProvisionSystemMailbox() {
    if (systemPending || !systemConfirmed) return;
    setSystemPending(true);
    try {
      const result = await onCreateSystemMailbox({
        localPart: systemLocalPart,
        domainUuid: systemDomainUuid || undefined,
        confirm: true,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.message ??
          `System mailbox ${result.data.emailAddress} created.`,
      );
      setSystemConfirmed(false);
      setSystemDialogOpen(false);
      router.refresh();
    } catch {
      toast.error("Unable to provision system mailbox right now.");
    } finally {
      setSystemPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Admin panel
          </p>
          <h1 className="mt-1 text-xl font-semibold">Mailbox administration</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!databaseConfigured || verifiedDomains.length === 0}
            onClick={() => {
              setSystemConfirmed(false);
              setSystemDialogOpen(true);
            }}
          >
            <Icon glyph={ShieldAlert} />
            <span>System mailbox</span>
          </Button>
          <Button asChild size="sm">
            <Link href="/vcon/mailboxes/new">
              <Icon glyph={MailPlus} />
              <span>Create mailbox</span>
            </Link>
          </Button>
        </div>
      </header>

      {!databaseConfigured ? (
        <section
          className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"
          role="status"
        >
          Database is not configured in this local environment. Mailboxes
          stored in PostgreSQL will appear here once DATABASE_URL is set.
        </section>
      ) : !databaseConnected ? (
        <section
          className="rounded-lg border border-destructive/40 bg-destructive-bg p-4 text-sm text-destructive-muted"
          role="alert"
        >
          Unable to load mailboxes from PostgreSQL right now.
        </section>
      ) : null}

      <form
        action="/vcon/mailboxes"
        method="get"
        className="flex flex-wrap items-center gap-2"
      >
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor="mailboxes-search-input" className="sr-only">
            Search mailboxes
          </label>
          <Input
            id="mailboxes-search-input"
            name="q"
            defaultValue={list.query}
            placeholder="Search email or local part"
          />
        </div>
        <div>
          <label htmlFor="mailboxes-status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="mailboxes-status-filter"
            name="status"
            defaultValue={list.statusFilter}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        <div>
          <label htmlFor="mailboxes-domain-filter" className="sr-only">
            Filter by domain
          </label>
          <select
            id="mailboxes-domain-filter"
            name="domain"
            defaultValue={list.domainUuidFilter}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All domains</option>
            {list.availableDomains.map((domain) => (
              <option key={domain.uuid} value={domain.uuid}>
                {domain.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" variant="outline">
          <Icon glyph={Search} />
          <span>Filter</span>
        </Button>
        {list.query ||
        list.statusFilter !== "all" ||
        list.domainUuidFilter ? (
          <Button asChild size="sm" variant="ghost">
            <Link href="/vcon/mailboxes">Clear</Link>
          </Button>
        ) : null}
      </form>

      {selectedItems.length > 0 ? (
        <section
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive-bg px-4 py-3 text-sm"
          aria-label="Bulk mailbox actions"
        >
          <span className="font-medium text-destructive-muted">
            {selectedItems.length} mailbox
            {selectedItems.length === 1 ? "" : "es"} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSelectedUuids([])}
            >
              Clear selection
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => {
                setBulkConfirmed(false);
                setBulkDialogOpen(true);
              }}
            >
              <Icon glyph={Trash2} />
              <span>Purge selected</span>
            </Button>
          </div>
        </section>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  id="mailboxes-select-all"
                  type="checkbox"
                  checked={allOnPageSelected}
                  aria-label="Select all mailboxes on page"
                  onChange={toggleAllOnPage}
                  className="size-4 rounded border-input accent-primary"
                />
              </TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Messages</TableHead>
              <TableHead>Assigned users</TableHead>
              <TableHead>Last delivery</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {list.query ||
                  list.statusFilter !== "all" ||
                  list.domainUuidFilter
                    ? "No mailboxes match the current filter."
                    : "No mailboxes provisioned yet."}
                </TableCell>
              </TableRow>
            ) : (
              list.items.map((mailbox) => {
                const isSelected = selectedUuids.includes(mailbox.uuid);
                const isToggling = togglingUuid === mailbox.uuid;
                const checkboxId = `mailbox-select-${mailbox.uuid}`;

                return (
                  <TableRow key={mailbox.uuid}>
                    <TableCell>
                      <input
                        id={checkboxId}
                        type="checkbox"
                        checked={isSelected}
                        aria-label={`Select ${mailbox.emailAddress}`}
                        onChange={() => toggleRowSelection(mailbox.uuid)}
                        className="size-4 rounded border-input accent-primary"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <CopyMailboxButton emailAddress={mailbox.emailAddress} />
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {mailbox.domainName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          mailbox.status === "active" ? "success" : "warning"
                        }
                      >
                        {mailbox.status === "active" ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {mailbox.totalMessages}
                      </span>{" "}
                      <span className="text-xs text-muted-foreground">
                        ({mailbox.unreadMessages} unread)
                      </span>
                    </TableCell>
                    <TableCell>
                      {mailbox.assignedUserCount === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Unassigned
                        </span>
                      ) : (
                        <span className="text-xs text-foreground">
                          {mailbox.assignedUsernames.slice(0, 2).join(", ")}
                          {mailbox.assignedUserCount > 2
                            ? ` +${mailbox.assignedUserCount - 2}`
                            : ""}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatShortDate(mailbox.lastReceivedAt, "Never")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isToggling}
                          aria-label={`${mailbox.status === "active" ? "Disable" : "Enable"} ${mailbox.emailAddress}`}
                          onClick={() => void handleToggle(mailbox)}
                        >
                          {mailbox.status === "active" ? "Disable" : "Enable"}
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                          <Link
                            href={`/vcon/mailboxes/${mailbox.uuid}/delete`}
                            aria-label={`Purge ${mailbox.emailAddress}`}
                          >
                            <Icon glyph={Trash2} />
                            <span>Purge</span>
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {list.totalPages > 1 ? (
        <nav
          aria-label="Mailboxes pagination"
          className="flex flex-wrap items-center justify-between gap-3 text-sm"
        >
          <span className="text-muted-foreground">
            Page {list.page} of {list.totalPages} ({list.totalCount} mailboxes)
          </span>
          <div className="flex items-center gap-2">
            {list.page > 1 ? (
              <Button asChild size="sm" variant="outline">
                <Link
                  href={buildMailboxesHref(
                    list.query,
                    list.statusFilter,
                    list.domainUuidFilter,
                    list.page - 1,
                  )}
                >
                  Previous
                </Link>
              </Button>
            ) : null}
            {list.page < list.totalPages ? (
              <Button asChild size="sm" variant="outline">
                <Link
                  href={buildMailboxesHref(
                    list.query,
                    list.statusFilter,
                    list.domainUuidFilter,
                    list.page + 1,
                  )}
                >
                  Next
                </Link>
              </Button>
            ) : null}
          </div>
        </nav>
      ) : null}

      <Dialog
        open={bulkDialogOpen}
        onOpenChange={(open) => {
          if (!open && !bulkPending) setBulkDialogOpen(false);
        }}
      >
        <DialogContent>
          <DialogTitle>Permanently delete selected mailboxes</DialogTitle>
          <DialogDescription>
            This permanently erases the selected mailboxes from PostgreSQL, the
            mailserver routing table, stored attachments, and on-disk Maildir
            directories.
          </DialogDescription>
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs">
            {selectedItems.map((item) => (
              <li key={item.uuid}>{item.emailAddress}</li>
            ))}
          </ul>
          <div className="flex items-start gap-2.5">
            <input
              id="bulk-purge-confirm-checkbox"
              type="checkbox"
              checked={bulkConfirmed}
              onChange={(event) => setBulkConfirmed(event.target.checked)}
              className="mt-0.5 size-4 rounded border-input accent-destructive"
            />
            <label
              htmlFor="bulk-purge-confirm-checkbox"
              className="text-xs font-medium text-foreground"
            >
              I confirm permanent deletion of these {selectedItems.length}{" "}
              mailbox{selectedItems.length === 1 ? "" : "es"}.
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={bulkPending}
              onClick={() => setBulkDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={bulkPending || !bulkConfirmed}
              onClick={() => void handleConfirmBulkPurge()}
            >
              {bulkPending ? "Purging..." : "Permanently purge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={systemDialogOpen}
        onOpenChange={(open) => {
          if (!open && !systemPending) setSystemDialogOpen(false);
        }}
      >
        <DialogContent>
          <DialogTitle>Provision reserved system mailbox</DialogTitle>
          <DialogDescription>
            Create an RFC-required system address (postmaster or abuse) on an
            active, DNS-verified domain.
          </DialogDescription>
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <label
                htmlFor="system-local-part"
                className="text-sm font-medium text-foreground"
              >
                Reserved address
              </label>
              <select
                id="system-local-part"
                value={systemLocalPart}
                onChange={(event) =>
                  setSystemLocalPart(
                    event.target.value === "abuse" ? "abuse" : "postmaster",
                  )
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="postmaster">postmaster</option>
                <option value="abuse">abuse</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <label
                htmlFor="system-domain-select"
                className="text-sm font-medium text-foreground"
              >
                Target domain
              </label>
              <select
                id="system-domain-select"
                value={systemDomainUuid}
                onChange={(event) => setSystemDomainUuid(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                {verifiedDomains.map((domain) => (
                  <option key={domain.uuid} value={domain.uuid}>
                    {domain.name}
                    {domain.isDefault ? " (Default)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-start gap-2.5">
              <input
                id="system-mailbox-confirm"
                type="checkbox"
                checked={systemConfirmed}
                onChange={(event) => setSystemConfirmed(event.target.checked)}
                className="mt-0.5 size-4 rounded border-input accent-primary"
              />
              <label
                htmlFor="system-mailbox-confirm"
                className="text-xs font-medium text-foreground"
              >
                Confirm administrator-approved creation of{" "}
                <span className="font-mono">{systemLocalPart}</span>.
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={systemPending}
              onClick={() => setSystemDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                systemPending || !systemConfirmed || verifiedDomains.length === 0
              }
              onClick={() => void handleProvisionSystemMailbox()}
            >
              {systemPending ? "Creating..." : "Create system mailbox"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
