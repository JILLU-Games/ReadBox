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

export interface RouteErrorPanelProps {
  readonly title: string;
  readonly description: string;
  readonly backHref: string;
  readonly backLabel: string;
  readonly onReset: () => void;
}

export function RouteErrorPanel({
  title,
  description,
  backHref,
  backLabel,
  onReset,
}: RouteErrorPanelProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl items-center px-4 py-8">
      <Panel className="w-full" role="alert">
        <PanelBody className="flex items-start gap-3 p-4">
          <span className="grid size-8 shrink-0 place-items-center border border-destructive/40 bg-destructive-bg text-destructive-muted">
            <Icon glyph={AlertTriangle} />
          </span>
          <div className="min-w-0 space-y-2">
            <PageTitle>{title}</PageTitle>
            <p className="text-xs text-muted-foreground">{description}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" size="sm" onClick={onReset}>
                <Icon glyph={RotateCcw} />
                Try again
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={backHref}>{backLabel}</Link>
              </Button>
            </div>
          </div>
        </PanelBody>
      </Panel>
    </main>
  );
}
