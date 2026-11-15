"use client";

import { Icon } from "@/components/ui/icon";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function CopyMailboxButton({
  emailAddress,
}: {
  readonly emailAddress: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(emailAddress);
        setCopied(true);
        toast.success(`Copied ${emailAddress}`);
        return;
      }
      toast.error("Clipboard access is unavailable in this browser.");
    } catch {
      toast.error("Could not copy mailbox address.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy email address"
      className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-left text-sm font-medium text-foreground hover:text-primary"
    >
      <span className="truncate">{emailAddress}</span>
      <Icon
        glyph={copied ? Check : Copy}
        className={copied ? "text-success" : "text-muted-foreground"}
      />
      <span className="sr-only">
        {copied ? `Copied ${emailAddress}` : `Copy ${emailAddress}`}
      </span>
    </button>
  );
}
