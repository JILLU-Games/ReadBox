"use client";

import {
  AlertBanner,
  Badge,
  Button,
  FormField,
  Icon,
  Input,
  notify,
  PageTitle,
  Panel,
  PanelBody,
} from "@/components/ui";
import type {
  MailboxActionResult,
  MailboxPurgePreview,
} from "@/core/mailboxes/service";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

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
        notify.error(result.error);
        return;
      }
      notify.success(
        result.message ??
          `Mailbox ${mailbox.emailAddress} permanently deleted.`,
      );
      router.push("/vcon/mailboxes");
      router.refresh();
    } catch {
      const msg = "Unable to purge mailbox right now.";
      setError(msg);
      notify.error(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <PageTitle>Permanently delete mailbox</PageTitle>
        <Button asChild size="sm" variant="outline">
          <Link href="/vcon/mailboxes">Back to mailboxes</Link>
        </Button>
      </header>

      <AlertBanner
        variant="error"
        title={`This action permanently erases all data for ${mailbox.emailAddress}`}
        aria-label="Permanent deletion warning"
      >
        <p className="mt-1">
          The mail-server routing entry, stored attachments, Maildir files on
          disk, and indexed messages will all be permanently removed.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">Domain: {mailbox.domainName}</Badge>
          <Badge variant="outline">Status: {mailbox.status}</Badge>
          <Badge variant="outline">Messages: {mailbox.totalMessages}</Badge>
          <Badge variant="outline">Unread: {mailbox.unreadMessages}</Badge>
          <Badge variant="outline">
            Assigned users: {mailbox.assignedUserCount}
          </Badge>
        </div>
      </AlertBanner>

      <Panel>
        <PanelBody className="p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <Button asChild type="button" size="sm" variant="outline">
                <Link href="/vcon/mailboxes">Cancel</Link>
              </Button>
              <Button
                type="submit"
                size="sm"
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
        </PanelBody>
      </Panel>
    </div>
  );
}
