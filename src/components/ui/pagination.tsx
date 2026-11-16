import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

export interface PaginationProps {
  readonly page: number;
  readonly totalPages: number;
  readonly totalCount?: number;
  readonly prevHref?: string | null;
  readonly nextHref?: string | null;
  readonly onPrev?: () => void;
  readonly onNext?: () => void;
  readonly variant?: "boxed" | "flush";
  readonly className?: string;
}

export function Pagination({
  page,
  totalPages,
  totalCount,
  prevHref,
  nextHref,
  onPrev,
  onNext,
  variant = "boxed",
  className,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground",
        variant === "boxed"
          ? "rounded-none border border-border bg-card"
          : "border-t border-border",
        className,
      )}
    >
      <span className="tabular-nums">
        Page {page} / {totalPages}
        {typeof totalCount === "number" ? ` (${totalCount})` : ""}
      </span>

      <div className="flex items-center gap-1.5">
        {page > 1 && prevHref ? (
          <Button asChild size="sm" variant="outline">
            <Link href={prevHref}>Previous</Link>
          </Button>
        ) : page > 1 && onPrev ? (
          <Button type="button" size="sm" variant="outline" onClick={onPrev}>
            Previous
          </Button>
        ) : null}

        {page < totalPages && nextHref ? (
          <Button asChild size="sm" variant="outline">
            <Link href={nextHref}>Next</Link>
          </Button>
        ) : page < totalPages && onNext ? (
          <Button type="button" size="sm" variant="outline" onClick={onNext}>
            Next
          </Button>
        ) : null}
      </div>
    </nav>
  );
}
