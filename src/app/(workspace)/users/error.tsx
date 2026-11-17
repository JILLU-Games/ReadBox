"use client";

import {
  Button,
  Icon,
  PageTitle,
  Panel,
  PanelBody,
} from "@/components/ui";
import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";

export default function UsersWorkspaceError({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <Panel className="mx-auto my-8 max-w-xl" role="alert">
      <PanelBody className="flex items-start gap-3 p-4">
        <span className="grid size-8 shrink-0 place-items-center border border-destructive/40 bg-destructive-bg text-destructive-muted">
          <Icon glyph={AlertTriangle} />
        </span>
        <div className="min-w-0 space-y-2">
          <PageTitle>User workspace is temporarily unavailable</PageTitle>
          <p className="text-xs text-muted-foreground">
            An unexpected error prevented loading your mailboxes or settings.
            Retry or return to the user overview.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" size="sm" onClick={() => reset()}>
              <Icon glyph={RotateCcw} />
              Try again
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/users">User overview</Link>
            </Button>
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}
