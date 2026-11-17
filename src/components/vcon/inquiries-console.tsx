"use client";

import {
  AlertBanner,
  Badge,
  Button,
  CaptionText,
  CopyButton,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Input,
  MonoText,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
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
import { formatCompactTimestamp } from "@/components/users/user-workspace-helpers";
import type { PersistedContactSubmissionItem } from "@/core/contact/service";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export const INQUIRY_SERVICE_LABELS: Readonly<Record<string, string>> = {
  personal: "Account & Personal Workspace",
  team: "Team Mailboxes & Quota Policy",
  business: "Custom Domain & Enterprise Setup",
  other: "Technical Support & General Inquiry",
};

export interface InquiriesConsoleBundle {
  readonly databaseConfigured: boolean;
  readonly databaseConnected: boolean;
  readonly demoMode?: boolean;
  readonly query: string;
  readonly serviceFilter: string;
  readonly totalCount: number;
  readonly items: readonly PersistedContactSubmissionItem[];
  readonly topicCounts: {
    readonly total: number;
    readonly personal: number;
    readonly team: number;
    readonly business: number;
    readonly support: number;
  };
}

export interface InquiriesConsoleProps {
  readonly bundle: InquiriesConsoleBundle;
}

export function InquiriesConsole({ bundle }: InquiriesConsoleProps) {
  const router = useRouter();
  const [query, setQuery] = useState(bundle.query);
  const [serviceFilter, setServiceFilter] = useState(bundle.serviceFilter);
  const [selectedInquiry, setSelectedInquiry] =
    useState<PersistedContactSubmissionItem | null>(null);

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (serviceFilter) params.set("service", serviceFilter);
    const qs = params.toString();
    router.push(qs ? `/vcon/inquiries?${qs}` : "/vcon/inquiries");
  }

  function handleClearFilter() {
    setQuery("");
    setServiceFilter("");
    router.push("/vcon/inquiries");
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Contact inquiries"
        actions={
          <Badge variant="default">
            {bundle.totalCount}{" "}
            {bundle.totalCount === 1 ? "inquiry" : "inquiries"}
          </Badge>
        }
      />

      {!bundle.databaseConfigured && !bundle.demoMode ? (
        <AlertBanner variant="warning" role="status">
          Database is not configured. Connect PostgreSQL to inspect persisted
          public contact submissions.
        </AlertBanner>
      ) : !bundle.databaseConnected && !bundle.demoMode ? (
        <AlertBanner variant="error">
          Could not load public contact inquiries from PostgreSQL.
        </AlertBanner>
      ) : null}

      <StatGrid>
        <StatCard
          label="Total inquiries"
          value={bundle.topicCounts.total}
        />
        <StatCard
          label="Personal / Account"
          value={bundle.topicCounts.personal}
        />
        <StatCard
          label="Team & Business"
          value={bundle.topicCounts.team + bundle.topicCounts.business}
        />
        <StatCard
          label="Support & Other"
          value={bundle.topicCounts.support}
        />
      </StatGrid>

      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <SectionTitle>Public contact submissions</SectionTitle>
            <CaptionText>
              Submissions recorded from the public /contact form with CSRF and
              rate-limit verification.
            </CaptionText>
          </div>

          <form
            onSubmit={handleFilterSubmit}
            className="flex flex-wrap items-center gap-1.5"
          >
            <Select
              aria-label="Filter by topic"
              value={serviceFilter}
              onChange={(event) => setServiceFilter(event.target.value)}
              className="w-48"
            >
              <option value="">All topics</option>
              {Object.entries(INQUIRY_SERVICE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search sender, email, company, request ID..."
              aria-label="Search contact inquiries"
              className="w-60"
            />
            <Button type="submit" size="sm" variant="secondary">
              Filter
            </Button>
            {bundle.query || bundle.serviceFilter ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleClearFilter}
              >
                Clear
              </Button>
            ) : null}
          </form>
        </PanelHeader>

        {bundle.items.length === 0 ? (
          <PanelBody className="py-8 text-center">
            <p className="text-xs font-medium text-foreground">
              No contact inquiries found
            </p>
            <CaptionText className="mt-1 block">
              Public contact form submissions matching the active filter will
              appear here.
            </CaptionText>
          </PanelBody>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Submitted</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead>Message preview</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bundle.items.map((item) => (
                <TableRow key={item.requestId}>
                  <TableCell>
                    <CaptionText>
                      {formatCompactTimestamp(item.submittedAt)}
                    </CaptionText>
                    <MonoText className="mt-0.5 block text-[11px] text-muted-foreground">
                      #{item.requestId.slice(0, 8)}
                    </MonoText>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-medium text-foreground">
                      {item.fullName || "—"}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1">
                      <MonoText className="text-xs text-muted-foreground">
                        {item.workEmail}
                      </MonoText>
                      {item.workEmail ? (
                        <CopyButton
                          value={item.workEmail}
                          label={`Copy email ${item.workEmail}`}
                        />
                      ) : null}
                    </div>
                    {item.phone ? (
                      <CaptionText className="mt-0.5 block">
                        {item.phone}
                      </CaptionText>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-foreground">
                      {item.company || "—"}
                    </div>
                    {item.teamSize && item.teamSize !== "not_specified" ? (
                      <CaptionText className="mt-0.5 block">
                        Team: {item.teamSize}
                      </CaptionText>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">
                      {item.serviceLabel || item.serviceType || "General"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {item.message}
                    </p>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedInquiry(item)}
                    >
                      View details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Dialog
        open={Boolean(selectedInquiry)}
        onOpenChange={(open) => {
          if (!open) setSelectedInquiry(null);
        }}
      >
        <DialogContent>
          <div className="space-y-1">
            <DialogTitle>
              Inquiry from {selectedInquiry?.fullName || "Contact sender"}
            </DialogTitle>
            <DialogDescription>
              Submitted{" "}
              {selectedInquiry
                ? formatCompactTimestamp(selectedInquiry.submittedAt)
                : ""}{" "}
              · Topic:{" "}
              {selectedInquiry?.serviceLabel ||
                selectedInquiry?.serviceType ||
                "General"}
            </DialogDescription>
          </div>
          {selectedInquiry ? (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-1 gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs sm:grid-cols-2">
                <div>
                  <CaptionText>Sender</CaptionText>
                  <div className="mt-0.5 font-medium text-foreground">
                    {selectedInquiry.fullName || "—"}
                  </div>
                </div>
                <div>
                  <CaptionText>Work email</CaptionText>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <MonoText className="text-xs text-foreground">
                      {selectedInquiry.workEmail}
                    </MonoText>
                    <CopyButton
                      value={selectedInquiry.workEmail}
                      label="Copy sender email"
                    />
                  </div>
                </div>
                <div>
                  <CaptionText>Company / Organization</CaptionText>
                  <div className="mt-0.5 text-foreground">
                    {selectedInquiry.company || "—"}
                  </div>
                </div>
                <div>
                  <CaptionText>Phone</CaptionText>
                  <div className="mt-0.5 text-foreground">
                    {selectedInquiry.phone || "—"}
                  </div>
                </div>
                <div>
                  <CaptionText>Team size</CaptionText>
                  <div className="mt-0.5 text-foreground">
                    {selectedInquiry.teamSize &&
                    selectedInquiry.teamSize !== "not_specified"
                      ? selectedInquiry.teamSize
                      : "Not specified"}
                  </div>
                </div>
                <div>
                  <CaptionText>Request ID</CaptionText>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <MonoText className="text-xs text-foreground">
                      {selectedInquiry.requestId}
                    </MonoText>
                    <CopyButton
                      value={selectedInquiry.requestId}
                      label="Copy request ID"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <CaptionText>Message</CaptionText>
                <div className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-card p-3 text-xs leading-relaxed text-foreground">
                  {selectedInquiry.message}
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" size="sm" variant="secondary">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
