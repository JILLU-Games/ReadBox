import {
  AlertBanner,
  Badge,
  Button,
  CopyButton,
  Icon,
  PageTitle,
  Panel,
  PanelHeader,
  SectionTitle,
} from "@/components/ui";
import type {
  AdminOverviewData,
  OverviewHealthItem,
  OverviewHealthState,
} from "@/core/admin/overview";
import { cn } from "@/lib/utils";
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
    <div className="flex items-center justify-between gap-3 border border-border bg-card px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn("size-2 shrink-0", healthDotClass(item.state))}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">{item.label}</p>
          <p className="truncate text-[11px] text-muted-foreground">
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
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2 border border-border bg-card px-3 py-2">
        <PageTitle>System overview</PageTitle>
        <div className="flex flex-wrap items-center gap-1.5">
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
        <AlertBanner
          variant="warning"
          title="Database not configured in this local environment"
          action={<Badge variant="warning">Local dev mode</Badge>}
        >
          Live PostgreSQL counters, user directories, and audit logs activate
          automatically once DATABASE_URL is configured.
        </AlertBanner>
      ) : !data.databaseConnected ? (
        <AlertBanner
          variant="error"
          title="Database temporarily unavailable"
        >
          Live metrics could not be loaded from PostgreSQL. Verify database
          connectivity and refresh.
        </AlertBanner>
      ) : null}

      <section
        aria-label="System KPIs"
        className="grid grid-cols-2 border border-border bg-card sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-border"
      >
        {kpiCards.map((card) => (
          <article key={card.label} className="px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{card.label}</p>
            <p
              className={
                "small" in card && card.small
                  ? "mt-1 truncate font-mono text-xs font-medium tabular-nums text-foreground"
                  : "mt-0.5 text-lg font-medium tabular-nums text-foreground"
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

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <SectionTitle>Recently received</SectionTitle>
            <span className="text-[11px] text-muted-foreground">
              Latest 8 deliveries
            </span>
          </PanelHeader>
          <div className="divide-y divide-border">
            {data.recentMessages.length > 0 ? (
              data.recentMessages.map((message) => (
                <div
                  key={message.uuid}
                  className="flex items-start justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">
                      {message.subject || "(No subject)"}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {message.senderAddress || "Unknown sender"} ·{" "}
                      <span className="font-mono">{message.mailboxEmail}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <time className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {formatTimestamp(message.receivedAt, "Unknown date")}
                    </time>
                    {!message.isRead ? (
                      <Badge variant="default">Unread</Badge>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                No messages have been indexed.
              </p>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader>
            <SectionTitle>Recently created mailboxes</SectionTitle>
            <span className="text-[11px] text-muted-foreground">
              Click address to copy
            </span>
          </PanelHeader>
          <div className="divide-y divide-border">
            {data.recentMailboxes.length > 0 ? (
              data.recentMailboxes.map((mailbox) => {
                const msgCount = Number(mailbox.totalMessages) || 0;
                return (
                  <div
                    key={mailbox.uuid}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <CopyButton
                        value={mailbox.emailAddress}
                        label={`Copy ${mailbox.emailAddress}`}
                        title={`Copy ${mailbox.emailAddress}`}
                        successMessage={`Copied ${mailbox.emailAddress}`}
                        errorMessage="Could not copy mailbox address."
                        className="max-w-full font-mono"
                      >
                        <span className="truncate">{mailbox.emailAddress}</span>
                      </CopyButton>
                      <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                        {mailbox.totalMessages}{" "}
                        {msgCount === 1 ? "message" : "messages"}
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
                );
              })
            ) : (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                No mailboxes created yet.
              </p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
