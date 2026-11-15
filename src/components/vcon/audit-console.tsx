import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Admin panel
          </p>
          <h1 className="mt-1 text-xl font-semibold">Audit &amp; security</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={security.activeLockouts.length > 0 ? "warning" : "success"}
          >
            {security.activeLockouts.length} active lockout
            {security.activeLockouts.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </header>

      {!bundle.databaseConfigured ? (
        <section
          className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"
          role="status"
        >
          Database is not configured in this local environment. Redacted
          AuditLog records and LoginAttempt lockout telemetry will appear once
          DATABASE_URL is configured.
        </section>
      ) : !bundle.databaseConnected ? (
        <section
          className="rounded-lg border border-destructive/40 bg-destructive-bg p-4 text-sm text-destructive-muted"
          role="alert"
        >
          Unable to load audit and login security events from PostgreSQL.
        </section>
      ) : null}

      <section
        aria-label="Security summary"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <article className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Matching audit events
          </p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums">
            {logs.totalCount}
          </p>
        </article>
        <article className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Active IP / username lockouts
          </p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums">
            {security.activeLockouts.length}
          </p>
        </article>
        <article className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Recent failed sign-ins (window)
          </p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums">
            {security.recentFailureCount}
          </p>
        </article>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Icon glyph={ShieldAlert} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold">
            Active lockouts &amp; recent sign-in attempts
          </h2>
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
          <div className="rounded-lg border border-border bg-card px-4 py-4 text-sm text-muted-foreground">
            No active username/IP sign-in lockouts.
          </div>
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

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Audit log</h2>
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
            <label className="sr-only" htmlFor="audit-action-filter">
              Filter by action
            </label>
            <select
              id="audit-action-filter"
              name="action"
              defaultValue={logs.actionFilter || "all"}
              className="min-h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground"
            >
              <option value="all">All actions</option>
              {logs.availableActions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>
          <div className="relative min-w-56 flex-1">
            <label className="sr-only" htmlFor="audit-search">
              Search audit logs
            </label>
            <Icon
              glyph={Search}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="audit-search"
              name="q"
              defaultValue={logs.query}
              placeholder="Search actor, target, action, or exact IP"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="outline">
            Filter
          </Button>
          {logs.actionFilter || logs.query ? (
            <Button asChild variant="ghost">
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
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No audit events match the current filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {logs.totalPages > 1 ? (
          <nav
            aria-label="Audit pagination"
            className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
          >
            <span>
              Page {logs.page} of {logs.totalPages} ({logs.totalCount} events)
            </span>
            <div className="flex items-center gap-2">
              {logs.page > 1 ? (
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={buildAuditHref(
                      logs.actionFilter,
                      logs.query,
                      logs.page - 1,
                    )}
                  >
                    Previous
                  </Link>
                </Button>
              ) : null}
              {logs.page < logs.totalPages ? (
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={buildAuditHref(
                      logs.actionFilter,
                      logs.query,
                      logs.page + 1,
                    )}
                  >
                    Next
                  </Link>
                </Button>
              ) : null}
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
