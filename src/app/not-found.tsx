import { Button, PageTitle, Panel, PanelBody } from "@/components/ui";
import Link from "next/link";

export default function GlobalNotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl items-center px-4 py-8">
      <Panel className="w-full">
        <PanelBody className="space-y-2.5 p-4">
          <PageTitle>Page not found</PageTitle>
          <p className="text-xs text-muted-foreground">
            The requested route does not exist or is no longer available.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm">
              <Link href="/">Home</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/users">Workspace</Link>
            </Button>
          </div>
        </PanelBody>
      </Panel>
    </main>
  );
}
