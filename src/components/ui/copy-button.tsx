"use client";

import { Icon } from "@/components/ui/icon";
import { notify } from "@/components/ui/notifications";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Check, Copy } from "lucide-react";
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

const copyButtonVariants = cva(
  "inline-flex min-w-0 items-center gap-1.5 rounded-none font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        inline: "text-foreground hover:text-primary",
        outline:
          "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
        secondary:
          "border border-border bg-card text-foreground hover:bg-muted",
      },
      size: {
        inline: "text-xs",
        xs: "h-6 px-1.5 text-[11px]",
        sm: "h-7 px-2.5 text-xs",
      },
    },
    defaultVariants: {
      variant: "inline",
      size: "inline",
    },
  },
);

function fallbackExecCopy(value: string): boolean {
  if (typeof document === "undefined" || !document.body) return false;
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  } finally {
    document.body.removeChild(textarea);
  }
  return ok;
}

export interface CopyButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type">,
    VariantProps<typeof copyButtonVariants> {
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
  variant = "inline",
  size = "inline",
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
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else if (!fallbackExecCopy(value)) {
        notify.error(errorMessage);
        return;
      }
      setCopied(true);
      notify.success(successMessage);
      onCopied?.();
    } catch {
      if (fallbackExecCopy(value)) {
        setCopied(true);
        notify.success(successMessage);
        onCopied?.();
        return;
      }
      notify.error(errorMessage);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label ?? (title || `Copy ${value}`)}
      title={title ?? label ?? "Copy"}
      className={cn(copyButtonVariants({ variant, size }), className)}
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
