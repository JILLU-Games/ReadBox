"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import type { BodyRepairBatchSummary } from "@/core/ingestion/repair";
import type { IngestionRunSummary } from "@/core/ingestion/service";
import type {
  MaildirProvisionSummary,
  MailserverSyncSummary,
  OperationsActionResult,
  OperationsOverviewData,
} from "@/core/operations/service";
import {
  Calculator,
  Database,
  FileCheck2,
  FolderCheck,
  HardDrive,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

function stateBadgeVariant(
  state: string,
): "success" | "warning" | "destructive" | "outline" {
  if (state === "ok" || state === "healthy") return "success";
  if (state === "warn" || state === "degraded") return "warning";
  if (state === "bad") return "destructive";
  return "outline";
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toISOString().slice(0, 19).replace("T", " ") + " UTC";
}

export function OperationsConsole({
  overview,
  onVerifyPostfix,
  onSyncMailserver,
  onProvisionMaildirs,
  onRebuildIndex,
  onRecalculateCounters,
  onRepairBodies,
}: {
  readonly overview: OperationsOverviewData;
  readonly onVerifyPostfix: () => Promise<
    OperationsActionResult<{
      readonly domains: number;
      readonly mailboxes: number;
      readonly postfixRows: number;
    }>
  >;
  readonly onSyncMailserver: (input: {
    readonly dryRun: boolean;
    readonly strict: boolean;
  }) => Promise<OperationsActionResult<MailserverSyncSummary>>;
  readonly onProvisionMaildirs: (input: {
    readonly mailboxUuid?: string;
  }) => Promise<OperationsActionResult<MaildirProvisionSummary>>;
  readonly onRebuildIndex: (input: {
    readonly dryRun: boolean;
    readonly mailboxUuid?: string;
  }) => Promise<OperationsActionResult<IngestionRunSummary>>;
  readonly onRecalculateCounters: (input: {
    readonly mailboxUuid?: string;
  }) => Promise<OperationsActionResult<{ readonly updatedCount: number }>>;
  readonly onRepairBodies: (input: {
    readonly dryRun: boolean;
    readonly confirmRepair: boolean;
    readonly limit: number;
    readonly mailboxUuid?: string;
  }) => Promise<OperationsActionResult<BodyRepairBatchSummary>>;
}) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [selectedMailboxUuid, setSelectedMailboxUuid] = useState<string>("");

  const [syncDryRun, setSyncDryRun] = useState(true);
  const [syncStrict, setSyncStrict] = useState(false);
  const [syncResult, setSyncResult] = useState<MailserverSyncSummary | null>(
    null,
  );

  const [provisionResult, setProvisionResult] =
    useState<MaildirProvisionSummary | null>(null);
  const [rebuildResult, setRebuildResult] =
    useState<IngestionRunSummary | null>(null);
  const [counterResult, setCounterResult] = useState<{
    readonly updatedCount: number;
  } | null>(null);

  const [repairLimit, setRepairLimit] = useState("500");
  const [repairConfirm, setRepairConfirm] = useState(false);
  const [repairResult, setRepairResult] =
    useState<BodyRepairBatchSummary | null>(null);

  const [postfixResult, setPostfixResult] = useState<{
    readonly domains: number;
    readonly mailboxes: number;
    readonly postfixRows: number;
  } | null>(null);

  const actionsDisabled =
    !overview.databaseConfigured || !overview.databaseConnected || busyAction !== null;

  async function runAction<T>(
    key: string,
    fn: () => Promise<OperationsActionResult<T>>,
    onSuccess: (data: T) => void,
    fallbackError: string,
  ) {
    if (busyAction) return;
    setBusyAction(key);
    try {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onSuccess(result.data);
      toast.success(result.message);
      router.refresh();
    } catch {
      toast.error(fallbackError);
    } finally {
      setBusyAction(null);
    }
  }

  function parsedRepairLimit(): number {
    const parsed = Number.parseInt(repairLimit, 10);
    if (!Number.isFinite(parsed)) return 500;
    return Math.max(1, Math.min(5000, parsed));
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Admin panel
          </p>
          <h1 className="mt-1 text-xl font-semibold">
            Operations &amp; ingestion diagnostics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verify PostgreSQL mail-server views, synchronize Maildir trees, run
            idempotent ingestion scans, and inspect index integrity without
            exposing message bodies.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={stateBadgeVariant(overview.health.ingestion.state)}>
            Worker: {overview.health.ingestion.detail}
          </Badge>
          <Badge
            variant={overview.postfixContract.verified ? "success" : "warning"}
          >
            {overview.postfixContract.verified
              ? "Postfix contract OK"
              : "Postfix contract attention"}
          </Badge>
        </div>
      </header>

      {!overview.databaseConfigured ? (
        <section
          className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"
          role="status"
        >
          Database is not configured in this local environment. Configure
          DATABASE_URL to inspect worker heartbeats and execute mail operations.
        </section>
      ) : !overview.databaseConnected ? (
        <section
          className="rounded-lg border border-destructive/40 bg-destructive-bg p-4 text-sm text-destructive-muted"
          role="alert"
        >
          Unable to connect to PostgreSQL right now. Operational actions are
          paused until database connectivity is restored.
        </section>
      ) : null}

      <section
        aria-label="Operations telemetry summary"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <article className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Ingestion heartbeat
          </p>
          <p className="mt-1.5 text-lg font-semibold">
            {overview.health.ingestion.detail}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Last seen: {formatTimestamp(overview.health.ingestion.meta)}
          </p>
        </article>

        <article className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Postfix virtual views
          </p>
          <p className="mt-1.5 text-lg font-semibold tabular-nums">
            {overview.postfixContract.postfixRows} routing row(s)
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {overview.postfixContract.domains} active domain(s) ·{" "}
            {overview.postfixContract.mailboxes} mailserver box(es)
          </p>
        </article>

        <article className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Schema sync drift
          </p>
          <p className="mt-1.5 text-lg font-semibold tabular-nums">
            {overview.syncDrift.missingInApp +
              overview.syncDrift.missingInMailserver +
              overview.syncDrift.statusMismatches}{" "}
            diff(s)
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            App {overview.syncDrift.appMailboxes} vs mailserver{" "}
            {overview.syncDrift.mailserverMailboxes}
          </p>
        </article>

        <article className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Indexed message corpus
          </p>
          <p className="mt-1.5 text-lg font-semibold tabular-nums">
            {overview.indexingStats.totalMessages} indexed
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {overview.indexingStats.warningMessages} warning ·{" "}
            {overview.indexingStats.oversizedMessages} oversized ·{" "}
            {overview.indexingStats.failedMessages} failed
          </p>
        </article>
      </section>

      <section
        aria-label="Storage readiness and mailbox scope"
        className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Icon glyph={HardDrive} className="text-muted-foreground" />
          <span className="text-sm font-medium">Storage roots:</span>
          <Badge variant={overview.health.mailStorage.ok ? "success" : "destructive"}>
            Maildir: {overview.health.mailStorage.detail}
          </Badge>
          <Badge
            variant={
              overview.health.attachmentStorage.ok ? "success" : "destructive"
            }
          >
            Attachments: {overview.health.attachmentStorage.detail}
          </Badge>
          <Badge
            variant={overview.health.lockStorage.ok ? "success" : "destructive"}
          >
            Locks: {overview.health.lockStorage.detail}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="operations-mailbox-scope"
            className="text-xs font-medium text-muted-foreground"
          >
            Mailbox scope
          </label>
          <select
            id="operations-mailbox-scope"
            value={selectedMailboxUuid}
            onChange={(event) => setSelectedMailboxUuid(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground"
          >
            <option value="">All active mailboxes</option>
            {overview.mailboxes.map((box) => (
              <option key={box.uuid} value={box.uuid}>
                {box.emailAddress} ({box.status})
              </option>
            ))}
          </select>
        </div>
      </section>

      <section
        aria-label="Operational maintenance tools"
        className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        {/* 1. Verify Postfix Contract */}
        <article className="flex flex-col justify-between rounded-lg border border-border bg-card p-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon glyph={ShieldCheck} className="text-primary" />
              <h2 className="text-sm font-semibold">
                1. Verify Postfix PostgreSQL contract
              </h2>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Confirms at least one active domain, readable{" "}
              <code className="font-mono">mailserver.mailboxes</code> rows, and
              valid <code className="font-mono">postfix_virtual_mailboxes</code>{" "}
              routing rows in the single PostgreSQL instance.
            </p>
            {overview.postfixContract.error ? (
              <p className="text-xs text-destructive-muted">
                Current check: {overview.postfixContract.error}
              </p>
            ) : null}
            {postfixResult ? (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                Verified: {postfixResult.domains} domain(s),{" "}
                {postfixResult.mailboxes} mailbox(es),{" "}
                {postfixResult.postfixRows} Postfix routing row(s).
              </div>
            ) : null}
          </div>
          <div className="mt-4">
            <Button
              type="button"
              size="sm"
              disabled={actionsDisabled}
              onClick={() =>
                void runAction(
                  "verify-postfix",
                  () => onVerifyPostfix(),
                  (data) => setPostfixResult(data),
                  "Unable to verify Postfix contract right now.",
                )
              }
            >
              {busyAction === "verify-postfix"
                ? "Verifying..."
                : "Verify Postfix contract"}
            </Button>
          </div>
        </article>

        {/* 2. Sync Mail-Server Mailboxes */}
        <article className="flex flex-col justify-between rounded-lg border border-border bg-card p-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon glyph={Database} className="text-primary" />
              <h2 className="text-sm font-semibold">
                2. Synchronize mail-server schema
              </h2>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Reconciles rows in <code className="font-mono">mailserver.mailboxes</code>{" "}
              into application domains and mailboxes within a PostgreSQL
              transaction.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <label className="flex items-center gap-2">
                <input
                  id="ops-sync-dry-run"
                  type="checkbox"
                  checked={syncDryRun}
                  onChange={(event) => setSyncDryRun(event.target.checked)}
                  className="size-4 rounded border-input accent-primary"
                />
                <span>Dry run (no writes)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  id="ops-sync-strict"
                  type="checkbox"
                  checked={syncStrict}
                  onChange={(event) => setSyncStrict(event.target.checked)}
                  className="size-4 rounded border-input accent-primary"
                />
                <span>Strict validation (abort on invalid rows)</span>
              </label>
            </div>
            {syncResult ? (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                <div>
                  {syncResult.dryRun ? "Dry run:" : "Applied:"} created{" "}
                  {syncResult.created}, updated {syncResult.updated}, unchanged{" "}
                  {syncResult.unchanged}, errors {syncResult.errors}.
                </div>
                {syncResult.errorSamples.length > 0 ? (
                  <ul className="mt-1.5 list-disc pl-4 text-destructive-muted">
                    {syncResult.errorSamples.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="mt-4">
            <Button
              type="button"
              size="sm"
              variant={syncDryRun ? "outline" : "default"}
              disabled={actionsDisabled}
              onClick={() =>
                void runAction(
                  "sync-mailserver",
                  () =>
                    onSyncMailserver({
                      dryRun: syncDryRun,
                      strict: syncStrict,
                    }),
                  (data) => setSyncResult(data),
                  "Unable to synchronize mail-server mailboxes right now.",
                )
              }
            >
              {busyAction === "sync-mailserver"
                ? "Running sync..."
                : syncDryRun
                  ? "Preview sync (dry run)"
                  : "Execute mail-server sync"}
            </Button>
          </div>
        </article>

        {/* 3. Provision / Verify Maildir Trees */}
        <article className="flex flex-col justify-between rounded-lg border border-border bg-card p-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon glyph={FolderCheck} className="text-primary" />
              <h2 className="text-sm font-semibold">
                3. Provision / verify Maildir directories
              </h2>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Ensures confined <code className="font-mono">Maildir/new</code>,{" "}
              <code className="font-mono">cur</code>, and{" "}
              <code className="font-mono">tmp</code> subdirectories exist with{" "}
              <code className="font-mono">0700</code> permissions.
            </p>
            {provisionResult ? (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                <div>
                  Scanned {provisionResult.scanned} mailbox(es):{" "}
                  {provisionResult.verifiedOrCreated} ready,{" "}
                  {provisionResult.errors} error(s).
                </div>
                {provisionResult.issueSamples.length > 0 ? (
                  <ul className="mt-1.5 list-disc pl-4 text-destructive-muted">
                    {provisionResult.issueSamples.map((sample, i) => (
                      <li key={i}>{sample}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="mt-4">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={actionsDisabled}
              onClick={() =>
                void runAction(
                  "provision-maildirs",
                  () =>
                    onProvisionMaildirs({
                      mailboxUuid: selectedMailboxUuid || undefined,
                    }),
                  (data) => setProvisionResult(data),
                  "Unable to provision Maildir directories right now.",
                )
              }
            >
              {busyAction === "provision-maildirs"
                ? "Checking Maildirs..."
                : "Provision missing Maildirs"}
            </Button>
          </div>
        </article>

        {/* 4. Rebuild Unindexed Maildir Index */}
        <article className="flex flex-col justify-between rounded-lg border border-border bg-card p-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon glyph={RefreshCw} className="text-primary" />
              <h2 className="text-sm font-semibold">
                4. Rebuild unindexed Maildir messages
              </h2>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Scans <code className="font-mono">Maildir/new</code> and{" "}
              <code className="font-mono">cur</code> without moving raw files,
              sanitizes HTML/CSS safely, stores confined{" "}
              <code className="font-mono">0600</code> attachments, and skips
              already indexed <code className="font-mono">source_file_key</code>{" "}
              entries idempotently.
            </p>
            {rebuildResult ? (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                <div>
                  {rebuildResult.dryRun ? "Dry run:" : "Indexed:"} scanned{" "}
                  {rebuildResult.scanned}, created {rebuildResult.created},
                  duplicates {rebuildResult.duplicates}, oversized{" "}
                  {rebuildResult.oversized}, errors {rebuildResult.errors}.
                </div>
                {rebuildResult.errorSamples.length > 0 ? (
                  <ul className="mt-1.5 list-disc pl-4 text-destructive-muted">
                    {rebuildResult.errorSamples.map((sample, i) => (
                      <li key={i}>{sample}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={actionsDisabled}
              onClick={() =>
                void runAction(
                  "rebuild-dry-run",
                  () =>
                    onRebuildIndex({
                      dryRun: true,
                      mailboxUuid: selectedMailboxUuid || undefined,
                    }),
                  (data) => setRebuildResult(data),
                  "Unable to run ingestion dry scan right now.",
                )
              }
            >
              {busyAction === "rebuild-dry-run"
                ? "Scanning..."
                : "Dry run scan"}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={actionsDisabled}
              onClick={() =>
                void runAction(
                  "rebuild-execute",
                  () =>
                    onRebuildIndex({
                      dryRun: false,
                      mailboxUuid: selectedMailboxUuid || undefined,
                    }),
                  (data) => setRebuildResult(data),
                  "Unable to ingest unindexed Maildir files right now.",
                )
              }
            >
              {busyAction === "rebuild-execute"
                ? "Ingesting..."
                : "Ingest unindexed files"}
            </Button>
          </div>
        </article>

        {/* 5. Recalculate Mailbox Counters */}
        <article className="flex flex-col justify-between rounded-lg border border-border bg-card p-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon glyph={Calculator} className="text-primary" />
              <h2 className="text-sm font-semibold">
                5. Recalculate mailbox counters
              </h2>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Recomputes <code className="font-mono">total_messages</code>,{" "}
              <code className="font-mono">unread_messages</code>, and{" "}
              <code className="font-mono">last_received_at</code> from
              non-deleted indexed messages.
            </p>
            {counterResult ? (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                Updated counters for {counterResult.updatedCount} mailbox(es).
              </div>
            ) : null}
          </div>
          <div className="mt-4">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={actionsDisabled}
              onClick={() =>
                void runAction(
                  "recalc-counters",
                  () =>
                    onRecalculateCounters({
                      mailboxUuid: selectedMailboxUuid || undefined,
                    }),
                  (data) => setCounterResult(data),
                  "Unable to recalculate mailbox counters right now.",
                )
              }
            >
              {busyAction === "recalc-counters"
                ? "Recalculating..."
                : "Recalculate counters"}
            </Button>
          </div>
        </article>

        {/* 6. Repair Message Bodies (SHA-256 verified) */}
        <article className="flex flex-col justify-between rounded-lg border border-border bg-card p-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon glyph={FileCheck2} className="text-primary" />
              <h2 className="text-sm font-semibold">
                6. Repair message bodies (SHA-256 verified)
              </h2>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Re-parses original Maildir files to refresh extracted text and
              sanitized HTML bodies. Aborts cleanly if disk SHA-256 mismatches{" "}
              <code className="font-mono">source_sha256</code>.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor="ops-repair-limit"
                className="text-xs font-medium text-foreground"
              >
                Batch limit (1-5000)
              </label>
              <Input
                id="ops-repair-limit"
                type="number"
                min={1}
                max={5000}
                value={repairLimit}
                onChange={(event) => setRepairLimit(event.target.value)}
                className="h-9 w-28"
              />
            </div>
            <label className="flex items-start gap-2 text-xs">
              <input
                id="ops-repair-confirm"
                type="checkbox"
                checked={repairConfirm}
                onChange={(event) => setRepairConfirm(event.target.checked)}
                className="mt-0.5 size-4 rounded border-input accent-primary"
              />
              <span>
                Confirm non-destructive body rewrite for SHA-256 verified
                messages.
              </span>
            </label>
            {repairResult ? (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                <div>
                  {repairResult.dryRun ? "Dry run:" : "Repair pass:"} scanned{" "}
                  {repairResult.scanned}, updated {repairResult.updated}, would
                  update {repairResult.wouldUpdate}, unchanged{" "}
                  {repairResult.unchanged}, SHA mismatches{" "}
                  {repairResult.mismatched}, missing {repairResult.missing},
                  errors {repairResult.errors}.
                </div>
                {repairResult.issueSamples.length > 0 ? (
                  <ul className="mt-1.5 list-disc pl-4 text-destructive-muted">
                    {repairResult.issueSamples.map((sample, i) => (
                      <li key={i}>{sample}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={actionsDisabled}
              onClick={() =>
                void runAction(
                  "repair-dry-run",
                  () =>
                    onRepairBodies({
                      dryRun: true,
                      confirmRepair: false,
                      limit: parsedRepairLimit(),
                      mailboxUuid: selectedMailboxUuid || undefined,
                    }),
                  (data) => setRepairResult(data),
                  "Unable to check message bodies right now.",
                )
              }
            >
              {busyAction === "repair-dry-run"
                ? "Checking..."
                : "Dry run check"}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={actionsDisabled || !repairConfirm}
              onClick={() =>
                void runAction(
                  "repair-execute",
                  () =>
                    onRepairBodies({
                      dryRun: false,
                      confirmRepair: repairConfirm,
                      limit: parsedRepairLimit(),
                      mailboxUuid: selectedMailboxUuid || undefined,
                    }),
                  (data) => setRepairResult(data),
                  "Unable to repair message bodies right now.",
                )
              }
            >
              {busyAction === "repair-execute"
                ? "Repairing..."
                : "Repair bodies"}
            </Button>
          </div>
        </article>
      </section>
    </div>
  );
}
