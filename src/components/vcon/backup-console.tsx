import {
  AlertBanner,
  Badge,
  Button,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  SectionTitle,
  StatCard,
  StatGrid,
} from "@/components/ui";
import {
  Archive,
  CalendarClock,
  Cloud,
  HardDrive,
  ListChecks,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

export function BackupConsole() {
  return (
    <div className="space-y-4" data-testid="backup-page-read-only">
      <PageHeader
        title="Backup & Restore"
        icon={HardDrive}
        badge={<Badge variant="warning">Setup required</Badge>}
        actions={<Badge variant="outline">Read-only preview</Badge>}
      >
        <p className="text-xs text-muted-foreground">
          Manage backups, recovery and storage from one place once the
          backup service is connected.
        </p>
      </PageHeader>

      <AlertBanner variant="info" title="Backup controls are not connected">
        BR-01 provides only the administration interface. No backup jobs,
        restore operations, schedules or Cloudflare R2 connections are
        available from this page yet. Existing server backups are not
        inspected or changed.
      </AlertBanner>

      <StatGrid
        aria-label="Backup configuration summary"
        className="sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard compact label="Backup service" value="Not connected" tone="warning" />
        <StatCard compact label="Automatic backups" value="Not configured" />
        <StatCard compact label="Cloudflare R2" value="Not configured" />
        <StatCard compact label="Restore" value="Unavailable" />
      </StatGrid>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader>
            <div className="flex items-center gap-2">
              <Archive aria-hidden="true" className="size-4 text-muted-foreground" />
              <SectionTitle>Local backups</SectionTitle>
            </div>
            <Badge variant="outline">Planned BR-02</Badge>
          </PanelHeader>
          <PanelBody className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Backup history is not loaded in this phase. This is not a
              statement about backups already stored on the VPS.
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Local backup actions">
              <Button type="button" disabled>Create backup</Button>
              <Button type="button" variant="outline" disabled>Verify backup</Button>
              <Button type="button" variant="outline" disabled>View files</Button>
            </div>
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
              No schedule is configured through this interface. Frequency,
              retention and automatic uploads will be available later.
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
              Add encrypted credential storage, connection testing, remote
              history and verified backup uploads in BR-03.
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
            <Badge variant="outline">Planned BR-02</Badge>
          </PanelHeader>
          <PanelBody className="space-y-3">
            <p className="text-xs text-muted-foreground">
              No job history is connected. Future operations will show
              progress and sanitized, copyable job logs.
            </p>
            <Button type="button" variant="outline" disabled>Copy logs</Button>
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
              Restore requires verified encrypted snapshots, a protected
              maintenance window, explicit authorization and rollback.
              Production data is untouched in this phase.
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
