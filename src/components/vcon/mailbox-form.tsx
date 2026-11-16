"use client";

import {
  AlertBanner,
  Badge,
  Button,
  Checkbox,
  CopyButton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  FormField,
  Icon,
  Input,
  Label,
  notify,
  PageTitle,
  Panel,
  PanelBody,
  PanelHeader,
  SectionTitle,
  Select,
} from "@/components/ui";
import { generateRandomUsername } from "@/core/accounts/credentials-generator";
import type {
  MailboxActionResult,
  MailboxCreationDomainOption,
  MailboxCreationUserOption,
} from "@/core/mailboxes/service";
import { Copy, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

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
        notify.error(result.error);
        return;
      }

      if (copyAfterCreate) {
        try {
          await navigator.clipboard.writeText(result.data.emailAddress);
          notify.success(
            `Mailbox ${result.data.emailAddress} created and copied.`,
          );
        } catch {
          notify.success(`Mailbox ${result.data.emailAddress} created.`);
        }
        setCreatedEmail(result.data.emailAddress);
        return;
      }

      notify.success(`Mailbox ${result.data.emailAddress} created.`);
      router.push("/vcon/mailboxes");
      router.refresh();
    } catch {
      const msg = "Unable to provision mailbox right now.";
      setFormError(msg);
      notify.error(msg);
    } finally {
      setPending(false);
    }
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitCreation(false);
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <PageTitle>Provision mailbox</PageTitle>
        <Button asChild size="sm" variant="outline">
          <Link href="/vcon/mailboxes">Back to mailboxes</Link>
        </Button>
      </header>

      {!databaseConfigured ? (
        <AlertBanner variant="warning" role="status">
          Database is not configured in this local environment. Connect
          PostgreSQL to provision persistent mailboxes and Maildir directories.
        </AlertBanner>
      ) : domains.length === 0 ? (
        <AlertBanner variant="warning" role="status">
          No active, DNS-verified domain is available yet.{" "}
          <Link href="/vcon/domains" className="underline">
            Verify and enable a domain
          </Link>{" "}
          before provisioning mailboxes.
        </AlertBanner>
      ) : null}

      {formError ? <AlertBanner variant="error">{formError}</AlertBanner> : null}

      <form onSubmit={handleFormSubmit} className="space-y-4">
        <Panel>
          <PanelBody className="p-4">
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              <FormField
                id="mailbox-domain"
                label="Domain"
                hint="Only active, DNS-verified domains can receive mail."
                error={fieldErrors.domainUuid}
              >
                <Select
                  id="mailbox-domain"
                  name="domainUuid"
                  value={domainUuid}
                  onChange={(event) => setDomainUuid(event.target.value)}
                  disabled={domains.length === 0}
                  className="w-full"
                >
                  {domains.map((domain) => (
                    <option key={domain.uuid} value={domain.uuid}>
                      {domain.name}
                      {domain.isDefault ? " (Default)" : ""}
                    </option>
                  ))}
                </Select>
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
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateLocalPart}
                  >
                    <Icon glyph={RefreshCw} />
                    <span>Generate</span>
                  </Button>
                </div>
              </FormField>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <SectionTitle>Assign to users</SectionTitle>
            <Badge variant="outline">{selectedUserIds.length} selected</Badge>
          </PanelHeader>
          <PanelBody className="space-y-3 p-4">
            <div className="relative">
              <Label htmlFor="mailbox-user-filter" className="sr-only">
                Filter assignable users
              </Label>
              <Icon
                glyph={Search}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="mailbox-user-filter"
                value={userQuery}
                placeholder="Filter users by username or email"
                className="pl-8"
                onChange={(event) => setUserQuery(event.target.value)}
              />
            </div>

            <div className="max-h-56 divide-y divide-border overflow-y-auto border border-border">
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
                      className="flex items-center justify-between gap-3 px-3 py-2 text-xs hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={checkboxId}
                          checked={checked}
                          onChange={() => toggleUser(user.id)}
                        />
                        <Label
                          htmlFor={checkboxId}
                          className="cursor-pointer font-medium"
                        >
                          {user.username}
                        </Label>
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
          </PanelBody>
        </Panel>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button asChild type="button" size="sm" variant="outline">
            <Link href="/vcon/mailboxes">Cancel</Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || !databaseConfigured || domains.length === 0}
            onClick={() => void submitCreation(true)}
          >
            <Icon glyph={Copy} />
            <span>Create &amp; copy</span>
          </Button>
          <Button
            type="submit"
            size="sm"
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
            <div className="flex items-center justify-between gap-2 border border-border bg-muted/40 px-3 py-2 font-mono text-xs">
              <span className="truncate">{createdEmail}</span>
              <CopyButton
                value={createdEmail}
                label={`Copy ${createdEmail}`}
                successMessage="Email address copied."
                errorMessage="Clipboard copy is unavailable."
                className="border border-border bg-card px-2 py-1 hover:bg-accent hover:text-accent-foreground"
              >
                <span>Copy</span>
              </CopyButton>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              size="sm"
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
