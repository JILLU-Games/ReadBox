"use client";

import {
  AlertBanner,
  Badge,
  Button,
  Checkbox,
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
  Panel,
  PanelBody,
  PanelHeader,
  SectionTitle,
  Select,
} from "@/components/ui";
import {
  DnsRecordsPanel,
  type DisplayDnsRecord,
} from "@/components/vcon/dns-records-panel";
import type { ExpectedDnsRecord } from "@/core/dns/records";
import type { DkimStatus } from "@/core/dns/dkim-provision";
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
import { useEffect, useState, type FormEvent } from "react";

export interface DomainFormProps {
  readonly mode: "create" | "edit";
  readonly databaseConfigured?: boolean;
  readonly configuredMailDomain?: string;
  readonly initialDomain?: ManagedDomainItem;
  readonly initialRecords?: readonly ExpectedDnsRecord[];
  readonly onCreate?: (input: {
    readonly name: string;
    readonly dnsConfirmed: boolean;
    readonly autoDkim?: boolean;
    readonly zoneId?: string;
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
  const [autoDkim, setAutoDkim] = useState(true);
  const [dkimPublish, setDkimPublish] = useState(true);
  const rawBoundZone = initialDomain?.verificationDetails.cloudflareZone;
  const boundZone = rawBoundZone && typeof rawBoundZone === "object" &&
    !Array.isArray(rawBoundZone) && "id" in rawBoundZone &&
    typeof rawBoundZone.id === "string" && "name" in rawBoundZone &&
    typeof rawBoundZone.name === "string"
      ? { id: rawBoundZone.id, name: rawBoundZone.name } : null;
  const [zoneId, setZoneId] = useState(boundZone?.id ?? "");
  const [zoneChoices, setZoneChoices] = useState<readonly { id: string; name: string }[]>([]);
  const [zoneLoading, setZoneLoading] = useState(false);
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [dkimStatus, setDkimStatus] = useState<DkimStatus | null>(null);
  const [dkimError, setDkimError] = useState<string | null>(null);
  const [dkimBusy, setDkimBusy] = useState(false);
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

  useEffect(() => {
    if (!initialDomain?.uuid) return;
    let active = true;
    fetch("/api/vcon/domains/" + initialDomain.uuid + "/dkim", { cache: "no-store" })
      .then(async (res) => res.ok ? (await res.json()) as DkimStatus : null)
      .then((data) => { if (active) setDkimStatus(data); })
      .catch(() => { if (active) setDkimStatus(null); });
    return () => { active = false; };
  }, [initialDomain?.uuid]);

  useEffect(() => {
    if (!databaseConfigured) return;
    let current = true;
    setZoneLoading(true);
    fetch("/api/vcon/domains/cloudflare-zones", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json() as {
          zones?: Array<{ id: string; name: string }>; error?: string;
        };
        if (!res.ok || !Array.isArray(data.zones)) throw new Error(data.error ?? "Cloudflare zones unavailable");
        return data.zones;
      })
      .then((zones) => { if (current) { setZoneChoices(zones); setZoneError(null); } })
      .catch((error: unknown) => {
        if (current) setZoneError(error instanceof Error ? error.message : "Cloudflare zones unavailable");
      })
      .finally(() => { if (current) setZoneLoading(false); });
    return () => { current = false; };
  }, [databaseConfigured]);

  const normalizedName = name.trim().replace(/\.+$/, "").toLowerCase();
  const compatibleZones = zoneChoices.filter((zone) =>
    normalizedName === zone.name || normalizedName.endsWith("." + zone.name));
  // Keep a previously bound zone visible during a temporary Cloudflare read error.
  const visibleZones = boundZone && !compatibleZones.some((z) => z.id === boundZone.id)
    ? [boundZone, ...compatibleZones] : compatibleZones;

  async function handleProvisionDkim() {
    if (!initialDomain || dkimBusy) return;
    if (dkimPublish && !zoneId) {
      setDkimError("Select a Cloudflare zone before publishing DNS.");
      return;
    }
    setDkimBusy(true);
    setDkimError(null);
    try {
      const response = await fetch("/api/vcon/domains/" + initialDomain.uuid + "/dkim", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publish: dkimPublish,
          ...(dkimPublish ? { zoneId } : {}) }),
      });
      const result = await response.json() as {
        ok?: boolean; code?: string; provision?: string; dns?: string;
        routing?: "verified" | "pending" | "manual";
      };
      if (!response.ok || !result.ok) {
        setDkimError(result.code ?? "DOMAIN_AUTOMATION_UNAVAILABLE");
        notify.error("Automatic DKIM setup paused. Review the error and retry safely.");
        return;
      }
      notify.success(result.dns === "manual"
        ? "DKIM escrow verified and public key ready for manual DNS."
        : result.routing === "verified"
          ? "Domain DKIM + Cloudflare DNS verified; mail routing activated."
          : "DKIM and Cloudflare records saved; routing propagation pending.");
      const [statusResult, previewResult] = await Promise.all([
        fetch("/api/vcon/domains/" + initialDomain.uuid + "/dkim", { cache: "no-store" }),
        onPreviewDns(initialDomain.name),
      ]);
      if (statusResult.ok) setDkimStatus(await statusResult.json() as DkimStatus);
      if (previewResult.ok && previewResult.records) setRecords(previewResult.records);
      router.refresh();
    } catch {
      setDkimError("DKIM provisioning is temporarily unavailable.");
      notify.error("DKIM provisioning is temporarily unavailable.");
    } finally {
      setDkimBusy(false);
    }
  }

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
        notify.error(message);
        return;
      }
      setRecords(response.records);
      setPreviewedDomain(name.trim().replace(/\.+$/, "").toLowerCase());
      notify.success("DNS records generated.");
    } catch {
      notify.error("Unable to generate DNS preview right now.");
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
      if (!dnsConfirmed && !autoDkim) {
        const msg =
          "Confirm that all DNS records have been reviewed before saving the domain.";
        setFieldErrors({ dnsConfirmed: msg });
        setFormError(msg);
        return;
      }
      if (autoDkim && !zoneId) {
        const msg = "Select a Cloudflare zone before automatic setup.";
        setFieldErrors({ zoneId: msg });
        setFormError(msg);
        return;
      }
      if (!onCreate) return;
      setPending(true);
      try {
        const result = await onCreate(autoDkim
          ? { name, dnsConfirmed: true, autoDkim: true, zoneId }
          : { name, dnsConfirmed });
        if (!result.ok) {
          setFormError(result.error);
          if (result.fieldErrors) setFieldErrors(result.fieldErrors);
          notify.error(result.error);
          return;
        }
        notify.success(result.message ?? `Domain ${result.data.name} added.`);
        router.push(`/vcon/domains/${result.data.uuid}/edit`);
        router.refresh();
      } catch {
        const msg = "Unable to create domain right now.";
        setFormError(msg);
        notify.error(msg);
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
        notify.error(result.error);
        return;
      }
      notify.success(
        result.message ?? `Domain ${initialDomain.name} updated.`,
      );
      router.push("/vcon/domains");
      router.refresh();
    } catch {
      const msg = "Unable to update domain right now.";
      setFormError(msg);
      notify.error(msg);
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
        notify.error(result.error);
        return;
      }
      if (result.data.verified) {
        notify.success(result.data.message);
      } else {
        setStatus("disabled");
        notify.error(result.data.message);
      }
      router.refresh();
    } catch {
      notify.error("Unable to run routing verification right now.");
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
        notify.error(result.error);
        setDeleteDialogOpen(false);
        return;
      }
      notify.success(
        result.message ?? `Domain ${initialDomain.name} removed.`,
      );
      setDeleteDialogOpen(false);
      router.push("/vcon/domains");
      router.refresh();
    } catch {
      notify.error("Unable to delete domain right now.");
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
    <div className="space-y-4">
      <PageHeader
        title={
          isCreate
            ? "Add mail domain"
            : `Manage ${initialDomain?.name ?? "domain"}`
        }
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/vcon/domains">Back to domains</Link>
          </Button>
        }
      />

      {!databaseConfigured ? (
        <AlertBanner variant="warning" role="status">
          Database is not configured in this local environment. You can still
          preview and download Cloudflare DNS zone records below.
        </AlertBanner>
      ) : null}

      {formError ? <AlertBanner variant="error">{formError}</AlertBanner> : null}

      {!isCreate && initialDomain ? (
        <Panel>
          <PanelBody className="flex flex-wrap items-center justify-between gap-3 p-3">
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
                    try {
                      const res = await onMakeDefault(initialDomain.uuid);
                      if (res.ok) {
                        notify.success(
                          res.message ?? `${initialDomain.name} is now default.`,
                        );
                        router.refresh();
                      } else {
                        notify.error(res.error);
                      }
                    } catch {
                      notify.error("Unable to set default domain right now.");
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
          </PanelBody>
        </Panel>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Panel>
          <PanelBody className="p-4">
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
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={
                      fieldErrors.name ? "domain-name-error" : "domain-name-hint"
                    }
                    required={isCreate}
                  />
                  {isCreate ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={previewLoading || !name.trim()}
                      onClick={() => void handlePreviewDns()}
                    >
                      <Icon glyph={Zap} />
                      <span>
                        {previewLoading ? "Generating..." : "Preview DNS"}
                      </span>
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
                  <Select
                    id="domain-status"
                    name="status"
                    value={status}
                    aria-invalid={Boolean(fieldErrors.status)}
                    aria-describedby={
                      fieldErrors.status
                        ? "domain-status-error"
                        : "domain-status-hint"
                    }
                    onChange={(event) =>
                      setStatus(
                        event.target.value === "active" ? "active" : "disabled",
                      )
                    }
                    className="w-full"
                  >
                    <option value="disabled">Disabled</option>
                    <option
                      value="active"
                      disabled={initialDomain.verificationStatus !== "verified"}
                    >
                      Active
                    </option>
                  </Select>
                </FormField>
              ) : null}
            </div>
          </PanelBody>
        </Panel>

        {(isCreate ? autoDkim : dkimPublish) ? (
          <Panel data-testid="cloudflare-zone-panel">
            <PanelHeader>
              <SectionTitle>Cloudflare zone for this domain</SectionTitle>
            </PanelHeader>
            <PanelBody className="space-y-2 p-4">
              <FormField
                id="domain-cloudflare-zone"
                label="Select an active Cloudflare zone"
                hint="The selected zone is verified by the server and bound to this domain. Existing bindings cannot be silently changed."
                error={fieldErrors.zoneId}
              >
                <Select
                  id="domain-cloudflare-zone"
                  name="zoneId"
                  value={zoneId}
                  onChange={(event) => { setZoneId(event.target.value); setDkimError(null); }}
                  disabled={Boolean(boundZone) || zoneLoading || dkimBusy || pending}
                  className="w-full"
                >
                  <option value="">Select a Cloudflare zone</option>
                  {visibleZones.map((zone) =>
                    <option key={zone.id} value={zone.id}>{zone.name}</option>)}
                </Select>
              </FormField>
              {zoneLoading ? <p className="text-xs text-muted-foreground">Loading Cloudflare zones...</p> : null}
              {zoneError ? <AlertBanner variant="warning">{zoneError}. Manual DNS setup remains available.</AlertBanner> : null}
              {boundZone ? <p className="text-xs text-muted-foreground">Bound zone: {boundZone.name}</p> : null}
              {!zoneLoading && !zoneError && !visibleZones.length
                ? <p className="text-xs text-muted-foreground">No active zone matches this domain.</p> : null}
            </PanelBody>
          </Panel>
        ) : null}

        <Panel>
          <PanelHeader>
            <SectionTitle>Required &amp; recommended DNS records</SectionTitle>
          </PanelHeader>
          <PanelBody className="space-y-4 p-4">
            {records.length === 0 ? (
              <div className="border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
                No DNS records generated yet. Enter a domain name above and
                click{" "}
                <span className="font-medium text-foreground">Preview DNS</span>.
              </div>
            ) : (
              <DnsRecordsPanel
                domainName={previewedDomain || name}
                records={records}
              />
            )}

            {!isCreate && initialDomain ? (
              <div className="space-y-2 border-t border-border pt-3" data-testid="dkim-provisioning">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    DKIM key: {dkimStatus?.key ?? "Unknown"} · DNS: {dkimStatus?.dns ?? "Unknown"}
                    {" · "}Signing: inactive (inbound-only)
                  </div>
                  <Button type="button" size="sm" variant="outline"
                    disabled={dkimBusy || pending}
                    onClick={() => void handleProvisionDkim()}>
                    {dkimBusy ? "Provisioning..." : "Provision / Repair DKIM"}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="dkim-publish" checked={dkimPublish}
                    onChange={(event) => setDkimPublish(event.target.checked)} />
                  <Label htmlFor="dkim-publish" className="font-normal">
                    Publish DKIM TXT to configured Cloudflare zone (otherwise manual copy)
                  </Label>
                </div>
                {dkimError ? <AlertBanner variant="warning">{dkimError}</AlertBanner> : null}
              </div>
            ) : null}

            {isCreate ? (
              <div className="space-y-1.5 border-t border-border pt-3">
                {!autoDkim && <div className="flex items-start gap-2">
                  <Checkbox
                    id="domain-dns-confirmed"
                    checked={dnsConfirmed}
                    aria-invalid={Boolean(fieldErrors.dnsConfirmed)}
                    aria-describedby={
                      fieldErrors.dnsConfirmed
                        ? "domain-dns-confirmed-error"
                        : undefined
                    }
                    onChange={(event) => setDnsConfirmed(event.target.checked)}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="domain-dns-confirmed"
                    className="cursor-pointer font-normal"
                  >
                    I have reviewed the DNS records above and understand routing
                    verification is required before enabling mail delivery.
                  </Label>
                </div>}
                <div className="flex items-start gap-2">
                  <Checkbox id="domain-dkim-auto" checked={autoDkim}
                    onChange={(event) => setAutoDkim(event.target.checked)} />
                  <Label htmlFor="domain-dkim-auto" className="font-normal">
                    Automatic setup: DKIM key, encrypted R2 escrow, Cloudflare DNS and routing verification (requires scoped Cloudflare token)
                  </Label>
                </div>
                {fieldErrors.dnsConfirmed && !autoDkim ? (
                  <p
                    id="domain-dns-confirmed-error"
                    className="text-xs text-destructive"
                    role="alert"
                  >
                    {fieldErrors.dnsConfirmed}
                  </p>
                ) : null}
              </div>
            ) : null}
          </PanelBody>
        </Panel>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button asChild type="button" size="sm" variant="outline">
            <Link href="/vcon/domains">Cancel</Link>
          </Button>
          <Button
            type="submit"
            size="sm"
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
            Required routing records (MX + A/AAAA) must pass before mail
            delivery can be enabled. Deliverability records (SPF, DKIM, DMARC)
            are checked separately.
          </DialogDescription>

          {dnsModalLoading ? (
            <p className="py-5 text-xs text-muted-foreground">
              Querying authoritative DNS records...
            </p>
          ) : dnsInspectionError ? (
            <AlertBanner variant="error">{dnsInspectionError}</AlertBanner>
          ) : dnsInspection ? (
            <div className="space-y-3">
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
              size="sm"
              variant="outline"
              onClick={() => setDnsModalOpen(false)}
            >
              Close
            </Button>
            {dnsInspection?.routingVerified && onCheckDns ? (
              <Button
                type="button"
                size="sm"
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
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
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
