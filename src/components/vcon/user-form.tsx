"use client";

import type {
  CreateUserActionInput,
  UpdateUserActionInput,
} from "@/app/(workspace)/vcon/users/actions";
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
import {
  generateRandomUsername,
  generateSecurePassword,
} from "@/core/accounts/credentials-generator";
import type {
  AssignableMailboxOption,
  ManagedUserEditRecord,
  ManagedUserResult,
} from "@/core/accounts/users";
import { MIN_PASSWORD_LENGTH } from "@/core/auth/password-policy";
import { Check, Copy, Eye, EyeOff, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

export interface UserFormProps {
  readonly mode: "create" | "edit";
  readonly mailboxes: readonly AssignableMailboxOption[];
  readonly databaseConfigured?: boolean;
  readonly initialUser?: ManagedUserEditRecord;
  readonly onCreate?: (
    input: CreateUserActionInput,
  ) => Promise<ManagedUserResult<{ id: string; username: string }>>;
  readonly onUpdate?: (
    userId: string,
    input: UpdateUserActionInput,
  ) => Promise<ManagedUserResult<{ id: string; username: string }>>;
}

export function UserForm({
  mode,
  mailboxes,
  databaseConfigured = true,
  initialUser,
  onCreate,
  onUpdate,
}: UserFormProps) {
  const router = useRouter();
  const isCreate = mode === "create";

  const [username, setUsername] = useState(initialUser?.username ?? "");
  const [firstName, setFirstName] = useState(initialUser?.firstName ?? "");
  const [lastName, setLastName] = useState(initialUser?.lastName ?? "");
  const [email, setEmail] = useState(initialUser?.email ?? "");
  const [isActive, setIsActive] = useState(initialUser?.isActive ?? true);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [canDeleteMessages, setCanDeleteMessages] = useState(
    initialUser?.canDeleteMessages ?? false,
  );
  const [canDeleteMailboxes, setCanDeleteMailboxes] = useState(
    initialUser?.canDeleteMailboxes ?? false,
  );
  const [selectedMailboxIds, setSelectedMailboxIds] = useState<string[]>(
    () => [...(initialUser?.assignedMailboxIds ?? [])],
  );
  const [mailboxQuery, setMailboxQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [createdCredentials, setCreatedCredentials] = useState<{
    readonly username: string;
    readonly password: string;
  } | null>(null);
  const [copiedInModal, setCopiedInModal] = useState(false);

  const filteredMailboxes = useMemo(() => {
    const query = mailboxQuery.trim().toLowerCase();
    if (!query) return mailboxes;
    return mailboxes.filter((mailbox) =>
      mailbox.emailAddress.toLowerCase().includes(query),
    );
  }, [mailboxes, mailboxQuery]);

  function toggleMailbox(id: string) {
    setSelectedMailboxIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function handleGenerateUsername() {
    setUsername(generateRandomUsername({ firstName, lastName }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.username;
      return next;
    });
  }

  function handleGeneratePassword() {
    const generated = generateSecurePassword(16);
    setPassword(generated);
    setPasswordConfirmation(generated);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.password;
      delete next.passwordConfirmation;
      return next;
    });
  }

  async function copyCredentialsText(user: string, secret: string) {
    const text = `Username: ${user}\nPassword: ${secret}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedInModal(true);
        toast.success("Copied login credentials to clipboard.");
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async function submitForm(copyAfterCreate: boolean) {
    if (pending) return;
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    try {
      if (isCreate) {
        if (!onCreate) {
          setFormError("User creation handler is unavailable.");
          return;
        }

        const result = await onCreate({
          username,
          firstName,
          lastName,
          email,
          isActive,
          password,
          passwordConfirmation,
          canDeleteMessages,
          canDeleteMailboxes,
          assignedMailboxIds: selectedMailboxIds,
        });

        if (!result.ok) {
          setFormError(result.error);
          setFieldErrors(result.fieldErrors ?? {});
          return;
        }

        if (copyAfterCreate) {
          await copyCredentialsText(result.data.username, password);
          setCreatedCredentials({
            username: result.data.username,
            password,
          });
          setPassword("");
          setPasswordConfirmation("");
          return;
        }

        toast.success(`User ${result.data.username} created.`);
        router.push("/vcon/users");
        router.refresh();
        return;
      }

      if (!initialUser || !onUpdate) {
        setFormError("User update handler is unavailable.");
        return;
      }

      const result = await onUpdate(initialUser.id, {
        username,
        firstName,
        lastName,
        email,
        isActive,
        canDeleteMessages,
        canDeleteMailboxes,
        assignedMailboxIds: selectedMailboxIds,
      });

      if (!result.ok) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      toast.success(`User ${result.data.username} updated.`);
      router.push("/vcon/users");
      router.refresh();
    } catch {
      setFormError("Request failed. Verify connectivity and try again.");
    } finally {
      setPending(false);
    }
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitForm(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          User management
        </p>
        <h1 className="text-xl font-semibold">
          {isCreate ? "Add user" : `Edit ${initialUser?.username ?? "user"}`}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isCreate
            ? "Create a team user with custom delete permissions and assigned mailboxes."
            : "Update user profile details, account status, permissions, and mailbox assignments."}
        </p>
      </header>

      {!databaseConfigured ? (
        <section
          className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"
          role="status"
        >
          Database is not configured in this local environment. Form controls can
          be previewed, and saving will activate once DATABASE_URL is configured.
        </section>
      ) : null}

      <form
        className="space-y-6 rounded-lg border border-border bg-card p-5"
        noValidate
        onSubmit={handleFormSubmit}
      >
        {formError ? (
          <div
            className="rounded-md border border-destructive/40 bg-destructive-bg px-3 py-2 text-sm text-destructive-muted"
            role="alert"
          >
            {formError}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="managed-username"
              className="text-sm font-medium text-foreground"
            >
              Username
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-foreground">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                className="size-4 rounded border-input accent-primary"
              />
              <span>Active</span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="managed-username"
              name="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. alex.morgan"
              spellCheck={false}
              autoComplete="off"
              maxLength={150}
              aria-invalid={Boolean(fieldErrors.username)}
            />
            {isCreate ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateUsername}
                title="Generate random username"
                aria-label="Generate random username"
              >
                <Icon glyph={RefreshCw} />
                <span>Generate</span>
              </Button>
            ) : null}
          </div>
          {fieldErrors.username ? (
            <p className="text-xs text-destructive" role="alert">
              {fieldErrors.username}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            id="managed-first-name"
            label="First name"
            error={fieldErrors.firstName}
          >
            <Input
              id="managed-first-name"
              name="firstName"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              maxLength={150}
              autoComplete="off"
            />
          </FormField>
          <FormField
            id="managed-last-name"
            label="Last name"
            error={fieldErrors.lastName}
          >
            <Input
              id="managed-last-name"
              name="lastName"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              maxLength={150}
              autoComplete="off"
            />
          </FormField>
          <FormField
            id="managed-email"
            label="Recovery / contact email"
            error={fieldErrors.email}
          >
            <Input
              id="managed-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              placeholder="optional@example.com"
              autoComplete="off"
            />
          </FormField>
        </div>

        {isCreate ? (
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="managed-password"
                  className="text-sm font-medium text-foreground"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Auto-generate
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="managed-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Minimum 15 characters"
                  maxLength={128}
                  aria-invalid={Boolean(fieldErrors.password)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  <Icon glyph={showPassword ? EyeOff : Eye} />
                </Button>
              </div>
              {fieldErrors.password ? (
                <p className="text-xs text-destructive" role="alert">
                  {fieldErrors.password}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Requires at least {MIN_PASSWORD_LENGTH} characters.
                </p>
              )}
            </div>

            <FormField
              id="managed-password-confirmation"
              label="Password confirmation"
              error={fieldErrors.passwordConfirmation}
            >
              <Input
                id="managed-password-confirmation"
                name="passwordConfirmation"
                type={showPassword ? "text" : "password"}
                value={passwordConfirmation}
                onChange={(event) =>
                  setPasswordConfirmation(event.target.value)
                }
                autoComplete="new-password"
                placeholder="Repeat password"
                maxLength={128}
                aria-invalid={Boolean(fieldErrors.passwordConfirmation)}
              />
            </FormField>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">
              Assigned mailboxes
            </span>
            <Badge variant="outline">
              {selectedMailboxIds.length} selected
            </Badge>
          </div>
          <div className="rounded-md border border-border bg-background/60 p-3">
            <div className="relative">
              <Icon
                glyph={Search}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={mailboxQuery}
                onChange={(event) => setMailboxQuery(event.target.value)}
                placeholder="Search mailboxes to assign..."
                aria-label="Search mailboxes"
                className="pl-9"
              />
            </div>
            <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {filteredMailboxes.length > 0 ? (
                filteredMailboxes.map((mailbox) => {
                  const checked = selectedMailboxIds.includes(mailbox.id);
                  return (
                    <label
                      key={mailbox.id}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-1.5 text-sm hover:border-border hover:bg-card"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMailbox(mailbox.id)}
                          className="size-4 rounded border-input accent-primary"
                        />
                        <span className="truncate font-medium text-foreground">
                          {mailbox.emailAddress}
                        </span>
                      </span>
                      <Badge
                        variant={
                          mailbox.status === "active" ? "success" : "warning"
                        }
                      >
                        {mailbox.status === "active" ? "Active" : "Disabled"}
                      </Badge>
                    </label>
                  );
                })
              ) : (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {mailboxes.length === 0
                    ? "No mailboxes available yet."
                    : "No mailboxes match your search."}
                </p>
              )}
            </div>
          </div>
          {fieldErrors.assignedMailboxIds ? (
            <p className="text-xs text-destructive" role="alert">
              {fieldErrors.assignedMailboxIds}
            </p>
          ) : null}
        </div>

        <fieldset className="space-y-3 rounded-md border border-border p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Permissions
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-2.5 rounded-md border border-border bg-background/60 p-3 text-sm">
              <input
                id="perm-delete-messages"
                type="checkbox"
                checked={canDeleteMessages}
                onChange={(event) =>
                  setCanDeleteMessages(event.target.checked)
                }
                className="mt-0.5 size-4 rounded border-input accent-primary"
              />
              <label
                htmlFor="perm-delete-messages"
                className="min-w-0 cursor-pointer"
              >
                <span className="block font-medium text-foreground">
                  Can delete messages
                </span>
                <span className="block text-xs text-muted-foreground">
                  Allow soft-deleting messages inside assigned mailboxes.
                </span>
              </label>
            </div>
            <div className="flex items-start gap-2.5 rounded-md border border-border bg-background/60 p-3 text-sm">
              <input
                id="perm-delete-mailboxes"
                type="checkbox"
                checked={canDeleteMailboxes}
                onChange={(event) =>
                  setCanDeleteMailboxes(event.target.checked)
                }
                className="mt-0.5 size-4 rounded border-input accent-primary"
              />
              <label
                htmlFor="perm-delete-mailboxes"
                className="min-w-0 cursor-pointer"
              >
                <span className="block font-medium text-foreground">
                  Can delete mailboxes
                </span>
                <span className="block text-xs text-muted-foreground">
                  Allow deleting assigned mailboxes from user panel.
                </span>
              </label>
            </div>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="submit" disabled={pending}>
            {pending
              ? isCreate
                ? "Creating..."
                : "Saving..."
              : isCreate
                ? "Create user"
                : "Save changes"}
          </Button>
          {isCreate ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => void submitForm(true)}
            >
              <Icon glyph={Copy} />
              <span>Create &amp; copy</span>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/vcon/users">Cancel</Link>
          </Button>
        </div>
      </form>

      <Dialog
        open={createdCredentials !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreatedCredentials(null);
            router.push("/vcon/users");
            router.refresh();
          }
        }}
      >
        <DialogContent>
          <DialogTitle>User created</DialogTitle>
          <DialogDescription>
            Save these sign-in credentials now. The password is shown once and
            never stored in plaintext.
          </DialogDescription>
          {createdCredentials ? (
            <div className="space-y-3 rounded-md border border-border bg-muted/60 p-3 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Username
                </p>
                <p className="mt-0.5 font-mono font-semibold text-foreground">
                  {createdCredentials.username}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Password
                </p>
                <p className="mt-0.5 break-all font-mono font-semibold text-foreground">
                  {createdCredentials.password}
                </p>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            {createdCredentials ? (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void copyCredentialsText(
                    createdCredentials.username,
                    createdCredentials.password,
                  )
                }
              >
                <Icon glyph={copiedInModal ? Check : Copy} />
                <span>
                  {copiedInModal ? "Copied credentials" : "Copy credentials"}
                </span>
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={() => {
                setCreatedCredentials(null);
                router.push("/vcon/users");
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
