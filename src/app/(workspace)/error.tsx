"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";

export default function WorkspaceError({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <section
      className="mx-auto my-8 max-w-xl rounded-lg border border-border bg-card p-6 text-card-foreground"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-destructive-bg text-destructive-muted">
          <Icon glyph={AlertTriangle} />
        </span>
        <div className="min-w-0 space-y-2">
          <h1 className="text-base font-semibold">
            This workspace view is temporarily unavailable
          </h1>
          <p className="text-sm text-muted-foreground">
            An unexpected error prevented loading this page cleanly. Try again or
            return to the workspace home.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" onClick={() => reset()}>
              <Icon glyph={RotateCcw} />
              Try again
            </Button>
            <Button asChild variant="outline">
              <Link href="/users">Back to workspace</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
