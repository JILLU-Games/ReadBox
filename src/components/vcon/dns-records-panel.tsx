"use client";

import {
  Badge,
  Button,
  CaptionText,
  CopyButton,
  Icon,
  notify,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import {
  buildCloudflareZoneFile,
  type ExpectedDnsRecord,
} from "@/core/dns/records";
import type { CheckedDnsRecordStatus } from "@/core/dns/resolver";
import { Download } from "lucide-react";

export interface DisplayDnsRecord extends ExpectedDnsRecord {
  readonly status?: CheckedDnsRecordStatus;
}

function statusBadge(status: CheckedDnsRecordStatus | undefined) {
  if (!status) return null;
  if (status === "verified") {
    return <Badge variant="success">Verified</Badge>;
  }
  if (status === "unavailable") {
    return <Badge variant="outline">Unavailable</Badge>;
  }
  if (status === "error") {
    return <Badge variant="destructive">Error</Badge>;
  }
  return <Badge variant="warning">Missing</Badge>;
}

export function DnsRecordsPanel({
  domainName,
  records,
  showCloudflareExport = true,
}: {
  readonly domainName: string;
  readonly records: readonly DisplayDnsRecord[];
  readonly showCloudflareExport?: boolean;
}) {
  function handleDownloadZone() {
    if (!domainName) return;
    const zoneText = buildCloudflareZoneFile(domainName, records);
    const blob = new Blob([zoneText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${domainName}-cloudflare-dns.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notify.success(`Downloaded ${domainName}-cloudflare-dns.txt`);
  }

  const hasStatus = records.some((record) => record.status !== undefined);

  return (
    <div className="space-y-3">
      {showCloudflareExport && records.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">
                Required for routing:
              </span>{" "}
              MX and mail-host A/AAAA must resolve before enabling a domain.
            </p>
            <p>
              <span className="font-medium text-foreground">
                Deliverability:
              </span>{" "}
              SPF, OpenDKIM, and DMARC strengthen sender reputation.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadZone}
          >
            <Icon glyph={Download} />
            <span>Download Cloudflare zone</span>
          </Button>
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Purpose</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Host</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Value</TableHead>
            {hasStatus ? <TableHead>Status</TableHead> : null}
            <TableHead className="text-right">Copy</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record, index) => (
            <TableRow key={`${record.type}-${record.host}-${index}`}>
              <TableCell>
                <Badge
                  variant={record.category === "routing" ? "default" : "outline"}
                >
                  {record.category === "routing"
                    ? "Required routing"
                    : "Deliverability"}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs font-medium">
                {record.type}
              </TableCell>
              <TableCell className="font-mono text-xs">
                <div>{record.host}</div>
                <CaptionText className="block">
                  CF name: {record.cfHost}
                </CaptionText>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {record.priority}
              </TableCell>
              <TableCell className="max-w-md font-mono text-xs [overflow-wrap:anywhere]">
                {record.value}
              </TableCell>
              {hasStatus ? (
                <TableCell>{statusBadge(record.status)}</TableCell>
              ) : null}
              <TableCell className="text-right">
                {record.copyable ? (
                  <CopyButton
                    value={record.value}
                    label={`Copy ${record.type} value for ${record.host}`}
                    successMessage="DNS record value copied."
                    errorMessage="Clipboard copy is unavailable in this browser."
                    variant="outline"
                    size="xs"
                  >
                    <span>Copy</span>
                  </CopyButton>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Not configured
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
