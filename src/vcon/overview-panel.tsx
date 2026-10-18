import { Badge } from "@/components/ui/badge";

export function AdminOverview() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin panel</p>
          <h1 className="mt-1 text-xl font-semibold">System overview</h1>
        </div>
        <Badge variant="warning">Foundation</Badge>
      </header>

      <section className="max-w-3xl rounded-md border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-warning" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Services not connected</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This route establishes the admin panel shell only. Authentication, database-backed controls and mail services are not implemented in the foundation phase.
        </p>
      </section>
    </div>
  );
}
