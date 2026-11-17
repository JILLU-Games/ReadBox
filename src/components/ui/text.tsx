import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function PageTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn("text-base font-medium tracking-tight text-foreground", className)}
      {...props}
    >
      {children}
    </h1>
  );
}

export function SectionTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-xs font-medium text-foreground", className)}
      {...props}
    >
      {children}
    </h2>
  );
}

export function SubHeading({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-xs font-medium text-foreground", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function MutedText({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("text-xs text-muted-foreground", className)} {...props} />
  );
}

export function CaptionText({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("text-[11px] text-muted-foreground", className)} {...props} />
  );
}

export function MonoText({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("font-mono text-xs tabular-nums", className)} {...props} />
  );
}
