"use client";

import type { BackupActionResult, BackupDashboard, BackupJob, BackupRecord, R2Credentials, RemoteBackupRecord, SchedulePublic } from "@/core/backup/contracts";
import { configureR2Action, testR2Action, listR2Action, uploadR2Action, configureScheduleAction } from "@/app/(workspace)/vcon/backup/actions";
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
  const [remoteRecords, setRemoteRecords] = useState<readonly RemoteBackupRecord[]>([]);
  const [credentials, setCredentials] = useState<R2Credentials>({
    accountId: "", bucket: "", accessKeyId: "", secretAccessKey: "",
  });
  const [scheduleSettings, setScheduleSettings] = useState<Pick<SchedulePublic, "enabled" | "intervalHours" | "autoUpload" | "retentionDays" | "keepLocal">>({
    enabled: initialDashboard.schedule?.enabled ?? false,
    intervalHours: initialDashboard.schedule?.intervalHours ?? 24,
    autoUpload: initialDashboard.schedule?.autoUpload ?? false,
    retentionDays: initialDashboard.schedule?.retentionDays ?? 0,
    keepLocal: initialDashboard.schedule?.keepLocal ?? 3,
  });
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
          if (job.kind === "verify" && job.backupId && !isActive(job)) {
            backups = backups.map((record) => record.id === job.backupId
              ? { ...record, state: job.state === "completed" ? "verified" : "needs_review",
                  level: job.state === "completed" ? "V2" : "V1" } : record);
          }
          if (job.kind === "r2_upload" && job.backupId &&
              job.state === "completed") {
            backups = backups.map((record) => record.id === job.backupId
              ? { ...record, remoteState: "remote_verified" } : record);
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

  async function runR2Action(action: () => Promise<BackupActionResult>) {
    if (!dashboard.connected || busy) return;
    setBusy(true);
    setFeedback("");
    try {
      const reply = await action();
      setFeedback(reply.message);
      if (reply.ok) {
        setDashboard((prev) => ({
          ...prev,
          r2: reply.r2 ?? prev.r2,
          schedule: reply.schedule ?? prev.schedule,
        }));
        if (reply.remote) setRemoteRecords(reply.remote);
        if (reply.r2?.configured) {
          setCredentials({ accountId: "", bucket: "", accessKeyId: "", secretAccessKey: "" });
        }
      }
    } catch {
      setFeedback("R2 operation unavailable. Previous configuration was preserved.");
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
          Encrypted local snapshots, Cloudflare R2 storage and UTC schedules.
          Restore remains disabled until BR-04.
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
        <StatCard compact label="Automatic backups" value={dashboard.schedule?.enabled ? "Enabled (UTC)" : "Disabled"} />
        <StatCard compact label="Cloudflare R2" value={dashboard.r2?.configured ? "Configured" : "Not configured"} />
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
                      <span className="ml-2 text-muted-foreground">{byteLabel(backup.bytes)} · {backup.state === "verified" ? "V2 verified" : "Needs recheck"}
                        {backup.remoteState === "remote_verified" ? " · R2 verified" : ""}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button type="button" variant="outline" size="xs"
                        disabled={!dashboard.connected || !onVerifyBackup || active || backup.localState === "deleted"}
                        onClick={() => { if (onVerifyBackup) void begin(() => onVerifyBackup(backup.id)); }}>Verify now</Button>
                      <Button type="button" variant="outline" size="xs"
                        disabled={!dashboard.r2?.configured || backup.state !== "verified" ||
                          backup.localState === "deleted" || active}
                        onClick={() => void begin(() => uploadR2Action(backup.id))}>Upload encrypted to R2</Button>
                    </div>
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
            <Badge variant="outline">BR-03</Badge>
          </PanelHeader>
          <PanelBody className="space-y-3">
            <p className="text-xs text-muted-foreground">
              UTC-only automatic backups. Default OFF; missed runs are never replayed.
              Retention is OFF by default and can only prune old local snapshots
              with a fresh verified remote copy, retaining at least three local backups.
            </p>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox"
              checked={scheduleSettings.enabled}
              onChange={event => setScheduleSettings(prev => ({ ...prev, enabled: event.target.checked }))}
              disabled={!dashboard.connected || busy} />Enable automatic backups</label>
            <label className="block text-xs">Interval (hours)
              <select className="mt-1 w-full rounded border border-border bg-background p-2"
                value={scheduleSettings.intervalHours} disabled={!dashboard.connected || busy}
                onChange={e => setScheduleSettings(prev => ({ ...prev, intervalHours: Number(e.target.value) as 6 | 12 | 24 }))}>
                <option value={6}>6 hours</option><option value={12}>12 hours</option><option value={24}>24 hours</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox"
              checked={scheduleSettings.autoUpload} disabled={!dashboard.connected || busy}
              onChange={e => setScheduleSettings(prev => ({ ...prev, autoUpload: e.target.checked }))} />
              Upload verified backups to R2 automatically</label>
            <label className="block text-xs">Local retention (0 = disabled)
              <select className="mt-1 w-full rounded border border-border bg-background p-2"
                value={scheduleSettings.retentionDays} disabled={!dashboard.connected || busy}
                onChange={e => setScheduleSettings(prev => ({ ...prev, retentionDays: Number(e.target.value) }))}>
                {[0, 7, 14, 30, 60, 90, 180, 365].map(value =>
                  <option key={value} value={value}>{value === 0 ? "Off" : value + " days"}</option>)}
              </select>
            </label>
            <label className="block text-xs">Minimum retained local verified backups
              <input type="number" className="mt-1 w-full rounded border border-border bg-background p-2"
                min={3} max={30} value={scheduleSettings.keepLocal}
                disabled={!dashboard.connected || busy}
                onChange={e => setScheduleSettings(prev => ({ ...prev, keepLocal: Number(e.target.value) }))} />
            </label>
            <Button type="button" variant="outline" disabled={!dashboard.connected || busy}
              onClick={() => void runR2Action(() => configureScheduleAction(scheduleSettings))}>
              Save UTC schedule
            </Button>
            <p className="text-xs text-muted-foreground">Status: {dashboard.schedule?.enabled ? "Enabled" : "Disabled"} · last run: {dashboard.schedule?.lastRunAt ?? "Never"}</p>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <div className="flex items-center gap-2">
              <Cloud aria-hidden="true" className="size-4 text-muted-foreground" />
              <SectionTitle>Cloudflare R2 storage</SectionTitle>
            </div>
            <Badge variant="outline">BR-03</Badge>
          </PanelHeader>
          <PanelBody className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {dashboard.r2?.configured
                ? "Configured bucket: " + dashboard.r2.bucket + " · access key ending " + dashboard.r2.accessKeyLast4
                : "R2 is not configured. Only encrypted, V2-verified archives can be uploaded."}
              {" "}Credentials are stored encrypted on the host and never shown after saving.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ["accountId", "Cloudflare account ID"],
                ["bucket", "R2 bucket"],
                ["accessKeyId", "R2 access key ID"],
                ["secretAccessKey", "R2 secret access key"],
              ] as const).map(([field, label]) => (
                <label key={field} className="text-xs">{label}
                  <input className="mt-1 w-full rounded border border-border bg-background p-2"
                    aria-label={label}
                    type={field === "secretAccessKey" || field === "accessKeyId" ? "password" : "text"}
                    autoComplete="off" value={credentials[field]}
                    disabled={!dashboard.connected || busy}
                    onChange={e => setCredentials(prev => ({ ...prev, [field]: e.target.value }))} />
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Saving checks list, temporary write/read and owned temporary probe cleanup before activation. Previous working credentials remain on failure.</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Cloudflare R2 actions">
              <Button type="button" variant="outline" disabled={!dashboard.connected || busy}
                onClick={() => void runR2Action(() => configureR2Action(credentials))}>
                {dashboard.r2?.configured ? "Rotate & test R2 credentials" : "Save & test R2 credentials"}
              </Button>
              <Button type="button" variant="outline" disabled={!dashboard.r2?.configured || busy}
                onClick={() => void runR2Action(testR2Action)}>Test connection</Button>
              <Button type="button" variant="outline" disabled={!dashboard.r2?.configured || busy}
                onClick={() => void runR2Action(listR2Action)}>Refresh remote history</Button>
            </div>
            {remoteRecords.length ? (
              <ul aria-label="R2 remote backup history" className="max-h-40 overflow-auto divide-y divide-border text-xs">
                {remoteRecords.slice(0, 30).map(remote => (
                  <li key={remote.backupId} className="py-2 font-mono">
                    {remote.backupId.slice(0, 12)}… · {byteLabel(remote.bytes)} · Remote object present
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-muted-foreground">No remote objects loaded. Listing does not prove full remote verification.</p>}
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
                    <span>{job.kind === "backup" ? "Create backup" : job.kind === "verify" ? "Verify backup" : "R2 upload"}</span>
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
