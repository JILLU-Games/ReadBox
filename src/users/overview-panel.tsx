import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function UserOverview() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">User panel</p>
          <h1 className="mt-1 text-xl font-semibold">Mailbox workspace</h1>
        </div>
        <Badge variant="warning">Foundation</Badge>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Workspace status">
        {[
          ["Mailboxes", "—"],
          ["Unread messages", "—"],
          ["Latest delivery", "—"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-lg font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-md border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Recent activity</h2>
        </div>
        <Table className="border-0 rounded-none">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Mailbox</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                No mailbox data is connected in this foundation setup.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
