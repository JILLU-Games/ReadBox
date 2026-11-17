"use client";

import type { BackupActionResult, BackupDashboard, BackupJob, BackupRecord } from "@/core/backup/contracts";
import { UNAVAILABLE_BACKUP_DASHBOARD } from "@/core/backup/contracts";
import {
  AlertBanner, Badge, Button, PageHeader, Panel, PanelBody, PanelHeader,
  SectionTitle, StatCard, StatGrid,
} from "@/components/ui";
import {
  Archive, CalendarClock, Cloud, HardDrive, ListChecks, RotateCcw, ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";

interface BackupConsoleProps {
  readonly initialDashboard?: BackupDashboard;
  readonly onCreateBackup?: () => Promise<BackupActionResult>;
  readonly onVerifyBackup?: (backupId: string) => Promise<BackupActionResult>;
}

function byteLabel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  return bytes < 1024 * 1024
    ? (bytes / 1024).toFixed(0) + " KiB"
    : (bytes / (1024 * 1024)).toFixed(1) + " MiB";
}

const isActive = (job: BackupJob) => job.state === "queued" || job.state === "running";

export function BackupConsole({
  initialDashboard = UNAVAILABLE_BACKUP_DASHBOARD,
  onCreateBackup,
  onVerifyBackup,
}: BackupConsoleProps) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    initialDashboard.jobs[0]?.id ?? null,
  );
  const [activeJobId, setActiveJobId] = useState<string | null>(
    initialDashboard.jobs.find(isActive)?.id ?? null,
  );

  useEffect(() => {
    if (!activeJobId) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch("/api/vcon/backup/jobs/" + encodeURIComponent(activeJobId), {
          cache: "no-store",
        });
        if (!response.ok) return;
        const body = (await response.json()) as { job?: BackupJob };
        if (cancelled || !body.job || body.job.id !== activeJobId) return;
        const job = body.job;
        setDashboard((previous) => {
          const jobs = [job, ...previous.jobs.filter((item) => item.id !== job.id)].slice(0, 30);
          let backups = previous.backups;
          const result = job.result;
          if (job.kind === "backup" && job.state === "completed" &&
            result && "sha256" in result && !backups.some((record) => record.id === result.id)) {
            backups = [result as BackupRecord, ...backups].slice(0, 30);
          }
          return { ...previous, jobs, backups };
        });
        if (!isActive(job)) {
          setActiveJobId(null);
          setFeedback(job.state === "completed"
            ? "Job completed. The encrypted snapshot was verified."
            : "Job ended without success. Inspect the sanitized activity log.");
        }
      } catch {
        if (!cancelled) setFeedback("Unable to refresh job status. Retry by reopening this page.");
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeJobId]);

  const selectedJob = dashboard.jobs.find((item) => item.id === selectedJobId) ?? dashboard.jobs[0];
  const active = dashboard.jobs.some(isActive) || busy;
  const canCreate = dashboard.connected && Boolean(onCreateBackup) && !active;

  async function begin(action: () => Promise<BackupActionResult>) {
    if (active) return;
    setBusy(true);
    setFeedback("");
    try {
      const result = await action();
      if (!result.ok || !result.job) {
        setFeedback(result.message);
        return;
      }
      const job = result.job;
      setDashboard((previous) => ({
        ...previous,
        jobs: [job, ...previous.jobs.filter((item) => item.id !== job.id)].slice(0, 30),
      }));
      setSelectedJobId(job.id);
      setActiveJobId(job.id);
      setFeedback(result.message);
    } catch {
      setFeedback("Unable to contact backup service. No success has been recorded.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLogs() {
    if (!selectedJob) return;
    const sanitized = selectedJob.events
      .slice(-50)
      .map((item) => item.at + " [" + item.level + "] " + item.message)
      .join("\n")
      .slice(0, 16_384);
    try {
      await navigator.clipboard.writeText(sanitized);
      setFeedback("Sanitized job logs copied.");
    } catch {
      setFeedback("Unable to copy logs in this browser.");
    }
  }

  return (
    <div className="space-y-4" data-testid="backup-page-read-only">
      <PageHeader
        title="Backup & Restore"
        icon={HardDrive}
        badge={<Badge variant={dashboard.connected ? "success" : "warning"}>
          {dashboard.connected ? "Agent connected" : "Setup required"}
        </Badge>}
        actions={<Badge variant="outline">
          {dashboard.connected ? "Local backup available" : "Read-only preview"}
        </Badge>}
      >
        <p className="text-xs text-muted-foreground">
          Local encrypted backups and verification. R2, schedules and restore
          remain disabled until their separately approved phases.
        </p>
      </PageHeader>

      {!dashboard.connected ? (
        <AlertBanner variant="info" title="Backup controls are not connected">
          The host backup agent is not installed or is unavailable. Existing ReadBox
          services and previously stored backup files are unchanged.
        </AlertBanner>
      ) : (
        <AlertBanner variant="warning" title="Data-only recovery point">
          Snapshots do not contain host configuration, TLS keys or private credentials.
          The encryption identity must be kept separately for disaster recovery.
          Mail and Web may pause briefly while a consistent backup is captured.
        </AlertBanner>
      )}

      <StatGrid aria-label="Backup configuration summary" className="sm:grid-cols-2 lg:grid-cols-4">
        <StatCard compact label="Backup service" value={dashboard.connected ? "Connected" : "Not connected"}
          tone={dashboard.connected ? "success" : "warning"} />
        <StatCard compact label="Automatic backups" value="Not configured" />
        <StatCard compact label="Cloudflare R2" value="Not configured" />
        <StatCard compact label="Restore" value="Unavailable" />
      </StatGrid>

      {feedback ? <AlertBanner variant="info" role="status">{feedback}</AlertBanner> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader>
            <div className="flex items-center gap-2">
              <Archive aria-hidden="true" className="size-4 text-muted-foreground" />
              <SectionTitle>Local backups</SectionTitle>
            </div>
            <Badge variant="outline">BR-02</Badge>
          </PanelHeader>
          <PanelBody className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {dashboard.connected
                ? "Verified age-encrypted snapshots. Backup capture may temporarily pause inbound mail."
                : "Backup history is unavailable while the agent is disconnected. Existing VPS backups are not affected."}
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Local backup actions">
              <Button type="button" disabled={!canCreate} onClick={() => {
                if (onCreateBackup) void begin(onCreateBackup);
              }}>Create backup</Button>
              <Button type="button" variant="outline" disabled>Verify backup</Button>
              <Button type="button" variant="outline" disabled>View files</Button>
            </div>
            {dashboard.backups.length ? (
              <ul aria-label="Verified local backups" className="divide-y divide-border border-t border-border">
                {dashboard.backups.slice(0, 10).map((backup) => (
                  <li key={backup.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                    <div className="min-w-0">
                      <span className="font-mono">{backup.id.slice(0, 12)}…</span>
                      <span className="ml-2 text-muted-foreground">{byteLabel(backup.bytes)} · V2 verified</span>
                    </div>
                    <Button type="button" variant="outline" size="xs"
                      disabled={!dashboard.connected || !onVerifyBackup || active}
                      onClick={() => {
                        if (onVerifyBackup) void begin(() => onVerifyBackup(backup.id));
                      }}>Verify now</Button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-muted-foreground">No managed backup history to display.</p>}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <div className="flex items-center gap-2">
              <CalendarClock aria-hidden="true" className="size-4 text-muted-foreground" />
              <SectionTitle>Automatic schedule</SectionTitle>
            </div>
            <Badge variant="outline">Planned BR-03</Badge>
          </PanelHeader>
          <PanelBody className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Automatic backup and retention scheduling is not configured in BR-02.
            </p>
            <Button type="button" variant="outline" disabled>Configure schedule</Button>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <div className="flex items-center gap-2">
              <Cloud aria-hidden="true" className="size-4 text-muted-foreground" />
              <SectionTitle>Cloudflare R2 storage</SectionTitle>
            </div>
            <Badge variant="outline">Planned BR-03</Badge>
          </PanelHeader>
          <PanelBody className="space-y-3">
            <p className="text-xs text-muted-foreground">
              R2 credentials, connection checks and encrypted uploads are planned for BR-03.
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Cloudflare R2 actions">
              <Button type="button" variant="outline" disabled>Configure R2</Button>
              <Button type="button" variant="outline" disabled>Test connection</Button>
              <Button type="button" variant="outline" disabled>Upload to R2</Button>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <div className="flex items-center gap-2">
              <ListChecks aria-hidden="true" className="size-4 text-muted-foreground" />
              <SectionTitle>Activity & logs</SectionTitle>
            </div>
            <Badge variant="outline">BR-02</Badge>
          </PanelHeader>
          <PanelBody className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {dashboard.connected ? "Host-persisted, sanitized job status." :
                "Job history is unavailable until the backup agent connects."}
            </p>
            {dashboard.jobs.length ? (
              <div className="space-y-1" aria-label="Backup jobs">
                {dashboard.jobs.slice(0, 10).map((job) => (
                  <Button key={job.id} size="xs" type="button" variant="ghost"
                    className="h-auto w-full justify-between gap-2 text-left"
                    onClick={() => setSelectedJobId(job.id)}>
                    <span>{job.kind === "backup" ? "Create backup" : "Verify backup"}</span>
                    <Badge variant={job.state === "completed" ? "success" :
                      job.state === "failed" || job.state === "interrupted" ? "warning" : "outline"}>
                      {job.state}
                    </Badge>
                  </Button>
                ))}
              </div>
            ) : null}
            {selectedJob ? (
              <pre aria-label="Sanitized backup log" className="max-h-40 overflow-auto whitespace-pre-wrap break-all border border-border p-2 text-[11px]">
                {selectedJob.events.slice(-50).map((item) =>
                  item.at + " [" + item.level + "] " + item.message).join("\n")}
              </pre>
            ) : null}
            <Button type="button" variant="outline" disabled={!selectedJob?.events.length}
              onClick={() => void copyLogs()}>Copy logs</Button>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <div className="flex items-center gap-2">
            <RotateCcw aria-hidden="true" className="size-4 text-muted-foreground" />
            <SectionTitle>Restore & recovery</SectionTitle>
          </div>
          <Badge variant="outline">Planned BR-04</Badge>
        </PanelHeader>
        <PanelBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p>
              Restore requires a protected maintenance window, explicit authorization
              and verified rollback. Existing production data is untouched by BR-02.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled>Test restore</Button>
            <Button type="button" variant="outline" disabled>Restore backup</Button>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
