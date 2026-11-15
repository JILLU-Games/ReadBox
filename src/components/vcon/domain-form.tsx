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
import { FormField } from "@/components/ui/form-field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
  DnsRecordsPanel,
  type DisplayDnsRecord,
} from "@/components/vcon/dns-records-panel";
import type { ExpectedDnsRecord } from "@/core/dns/records";
import type {
  FullDnsVerificationResult,
  RoutingVerificationResult,
} from "@/core/dns/resolver";
import type {
  DomainActionResult,
  ManagedDomainItem,
} from "@/core/domains/service";
import { RefreshCw, ShieldCheck, Star, Trash2, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

export interface DomainFormProps {
  readonly mode: "create" | "edit";
  readonly databaseConfigured?: boolean;
  readonly configuredMailDomain?: string;
  readonly initialDomain?: ManagedDomainItem;
  readonly initialRecords?: readonly ExpectedDnsRecord[];
  readonly onCreate?: (input: {
    readonly name: string;
    readonly dnsConfirmed: boolean;
  }) => Promise<DomainActionResult<{ uuid: string; name: string }>>;
  readonly onUpdateStatus?: (
    uuid: string,
    input: { readonly status: "active" | "disabled"; readonly submittedName?: string },
  ) => Promise<DomainActionResult<{ uuid: string; status: string }>>;
  readonly onCheckDns?: (
    uuid: string,
  ) => Promise<DomainActionResult<RoutingVerificationResult>>;
  readonly onMakeDefault?: (
    uuid: string,
  ) => Promise<DomainActionResult<{ uuid: string; name: string }>>;
  readonly onDelete?: (
    uuid: string,
  ) => Promise<DomainActionResult<{ name: string }>>;
  readonly onPreviewDns?: (domain: string) => Promise<{
    readonly ok: boolean;
    readonly error?: string;
    readonly records?: readonly ExpectedDnsRecord[];
  }>;
  readonly onInspectDnsStatus?: (uuid: string) => Promise<{
    readonly ok: boolean;
    readonly error?: string;
    readonly result?: FullDnsVerificationResult;
  }>;
}

async function defaultPreviewDns(domain: string) {
  const response = await fetch(
    `/api/vcon/domains/dns-preview?domain=${encodeURIComponent(domain)}`,
    { cache: "no-store" },
  );
  const payload = (await response.json()) as {
    error?: string;
    records?: ExpectedDnsRecord[];
  };
  if (!response.ok) {
    return {
      ok: false,
      error: payload.error ?? "Enter a valid domain name before getting DNS records.",
    };
  }
  return { ok: true, records: payload.records ?? [] };
}

async function defaultInspectDnsStatus(uuid: string) {
  const response = await fetch(`/api/vcon/domains/${uuid}/dns-status`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as FullDnsVerificationResult & {
    error?: string;
  };
  if (!response.ok) {
    return {
      ok: false,
      error: payload.error ?? "Unable to inspect DNS records right now.",
    };
  }
  return { ok: true, result: payload };
}

export function DomainForm({
  mode,
  databaseConfigured = true,
  configuredMailDomain = "",
  initialDomain,
  initialRecords = [],
  onCreate,
  onUpdateStatus,
  onCheckDns,
  onMakeDefault,
  onDelete,
  onPreviewDns = defaultPreviewDns,
  onInspectDnsStatus = defaultInspectDnsStatus,
}: DomainFormProps) {
  const router = useRouter();
  const isCreate = mode === "create";

  const [name, setName] = useState(initialDomain?.name ?? "");
  const [status, setStatus] = useState<"active" | "disabled">(
    initialDomain?.status === "active" ? "active" : "disabled",
  );
  const [dnsConfirmed, setDnsConfirmed] = useState(false);
  const [records, setRecords] = useState<readonly DisplayDnsRecord[]>(
    initialRecords,
  );
  const [previewedDomain, setPreviewedDomain] = useState<string>(
    initialDomain?.name ?? "",
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [dnsModalOpen, setDnsModalOpen] = useState(false);
  const [dnsModalLoading, setDnsModalLoading] = useState(false);
  const [dnsInspection, setDnsInspection] =
    useState<FullDnsVerificationResult | null>(null);
  const [dnsInspectionError, setDnsInspectionError] = useState<string | null>(
    null,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  async function handlePreviewDns() {
    if (previewLoading) return;
    setFormError(null);
    setFieldErrors({});
    setPreviewLoading(true);
    try {
      const response = await onPreviewDns(name);
      if (!response.ok || !response.records) {
        const message =
          response.error ?? "Enter a valid domain name before previewing DNS.";
        setFieldErrors({ name: message });
        toast.error(message);
        return;
      }
      setRecords(response.records);
      setPreviewedDomain(name.trim().replace(/\.+$/, "").toLowerCase());
      toast.success("DNS records generated.");
    } catch {
      toast.error("Unable to generate DNS preview right now.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFormError(null);
    setFieldErrors({});

    if (isCreate) {
      if (!dnsConfirmed) {
        const msg =
          "Confirm that all DNS records have been reviewed before saving the domain.";
        setFieldErrors({ dnsConfirmed: msg });
        setFormError(msg);
        return;
      }
      if (!onCreate) return;
      setPending(true);
      try {
        const result = await onCreate({ name, dnsConfirmed });
        if (!result.ok) {
          setFormError(result.error);
          if (result.fieldErrors) setFieldErrors(result.fieldErrors);
          toast.error(result.error);
          return;
        }
        toast.success(result.message ?? `Domain ${result.data.name} added.`);
        router.push(`/vcon/domains/${result.data.uuid}/edit`);
        router.refresh();
      } catch {
        setFormError("Unable to create domain right now.");
      } finally {
        setPending(false);
      }
      return;
    }

    if (!initialDomain || !onUpdateStatus) return;
    setPending(true);
    try {
      const result = await onUpdateStatus(initialDomain.uuid, {
        status,
        submittedName: initialDomain.name,
      });
      if (!result.ok) {
        setFormError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        toast.error(result.error);
        return;
      }
      toast.success(
        result.message ?? `Domain ${initialDomain.name} updated.`,
      );
      router.push("/vcon/domains");
      router.refresh();
    } catch {
      setFormError("Unable to update domain right now.");
    } finally {
      setPending(false);
    }
  }

  async function handleRunRoutingCheck() {
    if (!initialDomain || !onCheckDns || pending) return;
    setPending(true);
    try {
      const result = await onCheckDns(initialDomain.uuid);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.data.verified) {
        toast.success(result.data.message);
      } else {
        setStatus("disabled");
        toast.error(result.data.message);
      }
      router.refresh();
    } catch {
      toast.error("Unable to run routing verification right now.");
    } finally {
      setPending(false);
    }
  }

  async function handleOpenLiveDnsModal() {
    if (!initialDomain) return;
    setDnsModalOpen(true);
    setDnsModalLoading(true);
    setDnsInspectionError(null);
    try {
      const response = await onInspectDnsStatus(initialDomain.uuid);
      if (!response.ok || !response.result) {
        setDnsInspection(null);
        setDnsInspectionError(
          response.error ?? "Unable to inspect DNS records right now.",
        );
        return;
      }
      setDnsInspection(response.result);
    } catch {
      setDnsInspection(null);
      setDnsInspectionError("Unable to inspect DNS records right now.");
    } finally {
      setDnsModalLoading(false);
    }
  }

  async function handleConfirmDelete() {
    if (!initialDomain || !onDelete || pending) return;
    setPending(true);
    try {
      const result = await onDelete(initialDomain.uuid);
      if (!result.ok) {
        toast.error(result.error);
        setDeleteDialogOpen(false);
        return;
      }
      toast.success(
        result.message ?? `Domain ${initialDomain.name} removed.`,
      );
      setDeleteDialogOpen(false);
      router.push("/vcon/domains");
      router.refresh();
    } catch {
      toast.error("Unable to delete domain right now.");
    } finally {
      setPending(false);
    }
  }

  const deleteBlockedReason =
    initialDomain &&
    (initialDomain.isDefault || initialDomain.name === configuredMailDomain)
      ? "The configured default domain cannot be deleted."
      : initialDomain && initialDomain.totalMailboxCount > 0
        ? "A domain with mailboxes cannot be removed; disable it instead."
        : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Domains
          </p>
          <h1 className="mt-1 text-xl font-semibold">
            {isCreate
              ? "Add mail domain"
              : `Manage ${initialDomain?.name ?? "domain"}`}
          </h1>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/vcon/domains">Back to domains</Link>
        </Button>
      </header>

      {!databaseConfigured ? (
        <section
          className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"
          role="status"
        >
          Database is not configured in this local environment. You can still
          preview and download Cloudflare DNS zone records below.
        </section>
      ) : null}

      {formError ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive-bg px-4 py-3 text-sm text-destructive-muted"
          role="alert"
        >
          {formError}
        </div>
      ) : null}

      {!isCreate && initialDomain ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                initialDomain.status === "active" ? "success" : "warning"
              }
            >
              {initialDomain.status === "active" ? "Active" : "Disabled"}
            </Badge>
            <Badge
              variant={
                initialDomain.verificationStatus === "verified"
                  ? "success"
                  : initialDomain.verificationStatus === "failed"
                    ? "destructive"
                    : "warning"
              }
            >
              DNS: {initialDomain.verificationStatus}
            </Badge>
            {initialDomain.isDefault ? (
              <Badge variant="default">Default domain</Badge>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {initialDomain.mailboxCount} active mailbox
              {initialDomain.mailboxCount === 1 ? "" : "es"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => void handleRunRoutingCheck()}
            >
              <Icon glyph={RefreshCw} />
              <span>Run routing check</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => void handleOpenLiveDnsModal()}
            >
              <Icon glyph={ShieldCheck} />
              <span>Inspect all DNS records</span>
            </Button>
            {!initialDomain.isDefault &&
            initialDomain.status === "active" &&
            initialDomain.verificationStatus === "verified" &&
            onMakeDefault ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={async () => {
                  const res = await onMakeDefault(initialDomain.uuid);
                  if (res.ok) {
                    toast.success(
                      res.message ?? `${initialDomain.name} is now default.`,
                    );
                    router.refresh();
                  } else {
                    toast.error(res.error);
                  }
                }}
              >
                <Icon glyph={Star} />
                <span>Make default</span>
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending || deleteBlockedReason !== null}
              title={deleteBlockedReason ?? `Delete ${initialDomain.name}`}
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Icon glyph={Trash2} />
              <span>Delete</span>
            </Button>
          </div>
        </section>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
            <FormField
              id="domain-name"
              label="Domain name"
              hint={
                isCreate
                  ? "Enter a domain name without protocol, then generate DNS records."
                  : "Domain names cannot be changed after creation; add a new domain instead."
              }
              error={fieldErrors.name}
            >
              <div className="flex gap-2">
                <Input
                  id="domain-name"
                  name="name"
                  value={name}
                  disabled={!isCreate}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="example.com"
                  onChange={(event) => setName(event.target.value)}
                  required={isCreate}
                />
                {isCreate ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={previewLoading || !name.trim()}
                    onClick={() => void handlePreviewDns()}
                  >
                    <Icon glyph={Zap} />
                    <span>{previewLoading ? "Generating..." : "Preview DNS"}</span>
                  </Button>
                ) : null}
              </div>
            </FormField>

            {!isCreate && initialDomain ? (
              <FormField
                id="domain-status"
                label="Mail delivery status"
                hint={
                  initialDomain.verificationStatus !== "verified"
                    ? "Domain must pass routing DNS verification (MX + A/AAAA) before it can be activated."
                    : "Controls whether Postfix accepts incoming mail for this domain."
                }
                error={fieldErrors.status}
              >
                <select
                  id="domain-status"
                  name="status"
                  value={status}
                  onChange={(event) =>
                    setStatus(
                      event.target.value === "active" ? "active" : "disabled",
                    )
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="disabled">Disabled</option>
                  <option
                    value="active"
                    disabled={initialDomain.verificationStatus !== "verified"}
                  >
                    Active
                  </option>
                </select>
              </FormField>
            ) : null}
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Required &amp; recommended DNS records</h2>
              <p className="text-xs text-muted-foreground">
                Publish these records at your DNS provider before running verification.
              </p>
            </div>
          </div>

          {records.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No DNS records generated yet. Enter a domain name above and click{" "}
              <strong className="text-foreground">Preview DNS</strong>.
            </div>
          ) : (
            <DnsRecordsPanel
              domainName={previewedDomain || name}
              records={records}
            />
          )}

          {isCreate ? (
            <div className="space-y-1.5 border-t border-border pt-4">
              <div className="flex items-start gap-2.5">
                <input
                  id="domain-dns-confirmed"
                  type="checkbox"
                  checked={dnsConfirmed}
                  onChange={(event) => setDnsConfirmed(event.target.checked)}
                  className="mt-0.5 size-4 rounded border-input accent-primary"
                />
                <label
                  htmlFor="domain-dns-confirmed"
                  className="text-sm font-medium text-foreground"
                >
                  I have reviewed the DNS records above and understand routing
                  verification is required before enabling mail delivery.
                </label>
              </div>
              {fieldErrors.dnsConfirmed ? (
                <p className="text-xs text-destructive" role="alert">
                  {fieldErrors.dnsConfirmed}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button asChild type="button" variant="outline">
            <Link href="/vcon/domains">Cancel</Link>
          </Button>
          <Button
            type="submit"
            disabled={pending || (isCreate && !databaseConfigured)}
          >
            {pending
              ? "Saving..."
              : isCreate
                ? "Add domain"
                : "Save status"}
          </Button>
        </div>
      </form>

      <Dialog open={dnsModalOpen} onOpenChange={setDnsModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>Live DNS inspection — {initialDomain?.name}</DialogTitle>
          <DialogDescription>
            Required routing records (MX + A/AAAA) must pass before mail delivery
            can be enabled. Deliverability records (SPF, DKIM, DMARC) are checked
            separately.
          </DialogDescription>

          {dnsModalLoading ? (
            <p className="py-6 text-sm text-muted-foreground">
              Querying authoritative DNS records...
            </p>
          ) : dnsInspectionError ? (
            <div
              className="rounded-md border border-destructive/40 bg-destructive-bg p-3 text-sm text-destructive-muted"
              role="alert"
            >
              {dnsInspectionError}
            </div>
          ) : dnsInspection ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    dnsInspection.routingVerified ? "success" : "destructive"
                  }
                >
                  Routing:{" "}
                  {dnsInspection.routingVerified ? "Verified" : "Incomplete"}
                </Badge>
                <Badge
                  variant={dnsInspection.allVerified ? "success" : "warning"}
                >
                  All 5 records:{" "}
                  {dnsInspection.allVerified ? "Matched" : "Partial / Missing"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {dnsInspection.message}
                </span>
              </div>
              <DnsRecordsPanel
                domainName={initialDomain?.name ?? ""}
                records={dnsInspection.records}
                showCloudflareExport={false}
              />
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDnsModalOpen(false)}
            >
              Close
            </Button>
            {dnsInspection?.routingVerified && onCheckDns ? (
              <Button
                type="button"
                disabled={pending}
                onClick={() => {
                  setDnsModalOpen(false);
                  void handleRunRoutingCheck();
                }}
              >
                Persist verified status
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogTitle>Delete domain</DialogTitle>
          <DialogDescription>
            {initialDomain
              ? `Permanently delete ${initialDomain.name}? This action is only permitted on non-default domains with zero mailboxes.`
              : ""}
          </DialogDescription>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => void handleConfirmDelete()}
            >
              {pending ? "Deleting..." : "Confirm delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
