"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { generateRandomUsername } from "@/core/accounts/credentials-generator";
import type {
  MailboxActionResult,
  MailboxCreationDomainOption,
  MailboxCreationUserOption,
} from "@/core/mailboxes/service";
import { Check, Copy, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

export interface MailboxFormProps {
  readonly domains: readonly MailboxCreationDomainOption[];
  readonly users: readonly MailboxCreationUserOption[];
  readonly databaseConfigured?: boolean;
  readonly onCreate: (input: {
    readonly localPart: string;
    readonly domainUuid?: string;
    readonly assignedUserIds: readonly string[];
  }) => Promise<
    MailboxActionResult<{ uuid: string; emailAddress: string; localPart: string }>
  >;
}

export function MailboxForm({
  domains,
  users,
  databaseConfigured = true,
  onCreate,
}: MailboxFormProps) {
  const router = useRouter();
  const defaultDomain =
    domains.find((domain) => domain.isDefault) ?? domains[0];

  const [domainUuid, setDomainUuid] = useState(defaultDomain?.uuid ?? "");
  const [localPart, setLocalPart] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const selectedDomain = useMemo(
    () => domains.find((domain) => domain.uuid === domainUuid) ?? defaultDomain,
    [domains, domainUuid, defaultDomain],
  );

  const filteredUsers = useMemo(() => {
    const query = userQuery.trim().toLowerCase();
    if (!query) return users;
    return users.filter(
      (user) =>
        user.username.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query),
    );
  }, [users, userQuery]);

  function handleGenerateLocalPart() {
    setLocalPart(generateRandomUsername());
  }

  function toggleUser(id: string) {
    setSelectedUserIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  async function submitCreation(copyAfterCreate: boolean) {
    if (pending) return;
    setFormError(null);
    setFieldErrors({});
    setPending(true);
    try {
      const result = await onCreate({
        localPart,
        domainUuid: domainUuid || undefined,
        assignedUserIds: selectedUserIds,
      });

      if (!result.ok) {
        setFormError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        toast.error(result.error);
        return;
      }

      if (copyAfterCreate) {
        try {
          await navigator.clipboard.writeText(result.data.emailAddress);
          setCopiedEmail(true);
          toast.success(
            `Mailbox ${result.data.emailAddress} created and copied.`,
          );
        } catch {
          setCopiedEmail(false);
          toast.success(`Mailbox ${result.data.emailAddress} created.`);
        }
        setCreatedEmail(result.data.emailAddress);
        return;
      }

      toast.success(`Mailbox ${result.data.emailAddress} created.`);
      router.push("/vcon/mailboxes");
      router.refresh();
    } catch {
      setFormError("Unable to provision mailbox right now.");
    } finally {
      setPending(false);
    }
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitCreation(false);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Mailboxes
          </p>
          <h1 className="mt-1 text-xl font-semibold">Provision mailbox</h1>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/vcon/mailboxes">Back to mailboxes</Link>
        </Button>
      </header>

      {!databaseConfigured ? (
        <section
          className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"
          role="status"
        >
          Database is not configured in this local environment. Connect
          PostgreSQL to provision persistent mailboxes and Maildir directories.
        </section>
      ) : domains.length === 0 ? (
        <section
          className="rounded-lg border border-warning/40 bg-card p-4 text-sm text-foreground"
          role="status"
        >
          No active, DNS-verified domain is available yet.{" "}
          <Link href="/vcon/domains" className="underline">
            Verify and enable a domain
          </Link>{" "}
          before provisioning mailboxes.
        </section>
      ) : null}

      {formError ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive-bg px-4 py-3 text-sm text-destructive-muted"
          role="alert"
        >
          {formError}
        </div>
      ) : null}

      <form onSubmit={handleFormSubmit} className="space-y-6">
        <section className="space-y-4 rounded-lg border border-border bg-card p-5">
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            <FormField
              id="mailbox-domain"
              label="Domain"
              hint="Only active, DNS-verified domains can receive mail."
              error={fieldErrors.domainUuid}
            >
              <select
                id="mailbox-domain"
                name="domainUuid"
                value={domainUuid}
                onChange={(event) => setDomainUuid(event.target.value)}
                disabled={domains.length === 0}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {domains.map((domain) => (
                  <option key={domain.uuid} value={domain.uuid}>
                    {domain.name}
                    {domain.isDefault ? " (Default)" : ""}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              id="mailbox-local-part"
              label="Mailbox local part"
              hint={
                selectedDomain
                  ? `Full address: ${localPart.trim().toLowerCase() || "local"}@${selectedDomain.name}`
                  : "Lowercase letters, numbers, dot, underscore, or hyphen."
              }
              error={fieldErrors.localPart}
            >
              <div className="flex gap-2">
                <Input
                  id="mailbox-local-part"
                  name="localPart"
                  value={localPart}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="e.g. logan.rodriguez"
                  onChange={(event) => setLocalPart(event.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateLocalPart}
                >
                  <Icon glyph={RefreshCw} />
                  <span>Generate</span>
                </Button>
              </div>
            </FormField>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Assign to users</h2>
              <p className="text-xs text-muted-foreground">
                Active non-administrator users granted access to this inbox.
              </p>
            </div>
            <Badge variant="outline">{selectedUserIds.length} selected</Badge>
          </div>

          <div className="relative">
            <label htmlFor="mailbox-user-filter" className="sr-only">
              Filter assignable users
            </label>
            <Icon
              glyph={Search}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="mailbox-user-filter"
              value={userQuery}
              placeholder="Filter users by username or email"
              className="pl-9"
              onChange={(event) => setUserQuery(event.target.value)}
            />
          </div>

          <div className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
            {filteredUsers.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">
                {users.length === 0
                  ? "No active standard users available yet."
                  : "No users match the filter."}
              </p>
            ) : (
              filteredUsers.map((user) => {
                const checkboxId = `assign-user-${user.id}`;
                const checked = selectedUserIds.includes(user.id);
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        id={checkboxId}
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUser(user.id)}
                        className="size-4 rounded border-input accent-primary"
                      />
                      <label htmlFor={checkboxId} className="font-medium">
                        {user.username}
                      </label>
                    </div>
                    {user.email ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button asChild type="button" variant="outline">
            <Link href="/vcon/mailboxes">Cancel</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending || !databaseConfigured || domains.length === 0}
            onClick={() => void submitCreation(true)}
          >
            <Icon glyph={Copy} />
            <span>Create &amp; copy</span>
          </Button>
          <Button
            type="submit"
            disabled={pending || !databaseConfigured || domains.length === 0}
          >
            {pending ? "Provisioning..." : "Create mailbox"}
          </Button>
        </div>
      </form>

      <Dialog
        open={createdEmail !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreatedEmail(null);
            router.push("/vcon/mailboxes");
            router.refresh();
          }
        }}
      >
        <DialogContent>
          <DialogTitle>Mailbox provisioned</DialogTitle>
          <DialogDescription>
            {createdEmail
              ? `Maildir storage and Postfix routing are active for ${createdEmail}.`
              : ""}
          </DialogDescription>
          {createdEmail ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-sm">
              <span className="truncate">{createdEmail}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(createdEmail);
                    setCopiedEmail(true);
                    toast.success("Email address copied.");
                  } catch {
                    toast.error("Clipboard copy is unavailable.");
                  }
                }}
              >
                <Icon glyph={copiedEmail ? Check : Copy} />
                <span>{copiedEmail ? "Copied" : "Copy"}</span>
              </Button>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                setCreatedEmail(null);
                router.push("/vcon/mailboxes");
                router.refresh();
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
