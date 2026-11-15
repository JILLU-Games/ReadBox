import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AdminNotFoundPage() {
  return (
    <section className="mx-auto my-8 max-w-xl rounded-lg border border-border bg-card p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Not found
      </p>
      <h1 className="mt-1 text-lg font-semibold">Resource not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The requested record or page does not exist or is not accessible.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/users">Return to workspace</Link>
        </Button>
      </div>
    </section>
  );
}
