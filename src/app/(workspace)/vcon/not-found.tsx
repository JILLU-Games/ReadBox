import { Button, PageTitle, Panel, PanelBody } from "@/components/ui";
import Link from "next/link";

export default function AdminNotFoundPage() {
  return (
    <Panel className="mx-auto my-8 max-w-xl">
      <PanelBody className="space-y-2 p-4">
        <PageTitle>Resource not found</PageTitle>
        <p className="text-xs text-muted-foreground">
          The requested record or page does not exist or is not accessible.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm">
            <Link href="/users">Return to workspace</Link>
          </Button>
        </div>
      </PanelBody>
    </Panel>
  );
}
