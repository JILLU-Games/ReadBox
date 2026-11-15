"use client";

import { Icon } from "@/components/ui/icon";
import { notify } from "@/components/ui/notifications";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export interface CopyButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type"> {
  readonly value: string;
  readonly label?: string;
  readonly successMessage?: string;
  readonly errorMessage?: string;
  readonly children?: ReactNode;
  readonly onCopied?: () => void;
}

export function CopyButton({
  value,
  label,
  successMessage = "Copied to clipboard",
  errorMessage = "Clipboard copy unavailable",
  children,
  className,
  onCopied,
  title,
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      notify.error(errorMessage);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      notify.success(successMessage);
      onCopied?.();
    } catch {
      notify.error(errorMessage);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label ?? (title || `Copy ${value}`)}
      title={title ?? label ?? "Copy"}
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 rounded-none text-xs font-medium text-foreground transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      <Icon
        glyph={copied ? Check : Copy}
        className={cn("size-3 shrink-0", copied ? "text-success" : "text-muted-foreground")}
      />
    </button>
  );
}
