"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildCloudflareZoneFile,
  type ExpectedDnsRecord,
} from "@/core/dns/records";
import type { CheckedDnsRecordStatus } from "@/core/dns/resolver";
import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  async function handleCopy(value: string, index: number) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedIndex(index);
      toast.success("DNS record value copied.");
      setTimeout(() => {
        setCopiedIndex((current) => (current === index ? null : current));
      }, 1500);
    } catch {
      toast.error("Clipboard copy is unavailable in this browser.");
    }
  }

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
    toast.success(`Downloaded ${domainName}-cloudflare-dns.txt`);
  }

  const hasStatus = records.some((record) => record.status !== undefined);

  return (
    <div className="space-y-4">
      {showCloudflareExport && records.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5 text-xs text-muted-foreground">
            <p>
              <strong className="text-foreground">Required for routing:</strong>{" "}
              MX and mail-host A/AAAA must resolve before enabling a domain.
            </p>
            <p>
              <strong className="text-foreground">Deliverability:</strong> SPF,
              OpenDKIM, and DMARC strengthen sender reputation.
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

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
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
                    variant={
                      record.category === "routing" ? "default" : "outline"
                    }
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
                  <div className="text-[11px] text-muted-foreground">
                    CF name: {record.cfHost}
                  </div>
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
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Copy ${record.type} value for ${record.host}`}
                      onClick={() => void handleCopy(record.value, index)}
                    >
                      <Icon glyph={copiedIndex === index ? Check : Copy} />
                      <span>{copiedIndex === index ? "Copied" : "Copy"}</span>
                    </Button>
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
    </div>
  );
}
