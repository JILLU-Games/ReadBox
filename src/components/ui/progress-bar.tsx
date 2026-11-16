import { cn } from "@/lib/utils";

export interface ProgressBarProps {
  readonly id?: string;
  readonly value: number;
  readonly max?: number;
  readonly label?: string;
  readonly className?: string;
}

export function ProgressBar({
  id,
  value,
  max = 100,
  label = "Progress",
  className,
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.max(0, Math.min(safeMax, value));

  return (
    <progress
      id={id}
      value={clamped}
      max={safeMax}
      aria-label={label}
      className={cn(
        "block h-2 w-full appearance-none overflow-hidden rounded-none bg-muted [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary",
        className,
      )}
    />
  );
}
