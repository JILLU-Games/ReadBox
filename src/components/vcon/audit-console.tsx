import {
  AlertBanner,
  Badge,
  Button,
  Icon,
  Input,
  Label,
  PageHeader,
  Pagination,
  Panel,
  PanelBody,
  SectionTitle,
  Select,
  StatCard,
  StatGrid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import type { AuditMonitorBundle } from "@/core/audit/queries";
import { Search, ShieldAlert } from "lucide-react";
import Link from "next/link";

function formatTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toISOString().slice(0, 19).replace("T", " ") + " UTC";
}

function buildAuditHref(action: string, query: string, page: number): string {
  const params = new URLSearchParams();
  if (action && action !== "all") params.set("action", action);
  if (query.trim()) params.set("q", query.trim());
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/vcon/audit?${suffix}` : "/vcon/audit";
}

function formatDetailsPreview(details: Record<string, unknown>): string {
  const entries = Object.entries(details);
  if (entries.length === 0) return "—";
  return JSON.stringify(details);
}

export function AuditConsole({
  bundle,
}: {
  readonly bundle: AuditMonitorBundle;
}) {
  const { logs, security } = bundle;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit & security"
        actions={
          <Badge
            variant={security.activeLockouts.length > 0 ? "warning" : "success"}
          >
            {security.activeLockouts.length} active lockout
            {security.activeLockouts.length === 1 ? "" : "s"}
          </Badge>
        }
      />

      {!bundle.databaseConfigured ? (
        <AlertBanner variant="warning" role="status">
          Database is not configured in this local environment. Redacted
          AuditLog records and LoginAttempt lockout telemetry will appear once
          DATABASE_URL is configured.
        </AlertBanner>
      ) : !bundle.databaseConnected ? (
        <AlertBanner variant="error">
          Unable to load audit and login security events from PostgreSQL.
        </AlertBanner>
      ) : null}

      <StatGrid
        aria-label="Security summary"
        className="sm:grid-cols-3 lg:grid-cols-3"
      >
        <StatCard label="Matching audit events" value={logs.totalCount} />
        <StatCard
          label="Active IP / username lockouts"
          value={security.activeLockouts.length}
        />
        <StatCard
          label="Recent failed sign-ins (window)"
          value={security.recentFailureCount}
        />
      </StatGrid>

      <section className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Icon glyph={ShieldAlert} className="text-muted-foreground" />
          <SectionTitle>
            Active lockouts &amp; recent sign-in attempts
          </SectionTitle>
        </div>

        {security.activeLockouts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Client IP</TableHead>
                <TableHead>Failures in burst</TableHead>
                <TableHead>Latest failure</TableHead>
                <TableHead>Locked until</TableHead>
                <TableHead>Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {security.activeLockouts.map((lockout) => (
                <TableRow
                  key={`${lockout.usernameNormalized}-${lockout.ipAddress ?? "unknown"}`}
                >
                  <TableCell className="font-medium">
                    {lockout.usernameNormalized}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {lockout.ipAddress ?? "Unattributed"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {lockout.failureCount}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatTimestamp(lockout.latestFailureAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatTimestamp(lockout.lockedUntil)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="destructive">
                      {lockout.remainingSeconds}s
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Panel>
            <PanelBody className="p-3 text-xs text-muted-foreground">
              No active username/IP sign-in lockouts.
            </PanelBody>
          </Panel>
        )}

        {security.recentAttempts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Client IP</TableHead>
                <TableHead>Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {security.recentAttempts.map((attempt) => (
                <TableRow key={attempt.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatTimestamp(attempt.createdAt)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {attempt.usernameNormalized}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {attempt.ipAddress ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={attempt.succeeded ? "success" : "warning"}>
                      {attempt.succeeded ? "Succeeded" : "Failed"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </section>

      <section className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Audit log</SectionTitle>
          <span className="text-xs text-muted-foreground">
            Sensitive keys are automatically redacted
          </span>
        </div>

        <form
          method="get"
          action="/vcon/audit"
          role="search"
          className="flex flex-wrap items-center gap-2"
        >
          <div>
            <Label className="sr-only" htmlFor="audit-action-filter">
              Filter by action
            </Label>
            <Select
              id="audit-action-filter"
              name="action"
              defaultValue={logs.actionFilter || "all"}
            >
              <option value="all">All actions</option>
              {logs.availableActions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </Select>
          </div>
          <div className="relative min-w-56 flex-1">
            <Label className="sr-only" htmlFor="audit-search">
              Search audit logs
            </Label>
            <Icon
              glyph={Search}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="audit-search"
              name="q"
              defaultValue={logs.query}
              placeholder="Search actor, target, action, or exact IP"
              className="pl-8"
            />
          </div>
          <Button type="submit" size="sm" variant="outline">
            Filter
          </Button>
          {logs.actionFilter || logs.query ? (
            <Button asChild size="sm" variant="ghost">
              <Link href="/vcon/audit">Reset</Link>
            </Button>
          ) : null}
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>IP address</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.items.length > 0 ? (
              logs.items.map((entry) => (
                <TableRow key={entry.uuid}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatTimestamp(entry.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{entry.action}</Badge>
                  </TableCell>
                  <TableCell>{entry.actorUsername ?? "System"}</TableCell>
                  <TableCell className="text-xs">
                    {entry.targetType ? `${entry.targetType}: ` : ""}
                    <span className="font-medium text-foreground">
                      {entry.targetIdentifier || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {entry.ipAddress ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-sm truncate font-mono text-xs text-muted-foreground">
                    {formatDetailsPreview(entry.details)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-xs text-muted-foreground"
                >
                  No audit events match the current filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Pagination
          variant="boxed"
          page={logs.page}
          totalPages={logs.totalPages}
          totalCount={logs.totalCount}
          prevHref={
            logs.page > 1
              ? buildAuditHref(logs.actionFilter, logs.query, logs.page - 1)
              : null
          }
          nextHref={
            logs.page < logs.totalPages
              ? buildAuditHref(logs.actionFilter, logs.query, logs.page + 1)
              : null
          }
        />
      </section>
    </div>
  );
}
