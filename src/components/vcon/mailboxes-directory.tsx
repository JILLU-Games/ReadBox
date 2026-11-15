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
  Icon,
  Input,
  Label,
  notify,
  PageTitle,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
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
        notify.error(result.error);
        return;
      }
      notify.success(
        result.message ??
          (targetActive ? "Mailbox enabled." : "Mailbox disabled."),
      );
      router.refresh();
    } catch {
      notify.error("Unable to update mailbox status right now.");
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
        notify.error(result.error);
        return;
      }
      notify.success(
        result.message ??
          `${result.data.purgedCount} mailbox(es) permanently deleted.`,
      );
      setSelectedUuids([]);
      setBulkConfirmed(false);
      setBulkDialogOpen(false);
      router.refresh();
    } catch {
      notify.error("Unable to purge selected mailboxes right now.");
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
        notify.error(result.error);
        return;
      }
      notify.success(
        result.message ??
          `System mailbox ${result.data.emailAddress} created.`,
      );
      setSystemConfirmed(false);
      setSystemDialogOpen(false);
      router.refresh();
    } catch {
      notify.error("Unable to provision system mailbox right now.");
    } finally {
      setSystemPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <PageTitle>Mailbox administration</PageTitle>
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
        <AlertBanner variant="warning" role="status">
          Database is not configured in this local environment. Mailboxes stored
          in PostgreSQL will appear here once DATABASE_URL is set.
        </AlertBanner>
      ) : !databaseConnected ? (
        <AlertBanner variant="error">
          Unable to load mailboxes from PostgreSQL right now.
        </AlertBanner>
      ) : null}

      <form
        action="/vcon/mailboxes"
        method="get"
        className="flex flex-wrap items-center gap-2"
      >
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Label htmlFor="mailboxes-search-input" className="sr-only">
            Search mailboxes
          </Label>
          <Input
            id="mailboxes-search-input"
            name="q"
            defaultValue={list.query}
            placeholder="Search email or local part"
          />
        </div>
        <div>
          <Label htmlFor="mailboxes-status-filter" className="sr-only">
            Filter by status
          </Label>
          <Select
            id="mailboxes-status-filter"
            name="status"
            defaultValue={list.statusFilter}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="mailboxes-domain-filter" className="sr-only">
            Filter by domain
          </Label>
          <Select
            id="mailboxes-domain-filter"
            name="domain"
            defaultValue={list.domainUuidFilter}
          >
            <option value="">All domains</option>
            {list.availableDomains.map((domain) => (
              <option key={domain.uuid} value={domain.uuid}>
                {domain.name}
              </option>
            ))}
          </Select>
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
        <AlertBanner
          variant="error"
          aria-label="Bulk mailbox actions"
          action={
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
          }
        >
          <span className="font-medium">
            {selectedItems.length} mailbox
            {selectedItems.length === 1 ? "" : "es"} selected
          </span>
        </AlertBanner>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                id="mailboxes-select-all"
                checked={allOnPageSelected}
                aria-label="Select all mailboxes on page"
                onChange={toggleAllOnPage}
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
                className="py-8 text-center text-xs text-muted-foreground"
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
                    <Checkbox
                      id={checkboxId}
                      checked={isSelected}
                      aria-label={`Select ${mailbox.emailAddress}`}
                      onChange={() => toggleRowSelection(mailbox.uuid)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <CopyButton
                        value={mailbox.emailAddress}
                        label={`Copy ${mailbox.emailAddress}`}
                        successMessage={`Copied ${mailbox.emailAddress}`}
                        errorMessage="Clipboard unavailable — select and copy manually."
                        className="font-mono"
                      >
                        <span className="truncate">{mailbox.emailAddress}</span>
                      </CopyButton>
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
                  <TableCell className="tabular-nums">
                    <span className="font-medium">{mailbox.totalMessages}</span>{" "}
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

      {list.totalPages > 1 ? (
        <nav
          aria-label="Mailboxes pagination"
          className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
        >
          <span>
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
          <ul className="max-h-40 space-y-1 overflow-y-auto border border-border bg-muted/40 p-2.5 font-mono text-xs">
            {selectedItems.map((item) => (
              <li key={item.uuid}>{item.emailAddress}</li>
            ))}
          </ul>
          <div className="flex items-start gap-2">
            <Checkbox
              id="bulk-purge-confirm-checkbox"
              checked={bulkConfirmed}
              onChange={(event) => setBulkConfirmed(event.target.checked)}
              className="mt-0.5 accent-destructive"
            />
            <Label
              htmlFor="bulk-purge-confirm-checkbox"
              className="cursor-pointer font-normal"
            >
              I confirm permanent deletion of these {selectedItems.length}{" "}
              mailbox{selectedItems.length === 1 ? "" : "es"}.
            </Label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={bulkPending}
              onClick={() => setBulkDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
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
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="system-local-part">Reserved address</Label>
              <Select
                id="system-local-part"
                value={systemLocalPart}
                onChange={(event) =>
                  setSystemLocalPart(
                    event.target.value === "abuse" ? "abuse" : "postmaster",
                  )
                }
                className="w-full"
              >
                <option value="postmaster">postmaster</option>
                <option value="abuse">abuse</option>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="system-domain-select">Target domain</Label>
              <Select
                id="system-domain-select"
                value={systemDomainUuid}
                onChange={(event) => setSystemDomainUuid(event.target.value)}
                className="w-full"
              >
                {verifiedDomains.map((domain) => (
                  <option key={domain.uuid} value={domain.uuid}>
                    {domain.name}
                    {domain.isDefault ? " (Default)" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="system-mailbox-confirm"
                checked={systemConfirmed}
                onChange={(event) => setSystemConfirmed(event.target.checked)}
                className="mt-0.5"
              />
              <Label
                htmlFor="system-mailbox-confirm"
                className="cursor-pointer font-normal"
              >
                Confirm administrator-approved creation of{" "}
                <span className="font-mono">{systemLocalPart}</span>.
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={systemPending}
              onClick={() => setSystemDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
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
