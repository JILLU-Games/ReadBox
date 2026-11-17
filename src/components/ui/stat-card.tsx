import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export function StatGrid({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "grid grid-cols-2 divide-y divide-border rounded-none border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-6",
        className,
      )}
      {...props}
    />
  );
}

const STAT_TONE_CLASSES = {
  default: "text-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  muted: "text-muted-foreground",
} as const;

export interface StatCardProps {
  readonly label: string;
  readonly value: ReactNode;
  readonly tone?: keyof typeof STAT_TONE_CLASSES;
  readonly compact?: boolean;
  readonly testId?: string;
  readonly className?: string;
}

export function StatCard({
  label,
  value,
  tone = "default",
  compact = false,
  testId,
  className,
}: StatCardProps) {
  return (
    <div className={cn("min-w-0 px-3 py-2", className)}>
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      <p
        data-testid={testId}
        className={cn(
          compact
            ? "mt-1 truncate font-mono text-xs font-medium tabular-nums"
            : "mt-0.5 text-lg font-medium tabular-nums",
          STAT_TONE_CLASSES[tone],
        )}
      >
        {value}
      </p>
    </div>
  );
}
