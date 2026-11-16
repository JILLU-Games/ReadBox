"use client";

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
          <div
            className="w-full border border-border bg-card p-4 text-card-foreground"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center border border-destructive/40 bg-destructive/10 text-destructive font-bold text-sm">
                !
              </span>
              <div className="min-w-0 space-y-2">
                <h1 className="text-base font-semibold tracking-tight">
                  Application error
                </h1>
                <p className="text-xs text-muted-foreground">
                  An unexpected error prevented rendering this page. Retry or
                  reload to recover.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    className="inline-flex h-7 items-center justify-center bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                    onClick={() => reset()}
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-7 items-center justify-center border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-muted"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.location.assign("/");
                      }
                    }}
                  >
                    Reload home
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
