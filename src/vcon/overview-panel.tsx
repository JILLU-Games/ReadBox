import {
  AlertBanner,
  Badge,
  Button,
  CaptionText,
  CopyButton,
  Icon,
  PageHeader,
  Panel,
  PanelHeader,
  SectionTitle,
  StatCard,
  StatGrid,
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
          <p className="truncate">
            <CaptionText>
              {item.meta
                ? `Last seen ${formatTimestamp(item.meta, "Never")}`
                : subtitle}
            </CaptionText>
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
      <PageHeader
        title="System overview"
        actions={
          <>
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
          </>
        }
      />

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

      <StatGrid aria-label="System KPIs">
        {kpiCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            compact={"small" in card && card.small}
          />
        ))}
      </StatGrid>

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
            <CaptionText>Latest 8 deliveries</CaptionText>
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
                    <p className="mt-0.5 truncate">
                      <CaptionText>
                        {message.senderAddress || "Unknown sender"} ·{" "}
                        <span className="font-mono">{message.mailboxEmail}</span>
                      </CaptionText>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <time>
                      <CaptionText className="font-mono tabular-nums">
                        {formatTimestamp(message.receivedAt, "Unknown date")}
                      </CaptionText>
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
            <CaptionText>Click address to copy</CaptionText>
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
                        variant="inline"
                        size="sm"
                        className="h-auto max-w-full px-0 py-0 font-mono"
                      >
                        <span className="truncate">{mailbox.emailAddress}</span>
                      </CopyButton>
                      <p className="mt-0.5">
                        <CaptionText className="tabular-nums">
                          {mailbox.totalMessages}{" "}
                          {msgCount === 1 ? "message" : "messages"}
                        </CaptionText>
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
