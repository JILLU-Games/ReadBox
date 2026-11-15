"use client";

import type {
  PreflightCheckItem,
  UpdatePreflightResult,
  UpdateStatusPayload,
} from "@/core/updates/service";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  RefreshCw,
  Terminal,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface SystemUpdateConsoleProps {
  readonly currentVersion: string;
  readonly githubRepo: string;
  readonly runtimeDir: string;
  readonly initialPreflight: UpdatePreflightResult;
  readonly initialStatus: UpdateStatusPayload;
}

interface LogEntry {
  readonly id: number;
  readonly time: string;
  readonly level: "info" | "success" | "error";
  readonly message: string;
}

export function SystemUpdateConsole({
  currentVersion,
  githubRepo,
  runtimeDir,
  initialPreflight,
  initialStatus,
}: SystemUpdateConsoleProps) {
  const [preflight, setPreflight] =
    useState<UpdatePreflightResult>(initialPreflight);
  const [status, setStatus] = useState<UpdateStatusPayload>(initialStatus);
  const [latestVersion, setLatestVersion] = useState<string>("Unknown");
  const [releaseNotes, setReleaseNotes] = useState<string>(
    "Click 'Check for Updates' to fetch release metadata.",
  );
  const [publishedAt, setPublishedAt] = useState<string>("");
  const [archiveUrl, setArchiveUrl] = useState<string>("");
  const [checksumUrl, setChecksumUrl] = useState<string>("");
  const [availabilityLabel, setAvailabilityLabel] =
    useState<string>("Check required");
  const [lastCheckedLabel, setLastCheckedLabel] = useState<string>(
    initialStatus.step && initialStatus.step !== "idle"
      ? initialStatus.step
      : "Idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialStatus.step === "error" || initialStatus.progress === -1
      ? `Previous update failed: ${initialStatus.message}`
      : null,
  );
  const [isCheckingRelease, setIsCheckingRelease] = useState(false);
  const [isCheckingPreflight, setIsCheckingPreflight] = useState(false);
  const [isStartingUpdate, setIsStartingUpdate] = useState(false);
  const [isPolling, setIsPolling] = useState(
    Boolean(
      initialStatus.step &&
        initialStatus.step !== "idle" &&
        initialStatus.step !== "error" &&
        initialStatus.progress >= 0 &&
        initialStatus.progress < 100,
    ),
  );
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showUpToDateModal, setShowUpToDateModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [doubleConfirmChecked, setDoubleConfirmChecked] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const lastLoggedMessageRef = useRef<string>("");
  const logCounterRef = useRef<number>(1);

  const appendLog = useCallback(
    (level: "info" | "success" | "error", message: string) => {
      const time = new Date().toLocaleTimeString("en-US", { hour12: false });
      const nextId = logCounterRef.current++;
      setLogs((prev) => [...prev, { id: nextId, time, level, message }]);
    },
    [],
  );

  const refreshPreflight = useCallback(async () => {
    setIsCheckingPreflight(true);
    try {
      const res = await fetch("/api/vcon/update/preflight", {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as UpdatePreflightResult;
      setPreflight(data);
      return data;
    } catch {
      const fallback: UpdatePreflightResult = {
        status: "blocked",
        checks: preflight.checks,
        message: "Manual action required: updater readiness could not be checked.",
      };
      setPreflight(fallback);
      return fallback;
    } finally {
      setIsCheckingPreflight(false);
    }
  }, [preflight.checks]);

  const performReleaseCheck = useCallback(
    async (showModalFeedback: boolean) => {
      setIsCheckingRelease(true);
      setErrorMessage(null);
      setLastCheckedLabel("Checking...");
      setAvailabilityLabel("Checking");

      try {
        const res = await fetch("/api/vcon/update/check", {
          cache: "no-store",
        });
        const data = (await res.json()) as {
          ok?: boolean;
          latest_version?: string;
          release_notes?: string;
          archive_url?: string;
          checksum_url?: string;
          published_at?: string;
          error?: string;
        };

        if (!res.ok || !data.latest_version) {
          throw new Error(data.error || "Failed to check for updates.");
        }

        setLatestVersion(data.latest_version);
        setReleaseNotes(data.release_notes || "No release notes provided.");
        setArchiveUrl(data.archive_url || "");
        setChecksumUrl(data.checksum_url || "");
        setPublishedAt(data.published_at || "");
        setLastCheckedLabel(
          new Date().toLocaleTimeString("en-US", { hour12: false }),
        );

        await refreshPreflight();

        if (
          data.latest_version !== currentVersion &&
          data.archive_url &&
          data.checksum_url
        ) {
          setAvailabilityLabel("Update available");
          if (showModalFeedback) {
            setDoubleConfirmChecked(false);
            setShowConfirmModal(true);
          }
        } else if (data.archive_url && data.checksum_url) {
          setAvailabilityLabel("Up to date");
          if (showModalFeedback) {
            setShowUpToDateModal(true);
          }
        } else {
          setAvailabilityLabel("Artifact missing");
          setErrorMessage(
            "Update artifacts not found for the latest release.",
          );
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to check for updates.";
        setErrorMessage(msg);
        setAvailabilityLabel("Unavailable");
        setLastCheckedLabel("Failed");
        if (showModalFeedback) {
          toast.error(msg);
        }
      } finally {
        setIsCheckingRelease(false);
      }
    },
    [currentVersion, refreshPreflight],
  );

  useEffect(() => {
    if (!isPolling) return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/vcon/update/status", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as UpdateStatusPayload;
        setStatus(data);

        if (data.message && lastLoggedMessageRef.current !== data.message) {
          lastLoggedMessageRef.current = data.message;
          appendLog(
            data.step === "error" || data.progress === -1 ? "error" : "info",
            data.message,
          );
        }

        if (data.progress === 100) {
          setIsPolling(false);
          appendLog(
            "success",
            "Update complete. Application services restarted cleanly.",
          );
          toast.success("System update completed.");
        } else if (data.step === "error" || data.progress === -1) {
          setIsPolling(false);
          setErrorMessage(data.message || "Update failed.");
          appendLog("error", `Update failed: ${data.message}`);
          toast.error(data.message || "System update failed.");
        }
      } catch {
        // Keep polling on transient network blip during service restart
      }
    }, 2_000);

    return () => clearInterval(timer);
  }, [appendLog, isPolling]);

  async function handleStartUpdate() {
    if (!doubleConfirmChecked) {
      toast.error("Please confirm the pre-upgrade backup and maintenance check.");
      return;
    }

    setShowConfirmModal(false);
    if (preflight.status !== "ready") {
      setErrorMessage(
        "Update preflight is blocked. Resolve the reported condition and try again.",
      );
      toast.error("Update preflight is blocked.");
      return;
    }

    setIsStartingUpdate(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/vcon/update/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archive_url: archiveUrl,
          checksum_url: checksumUrl,
        }),
      });
      const data = (await res.json()) as {
        status?: string;
        error?: string;
        preflight?: UpdatePreflightResult;
      };

      if (!res.ok) {
        if (data.preflight) {
          setPreflight(data.preflight);
        }
        const msg = data.error || "Failed to start system update.";
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }

      setShowLogModal(true);
      appendLog(
        "info",
        "Update request queued at /run/vibmail/update_request.json (mode 0640).",
      );
      setStatus({
        step: "queued",
        message: "Waiting for privileged root updater worker...",
        progress: 0,
      });
      setIsPolling(true);
      toast.success("Update request queued for root updater worker.");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to start system update.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsStartingUpdate(false);
    }
  }

  const updateAvailable =
    latestVersion !== "Unknown" &&
    latestVersion !== currentVersion &&
    Boolean(archiveUrl && checksumUrl);

  const canInstallUpdate =
    updateAvailable &&
    preflight.status === "ready" &&
    !isPolling &&
    !isStartingUpdate;

  const passedCount = preflight.checks.filter((c) => c.passed).length;

  return (
    <section className="space-y-6" aria-labelledby="system-update-title">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Release & Privilege-Separated Upgrade Console
          </p>
          <h1
            id="system-update-title"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            System Update
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Verify signed GitHub releases, inspect 9-point host preflight
            readiness, and queue atomic root-worker upgrades.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLogModal(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted whitespace-nowrap shrink-0"
          >
            <Terminal className="size-3.5" aria-hidden="true" />
            <span>Update Logs</span>
          </button>
          <button
            type="button"
            id="btn-check-update"
            disabled={isCheckingRelease}
            onClick={() => void performReleaseCheck(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`size-3.5 ${isCheckingRelease ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span>
              {isCheckingRelease ? "Checking..." : "Check for Updates"}
            </span>
          </button>
        </div>
      </div>

      {/* Top 2-Column Grid: Current Installation & Latest Release */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Current Installation Card */}
        <div className="min-w-0 rounded-md border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
            <h2 className="text-sm font-semibold text-foreground">
              Current Installation
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              {githubRepo}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded border border-border bg-background p-3">
              <span className="block text-[11px] text-muted-foreground">
                Current Version
              </span>
              <strong
                id="current-version"
                className="mt-1 block font-mono text-sm font-semibold tabular-nums text-foreground"
              >
                {currentVersion}
              </strong>
            </div>

            <div className="rounded border border-border bg-background p-3">
              <span className="block text-[11px] text-muted-foreground">
                Update Channel
              </span>
              <strong className="mt-1 block text-sm font-semibold text-foreground">
                Stable
              </strong>
            </div>

            <div className="rounded border border-border bg-background p-3">
              <span className="block text-[11px] text-muted-foreground">
                Update System
              </span>
              <strong className="mt-1 block text-sm font-semibold text-foreground">
                Signed / Resumable
              </strong>
            </div>

            <div className="rounded border border-border bg-background p-3">
              <span className="block text-[11px] text-muted-foreground">
                Status
              </span>
              <strong
                id="last-checked"
                className="mt-1 block font-mono text-sm font-semibold tabular-nums text-foreground"
              >
                {lastCheckedLabel}
              </strong>
            </div>
          </div>

          <div className="mt-4 rounded border border-border bg-background px-3 py-2.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
            <span>Handoff Queue:</span>{" "}
            <code className="font-mono text-foreground">
              {runtimeDir}/update_request.json
            </code>{" "}
            <span>·</span> <span>Mode 0640 hard-link</span>
          </div>
        </div>

        {/* Latest Release Card */}
        <div className="min-w-0 rounded-md border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
            <h2 className="text-sm font-semibold text-foreground">
              Latest Release
            </h2>
            <span
              id="update-availability-badge"
              className="text-xs font-medium text-muted-foreground"
            >
              {availabilityLabel}
            </span>
          </div>

          <div className="flex items-center justify-between rounded border border-border bg-background px-3 py-2.5 text-xs">
            <span className="text-muted-foreground">Version</span>
            <div className="flex items-center gap-2 font-mono tabular-nums">
              <strong id="latest-version" className="text-foreground">
                {latestVersion}
              </strong>
              {publishedAt ? (
                <>
                  <span aria-hidden="true" className="text-muted-foreground">
                    ·
                  </span>
                  <span className="text-muted-foreground">
                    {publishedAt.slice(0, 10)}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <pre
            id="release-notes"
            className="mt-3 max-h-36 overflow-y-auto whitespace-pre-wrap rounded border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground"
          >
            {releaseNotes}
          </pre>

          {errorMessage ? (
            <div
              id="update-error"
              role="alert"
              className="mt-3 flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isCheckingRelease}
              onClick={() => void performReleaseCheck(false)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`size-3.5 ${isCheckingRelease ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              <span>Refresh Release Metadata</span>
            </button>

            {updateAvailable ? (
              <button
                type="button"
                id="btn-start-update"
                disabled={!canInstallUpdate}
                onClick={() => {
                  setDoubleConfirmChecked(false);
                  setShowConfirmModal(true);
                }}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Download className="size-3.5" aria-hidden="true" />
                <span>Install Update</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Installation State & 9-Category Preflight Checklist */}
      <div className="min-w-0 rounded-md border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              Installation State & Host Preflight
            </h2>
            <p
              id="preflight-results"
              className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]"
            >
              {preflight.status === "ready"
                ? "Ready: the root updater worker and required runtime checks passed."
                : `Blocked: ${preflight.message || "Manual action is required before installation."}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              id="preflight-summary"
              className="font-mono text-xs font-medium tabular-nums text-foreground"
            >
              {isPolling
                ? "Installing"
                : preflight.status === "ready"
                  ? `Ready (${passedCount}/${preflight.checks.length})`
                  : `Blocked (${passedCount}/${preflight.checks.length} passed)`}
            </span>
            <button
              type="button"
              disabled={isCheckingPreflight}
              onClick={() => void refreshPreflight()}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`size-3.5 ${isCheckingPreflight ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              <span>Recheck Preflight</span>
            </button>
          </div>
        </div>

        {/* Active Job Progress Bar */}
        {isPolling || (status.step && status.step !== "idle") ? (
          <div
            id="active-job-panel"
            className="mt-4 rounded border border-border bg-background p-4"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Active Job</span>
              <strong
                id="active-job-id"
                className="font-mono text-foreground"
              >
                System Upgrade ({status.step})
              </strong>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted">
              <div
                id="progress-bar"
                className="h-full bg-primary transition-all"
                style={{
                  width: `${Math.max(0, Math.min(100, status.progress))}%`,
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between font-mono text-xs tabular-nums text-muted-foreground">
              <span id="active-job-stage">{status.message}</span>
              <span id="active-job-percent">
                {Math.max(0, status.progress)}%
              </span>
            </div>
          </div>
        ) : null}

        {/* Preflight Check Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-4 font-medium">State</th>
                <th className="py-2 pr-4 font-medium">Check</th>
                <th className="py-2 font-medium">Target / Detail</th>
              </tr>
            </thead>
            <tbody id="preflight-checks" className="divide-y divide-border">
              {preflight.checks.map((item: PreflightCheckItem) => (
                <tr key={item.name} className="hover:bg-muted/40">
                  <td className="py-2 pr-4 font-medium whitespace-nowrap">
                    {item.passed ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        <span>Pass</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                        <XCircle className="size-3.5" aria-hidden="true" />
                        <span>Blocked</span>
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 font-medium text-foreground">
                    {item.name}
                  </td>
                  <td className="py-2 font-mono text-muted-foreground">
                    {item.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update Available / Double Confirmation Modal */}
      {showConfirmModal ? (
        <div
          id="modal-update-available"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-update-available-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-md rounded-md border border-border bg-card p-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3
                id="modal-update-available-title"
                className="text-sm font-semibold text-foreground"
              >
                Confirm System Update
              </h3>
              <button
                type="button"
                aria-label="Close confirmation dialog"
                onClick={() => setShowConfirmModal(false)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-muted-foreground">
              <p>
                Version{" "}
                <strong
                  id="modal-latest-version"
                  className="font-mono text-foreground"
                >
                  {latestVersion}
                </strong>{" "}
                is available. The privileged root updater worker will verify the
                SHA-256 checksum, create a full pre-upgrade backup, and restart
                web/ingestion workers while keeping Postfix and Dovecot active.
              </p>

              <label className="flex items-start gap-2 rounded border border-border bg-background p-3 text-foreground">
                <input
                  type="checkbox"
                  checked={doubleConfirmChecked}
                  onChange={(e) => setDoubleConfirmChecked(e.target.checked)}
                  className="mt-0.5 rounded border-border"
                />
                <span>
                  I confirm that preflight checks are reviewed and authorize
                  queuing the signed upgrade request.
                </span>
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                id="btn-update-cancel"
                onClick={() => setShowConfirmModal(false)}
                className="inline-flex min-h-9 items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-update-confirm"
                disabled={!doubleConfirmChecked || !canInstallUpdate}
                onClick={() => void handleStartUpdate()}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Check className="size-3.5" aria-hidden="true" />
                <span>Install Update</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Up to Date Modal */}
      {showUpToDateModal ? (
        <div
          id="modal-up-to-date"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-up-to-date-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-sm rounded-md border border-border bg-card p-5 text-center shadow-lg">
            <div className="mx-auto flex size-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Check className="size-4" aria-hidden="true" />
            </div>
            <h3
              id="modal-up-to-date-title"
              className="mt-3 text-sm font-semibold text-foreground"
            >
              System is Up to Date
            </h3>
            <p className="mt-1.5 text-xs text-muted-foreground">
              You are already running the latest version (
              <span id="modal-current-version" className="font-mono">
                {currentVersion}
              </span>
              ).
            </p>
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                id="btn-up-to-date-ok"
                onClick={() => setShowUpToDateModal(false)}
                className="inline-flex min-h-9 items-center rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 whitespace-nowrap shrink-0"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Terminal Log Stream Modal */}
      {showLogModal ? (
        <div
          id="licora-update-log-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="licora-update-log-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-2xl rounded-md border border-border bg-card p-5 shadow-lg">
            <header className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2
                  id="licora-update-log-title"
                  className="text-sm font-semibold text-foreground"
                >
                  System Update Stream
                </h2>
                <p
                  id="update-log-description"
                  className="text-xs text-muted-foreground"
                >
                  Verified root updater worker event stream
                </p>
              </div>
              <button
                type="button"
                id="log-close"
                aria-label="Close update logs"
                onClick={() => setShowLogModal(false)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </header>

            <div
              id="update-log-viewport"
              role="log"
              aria-label="Update terminal log stream"
              className="mt-3 max-h-64 min-h-40 overflow-y-auto rounded border border-border bg-background p-3 font-mono text-xs"
            >
              {logs.length === 0 ? (
                <div
                  id="update-log-empty"
                  className="text-muted-foreground"
                >
                  Waiting for updater events... (Current step: {status.step} —{" "}
                  {status.message})
                </div>
              ) : (
                <div className="space-y-1.5">
                  {logs.map((entry) => (
                    <div
                      key={entry.id}
                      data-level={entry.level}
                      className="flex items-start gap-2"
                    >
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {entry.time}
                      </span>
                      <span className="shrink-0 uppercase text-foreground">
                        [{entry.level}]
                      </span>
                      <span className="text-foreground">{entry.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <footer className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span id="update-log-stage" className="font-mono">
                Stage: {status.step}
              </span>
              <span>Closing this window does not cancel the update</span>
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}
