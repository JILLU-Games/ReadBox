"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import type {
  MailboxActionResult,
  MailboxPurgePreview,
} from "@/core/mailboxes/service";
import { AlertTriangle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

export function MailboxPurgeConfirm({
  mailbox,
  onPurge,
}: {
  readonly mailbox: MailboxPurgePreview;
  readonly onPurge: (
    uuid: string,
    confirmationEmail: string,
  ) => Promise<MailboxActionResult<{ emailAddress: string }>>;
}) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchesExact =
    confirmation.trim().toLowerCase() === mailbox.emailAddress.toLowerCase();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!matchesExact) {
      setError("Type the full mailbox address to confirm permanent deletion.");
      return;
    }

    setError(null);
    setPending(true);
    try {
      const result = await onPurge(mailbox.uuid, confirmation);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(
        result.message ??
          `Mailbox ${mailbox.emailAddress} permanently deleted.`,
      );
      router.push("/vcon/mailboxes");
      router.refresh();
    } catch {
      setError("Unable to purge mailbox right now.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Mailboxes
          </p>
          <h1 className="mt-1 text-xl font-semibold">
            Permanently delete mailbox
          </h1>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/vcon/mailboxes">Back to mailboxes</Link>
        </Button>
      </header>

      <section
        className="space-y-4 rounded-lg border border-destructive/40 bg-destructive-bg p-5"
        aria-label="Permanent deletion warning"
      >
        <div className="flex items-start gap-3">
          <Icon
            glyph={AlertTriangle}
            className="mt-0.5 shrink-0 text-destructive"
          />
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold text-foreground">
              This action permanently erases all data for{" "}
              <span className="font-mono">{mailbox.emailAddress}</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              The mail-server routing entry, stored attachments, Maildir files on
              disk, and indexed messages will all be permanently removed.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">Domain: {mailbox.domainName}</Badge>
          <Badge variant="outline">Status: {mailbox.status}</Badge>
          <Badge variant="outline">Messages: {mailbox.totalMessages}</Badge>
          <Badge variant="outline">Unread: {mailbox.unreadMessages}</Badge>
          <Badge variant="outline">
            Assigned users: {mailbox.assignedUserCount}
          </Badge>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-border bg-card p-5"
      >
        <FormField
          id="purge-confirmation-input"
          label={`Type "${mailbox.emailAddress}" to confirm permanent deletion`}
          error={error ?? undefined}
        >
          <Input
            id="purge-confirmation-input"
            name="confirmation"
            value={confirmation}
            autoComplete="off"
            spellCheck={false}
            placeholder={mailbox.emailAddress}
            onChange={(event) => setConfirmation(event.target.value)}
            required
          />
        </FormField>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button asChild type="button" variant="outline">
            <Link href="/vcon/mailboxes">Cancel</Link>
          </Button>
          <Button
            type="submit"
            variant="destructive"
            disabled={pending || !matchesExact}
          >
            <Icon glyph={Trash2} />
            <span>
              {pending ? "Deleting..." : "Permanently delete mailbox"}
            </span>
          </Button>
        </div>
      </form>
    </div>
  );
}
