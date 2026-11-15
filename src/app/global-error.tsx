"use client";

import "./globals.css";
import { Button, Icon, PageTitle, Panel, PanelBody } from "@/components/ui";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalErrorPage({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <main className="mx-auto flex min-h-dvh w-full max-w-xl items-center px-4 py-8">
          <Panel className="w-full" role="alert">
            <PanelBody className="flex items-start gap-3 p-4">
              <span className="grid size-8 shrink-0 place-items-center border border-destructive/40 bg-destructive-bg text-destructive-muted">
                <Icon glyph={AlertTriangle} />
              </span>
              <div className="min-w-0 space-y-2">
                <PageTitle>Application error</PageTitle>
                <p className="text-xs text-muted-foreground">
                  An unexpected error prevented rendering this page. Retry or
                  reload to recover.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="button" size="sm" onClick={() => reset()}>
                    <Icon glyph={RotateCcw} />
                    Try again
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => window.location.assign("/")}
                  >
                    Reload home
                  </Button>
                </div>
              </div>
            </PanelBody>
          </Panel>
        </main>
      </body>
    </html>
  );
}
