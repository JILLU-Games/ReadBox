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
import type { RoutingVerificationResult } from "@/core/dns/resolver";
import type {
  DomainActionResult,
  ManagedDomainItem,
} from "@/core/domains/service";
import { Plus, RefreshCw, Search, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function formatTimestamp(iso: string | null, fallback: string): string {
  if (!iso) return fallback;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function verificationBadgeVariant(
  status: string,
): "success" | "warning" | "destructive" | "outline" {
  if (status === "verified") return "success";
  if (status === "failed") return "destructive";
  if (status === "pending") return "warning";
  return "outline";
}

export function DomainsDirectory({
  domains,
  query,
  configuredMailDomain,
  databaseConfigured,
  databaseConnected,
  onCheckDns,
  onToggleStatus,
  onMakeDefault,
  onDeleteDomain,
}: {
  readonly domains: readonly ManagedDomainItem[];
  readonly query: string;
  readonly configuredMailDomain: string;
  readonly databaseConfigured: boolean;
  readonly databaseConnected: boolean;
  readonly onCheckDns: (
    uuid: string,
  ) => Promise<DomainActionResult<RoutingVerificationResult>>;
  readonly onToggleStatus: (
    uuid: string,
  ) => Promise<DomainActionResult<{ uuid: string; status: string }>>;
  readonly onMakeDefault: (
    uuid: string,
  ) => Promise<DomainActionResult<{ uuid: string; name: string }>>;
  readonly onDeleteDomain: (
    uuid: string,
  ) => Promise<DomainActionResult<{ name: string }>>;
}) {
  const router = useRouter();
  const [busyUuid, setBusyUuid] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedDomainItem | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  async function handleCheckDns(domain: ManagedDomainItem) {
    if (busyUuid) return;
    setBusyUuid(domain.uuid);
    try {
      const result = await onCheckDns(domain.uuid);
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      if (result.data.verified) {
        notify.success(result.data.message);
      } else {
        notify.error(result.data.message);
      }
      router.refresh();
    } catch {
      notify.error("Unable to verify domain DNS right now.");
    } finally {
      setBusyUuid(null);
    }
  }

  async function handleToggle(domain: ManagedDomainItem) {
    if (busyUuid) return;
    setBusyUuid(domain.uuid);
    try {
      const result = await onToggleStatus(domain.uuid);
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      notify.success(result.message ?? `Domain ${domain.name} updated.`);
      router.refresh();
    } catch {
      notify.error("Unable to update domain status right now.");
    } finally {
      setBusyUuid(null);
    }
  }

  async function handleMakeDefault(domain: ManagedDomainItem) {
    if (busyUuid) return;
    setBusyUuid(domain.uuid);
    try {
      const result = await onMakeDefault(domain.uuid);
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      notify.success(
        result.message ?? `${domain.name} is now the default domain.`,
      );
      router.refresh();
    } catch {
      notify.error("Unable to set default domain right now.");
    } finally {
      setBusyUuid(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const result = await onDeleteDomain(deleteTarget.uuid);
      if (!result.ok) {
        notify.error(result.error);
        setDeleteTarget(null);
        return;
      }
      notify.success(result.message ?? `Domain ${result.data.name} removed.`);
      setDeleteTarget(null);
      router.refresh();
    } catch {
      notify.error("Unable to delete domain right now.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <PageTitle>Domains &amp; DNS</PageTitle>
        <Button asChild size="sm">
          <Link href="/vcon/domains/new">
            <Icon glyph={Plus} />
            <span>Add domain</span>
          </Link>
        </Button>
      </header>

      {!databaseConfigured ? (
        <AlertBanner variant="warning" role="status">
          Database is not configured in this local environment. Mail domains
          stored in PostgreSQL will appear here once DATABASE_URL is set.
        </AlertBanner>
      ) : !databaseConnected ? (
        <AlertBanner variant="error">
          Unable to load domains from PostgreSQL right now.
        </AlertBanner>
      ) : null}

      <form
        action="/vcon/domains"
        method="get"
        className="flex flex-wrap items-center gap-2"
      >
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Label htmlFor="domains-search-input" className="sr-only">
            Search domains
          </Label>
          <Input
            id="domains-search-input"
            name="q"
            defaultValue={query}
            placeholder="Search domain, status, or DNS state"
          />
        </div>
        <Button type="submit" size="sm" variant="outline">
          <Icon glyph={Search} />
          <span>Search</span>
        </Button>
        {query ? (
          <Button asChild size="sm" variant="ghost">
            <Link href="/vcon/domains">Clear</Link>
          </Button>
        ) : null}
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Domain</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>DNS routing</TableHead>
            <TableHead>Mailboxes</TableHead>
            <TableHead>Last checked</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {domains.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="py-8 text-center text-xs text-muted-foreground"
              >
                {query
                  ? `No domains matching "${query}".`
                  : "No domains configured yet. Add a domain to generate DNS records."}
              </TableCell>
            </TableRow>
          ) : (
            domains.map((domain) => {
              const isBusy = busyUuid === domain.uuid;
              const deleteBlockedReason =
                domain.isDefault || domain.name === configuredMailDomain
                  ? "Default configured domain cannot be deleted"
                  : domain.totalMailboxCount > 0
                    ? "Domain still has mailboxes"
                    : null;

              return (
                <TableRow key={domain.uuid}>
                  <TableCell className="font-medium">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/vcon/domains/${domain.uuid}/edit`}
                        className="text-foreground hover:underline"
                      >
                        {domain.name}
                      </Link>
                      {domain.isDefault ? (
                        <Badge variant="default">Default</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        domain.status === "active" ? "success" : "warning"
                      }
                    >
                      {domain.status === "active" ? "Active" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={verificationBadgeVariant(
                        domain.verificationStatus,
                      )}
                    >
                      {domain.verificationStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {domain.mailboxCount}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatTimestamp(domain.lastCheckedAt, "Never")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/vcon/domains/${domain.uuid}/edit`}>
                          Manage &amp; DNS
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => void handleCheckDns(domain)}
                      >
                        <Icon glyph={RefreshCw} />
                        <span>Check DNS</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          isBusy ||
                          (domain.status !== "active" &&
                            domain.verificationStatus !== "verified")
                        }
                        onClick={() => void handleToggle(domain)}
                      >
                        {domain.status === "active" ? "Disable" : "Enable"}
                      </Button>
                      {!domain.isDefault &&
                      domain.status === "active" &&
                      domain.verificationStatus === "verified" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => void handleMakeDefault(domain)}
                        >
                          <Icon glyph={Star} />
                          <span>Make default</span>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={`Delete ${domain.name}`}
                        disabled={isBusy || deleteBlockedReason !== null}
                        title={deleteBlockedReason ?? `Delete ${domain.name}`}
                        onClick={() => setDeleteTarget(domain)}
                      >
                        <Icon glyph={Trash2} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Delete domain</DialogTitle>
          <DialogDescription>
            {deleteTarget
              ? `Remove ${deleteTarget.name} from the application and PostgreSQL mailserver domain table? Only empty, non-default domains can be deleted.`
              : ""}
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
