import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

const alertBannerVariants = cva(
  "flex items-start gap-2 rounded-none border px-3 py-2 text-xs",
  {
    variants: {
      variant: {
        error: "border-destructive/40 bg-destructive-bg text-destructive-muted",
        success: "border-success/40 bg-success-bg text-success-foreground",
        warning: "border-border bg-warning-bg text-warning-foreground",
        info: "border-border bg-accent text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

const VARIANT_ICON = {
  error: AlertCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
} as const;

export type AlertBannerProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertBannerVariants> & {
    readonly title?: string;
    readonly action?: ReactNode;
    readonly hideIcon?: boolean;
  };

export function AlertBanner({
  variant = "info",
  title,
  action,
  hideIcon = false,
  className,
  children,
  role,
  ...props
}: AlertBannerProps) {
  const resolvedVariant = variant ?? "info";
  const Glyph = VARIANT_ICON[resolvedVariant];
  const resolvedRole =
    role ?? (resolvedVariant === "error" || resolvedVariant === "warning" ? "alert" : "status");

  return (
    <div
      role={resolvedRole}
      className={cn(alertBannerVariants({ variant: resolvedVariant }), className)}
      {...props}
    >
      {!hideIcon ? (
        <Icon glyph={Glyph} className="mt-0.5 size-3.5 shrink-0" />
      ) : null}
      <div className="min-w-0 flex-1">
        {title ? <div className="font-medium">{title}</div> : null}
        {children}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
