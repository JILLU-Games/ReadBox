import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { CopyMailboxButton } from "@/components/vcon/copy-mailbox-button";
import type {
  AdminOverviewData,
  OverviewHealthItem,
  OverviewHealthState,
} from "@/core/admin/overview";
import { ScrollText, UserPlus, Users } from "lucide-react";
import Link from "next/link";

function formatTimestamp(iso: string | null, emptyLabel: string): string {
  if (!iso) return emptyLabel;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return emptyLabel;
  return parsed.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function healthDotClass(state: OverviewHealthState): string {
  if (state === "ok") return "bg-success";
  if (state === "bad") return "bg-destructive";
  if (state === "unconfigured") return "bg-muted-foreground";
  return "bg-warning";
}

function healthBadgeVariant(
  state: OverviewHealthState,
): "success" | "warning" | "destructive" | "outline" {
  if (state === "ok") return "success";
  if (state === "bad") return "destructive";
  if (state === "unconfigured") return "outline";
  return "warning";
}

function HealthStatusCard({
  item,
  subtitle,
}: {
  readonly item: OverviewHealthItem;
  readonly subtitle: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`size-2.5 shrink-0 rounded-full ${healthDotClass(item.state)}`}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{item.label}</p>
          <p className="truncate text-xs text-muted-foreground">
            {item.meta
              ? `Last seen ${formatTimestamp(item.meta, "Never")}`
              : subtitle}
          </p>
        </div>
      </div>
      <Badge variant={healthBadgeVariant(item.state)}>{item.detail}</Badge>
    </div>
  );
}

export function AdminOverview({
  data,
}: {
  readonly data: AdminOverviewData;
}) {
  const kpiCards = [
    { label: "Total mailboxes", value: String(data.kpis.totalMailboxes) },
    { label: "Active", value: String(data.kpis.activeMailboxes) },
    { label: "Disabled", value: String(data.kpis.disabledMailboxes) },
    { label: "Received emails", value: String(data.kpis.totalMessages) },
    { label: "Unread", value: String(data.kpis.totalUnread) },
    {
      label: "Last received",
      value: formatTimestamp(data.kpis.lastReceivedAt, "No email yet"),
      small: true,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Admin panel
          </p>
          <h1 className="mt-1 text-xl font-semibold">System overview</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link href="/vcon/users/new">
              <Icon glyph={UserPlus} />
              Add user
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/vcon/users">
              <Icon glyph={Users} />
              Users
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/vcon/audit">
              <Icon glyph={ScrollText} />
              Audit &amp; security
            </Link>
          </Button>
        </div>
      </header>

      {!data.databaseConfigured ? (
        <section
          className="rounded-lg border border-border bg-card p-4"
          role="status"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="size-2 rounded-full bg-warning"
                aria-hidden="true"
              />
              <h2 className="text-sm font-semibold">
                Database not configured in this local environment
              </h2>
            </div>
            <Badge variant="warning">Local dev mode</Badge>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Live PostgreSQL counters, user directories, and audit logs activate
            automatically once DATABASE_URL is configured.
          </p>
        </section>
      ) : !data.databaseConnected ? (
        <section
          className="rounded-lg border border-destructive/40 bg-destructive-bg p-4 text-destructive-muted"
          role="alert"
        >
          <h2 className="text-sm font-semibold">Database temporarily unavailable</h2>
          <p className="mt-1 text-xs">
            Live metrics could not be loaded from PostgreSQL. Verify database
            connectivity and refresh.
          </p>
        </section>
      ) : null}

      <section aria-label="System KPIs" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((card) => (
          <article
            key={card.label}
            className="rounded-lg border border-border bg-card p-4"
          >
            <p className="text-xs font-medium text-muted-foreground">
              {card.label}
            </p>
            <p
              className={
                "small" in card && card.small
                  ? "mt-2 text-sm font-semibold tabular-nums text-foreground"
                  : "mt-1.5 text-2xl font-semibold tabular-nums text-foreground"
              }
            >
              {card.value}
            </p>
          </article>
        ))}
      </section>

      <section
        aria-label="Service health"
        className="grid grid-cols-1 gap-3 md:grid-cols-3"
      >
        <HealthStatusCard
          item={data.health.database}
          subtitle="PostgreSQL connection"
        />
        <HealthStatusCard
          item={data.health.ingestion}
          subtitle="Maildir worker heartbeat"
        />
        <HealthStatusCard
          item={data.health.mailStorage}
          subtitle="Storage RWX permissions"
        />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Recently received</h2>
            <span className="text-xs text-muted-foreground">
              Latest 8 deliveries
            </span>
          </div>
          <div className="divide-y divide-border">
            {data.recentMessages.length > 0 ? (
              data.recentMessages.map((message) => (
                <div
                  key={message.uuid}
                  className="flex items-start justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {message.subject || "(No subject)"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {message.senderAddress || "Unknown sender"} ·{" "}
                      {message.mailboxEmail}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <time className="text-xs text-muted-foreground">
                      {formatTimestamp(message.receivedAt, "Unknown date")}
                    </time>
                    {!message.isRead ? (
                      <Badge variant="default">Unread</Badge>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No messages have been indexed.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Recently created mailboxes</h2>
            <span className="text-xs text-muted-foreground">
              Click address to copy
            </span>
          </div>
          <div className="divide-y divide-border">
            {data.recentMailboxes.length > 0 ? (
              data.recentMailboxes.map((mailbox) => (
                <div
                  key={mailbox.uuid}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <CopyMailboxButton emailAddress={mailbox.emailAddress} />
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {mailbox.totalMessages} messages
                    </p>
                  </div>
                  <Badge
                    variant={
                      mailbox.status === "active" ? "success" : "warning"
                    }
                  >
                    {mailbox.status === "active" ? "Active" : "Disabled"}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No mailboxes created yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
