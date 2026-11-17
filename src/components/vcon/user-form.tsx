"use client";

import type {
  CreateUserActionInput,
  UpdateUserActionInput,
} from "@/app/(workspace)/vcon/users/actions";
import {
  AlertBanner,
  Badge,
  Button,
  Checkbox,
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
  PageHeader,
  Panel,
  PanelBody,
  SectionTitle,
} from "@/components/ui";
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
        notify.success("Copied login credentials to clipboard.");
        return true;
      }
      notify.error("Clipboard copy is unavailable.");
      return false;
    } catch {
      notify.error("Clipboard copy is unavailable.");
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
          const msg = "User creation handler is unavailable.";
          setFormError(msg);
          notify.error(msg);
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
          notify.error(result.error);
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

        notify.success(`User ${result.data.username} created.`);
        router.push("/vcon/users");
        router.refresh();
        return;
      }

      if (!initialUser || !onUpdate) {
        const msg = "User update handler is unavailable.";
        setFormError(msg);
        notify.error(msg);
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
        notify.error(result.error);
        return;
      }

      notify.success(`User ${result.data.username} updated.`);
      router.push("/vcon/users");
      router.refresh();
    } catch {
      const msg = "Request failed. Verify connectivity and try again.";
      setFormError(msg);
      notify.error(msg);
    } finally {
      setPending(false);
    }
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitForm(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={isCreate ? "Add user" : `Edit ${initialUser?.username ?? "user"}`}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/vcon/users">Back to users</Link>
          </Button>
        }
      />

      {!databaseConfigured ? (
        <AlertBanner variant="warning" role="status">
          Database is not configured in this local environment. Form controls can
          be previewed, and saving will activate once DATABASE_URL is configured.
        </AlertBanner>
      ) : null}

      <Panel>
        <PanelBody className="p-4">
          <form
            className="space-y-4"
            noValidate
            onSubmit={handleFormSubmit}
          >
            {formError ? (
              <AlertBanner variant="error">{formError}</AlertBanner>
            ) : null}

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="managed-username">Username</Label>
                <Label
                  htmlFor="managed-user-active"
                  className="inline-flex cursor-pointer items-center gap-2 font-normal"
                >
                  <Checkbox
                    id="managed-user-active"
                    checked={isActive}
                    onChange={(event) => setIsActive(event.target.checked)}
                  />
                  <span>Active</span>
                </Label>
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
                  aria-describedby={
                    fieldErrors.username ? "managed-username-error" : undefined
                  }
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
                <p
                  id="managed-username-error"
                  className="text-xs text-destructive"
                  role="alert"
                >
                  {fieldErrors.username}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField
                id="managed-first-name"
                label="First name"
                error={fieldErrors.firstName}
              >
                <Input
                  id="managed-first-name"
                  name="firstName"
                  value={firstName}
                  aria-invalid={Boolean(fieldErrors.firstName)}
                  aria-describedby={
                    fieldErrors.firstName
                      ? "managed-first-name-error"
                      : undefined
                  }
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
                  aria-invalid={Boolean(fieldErrors.lastName)}
                  aria-describedby={
                    fieldErrors.lastName
                      ? "managed-last-name-error"
                      : undefined
                  }
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
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={
                    fieldErrors.email ? "managed-email-error" : undefined
                  }
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={254}
                  placeholder="optional@example.com"
                  autoComplete="off"
                />
              </FormField>
            </div>

            {isCreate ? (
              <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="managed-password">Password</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleGeneratePassword}
                      className="h-auto px-1.5 py-0.5 text-primary"
                    >
                      Auto-generate
                    </Button>
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
                      aria-describedby={
                        fieldErrors.password
                          ? "managed-password-error"
                          : "managed-password-hint"
                      }
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
                    <p
                      id="managed-password-error"
                      className="text-xs text-destructive"
                      role="alert"
                    >
                      {fieldErrors.password}
                    </p>
                  ) : (
                    <p
                      id="managed-password-hint"
                      className="text-xs text-muted-foreground"
                    >
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
                    aria-describedby={
                      fieldErrors.passwordConfirmation
                        ? "managed-password-confirmation-error"
                        : undefined
                    }
                  />
                </FormField>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <SectionTitle>Assigned mailboxes</SectionTitle>
                <Badge variant="outline">
                  {selectedMailboxIds.length} selected
                </Badge>
              </div>
              <div className="border border-border bg-background/60 p-3">
                <div className="relative">
                  <Icon
                    glyph={Search}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    type="search"
                    value={mailboxQuery}
                    onChange={(event) => setMailboxQuery(event.target.value)}
                    placeholder="Search mailboxes to assign..."
                    aria-label="Search mailboxes"
                    className="pl-8"
                  />
                </div>
                <div className="mt-2.5 max-h-56 space-y-1 overflow-y-auto pr-1">
                  {filteredMailboxes.length > 0 ? (
                    filteredMailboxes.map((mailbox) => {
                      const checked = selectedMailboxIds.includes(mailbox.id);
                      const checkboxId = `user-assign-mailbox-${mailbox.id}`;
                      return (
                        <Label
                          key={mailbox.id}
                          htmlFor={checkboxId}
                          className="flex cursor-pointer items-center justify-between gap-2 border border-transparent px-2.5 py-1.5 text-xs font-normal hover:border-border hover:bg-card"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Checkbox
                              id={checkboxId}
                              checked={checked}
                              onChange={() => toggleMailbox(mailbox.id)}
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
                        </Label>
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
                <p
                  id="user-assign-mailboxes-error"
                  className="text-xs text-destructive"
                  role="alert"
                >
                  {fieldErrors.assignedMailboxIds}
                </p>
              ) : null}
            </div>

            <fieldset className="space-y-2.5 border border-border p-3">
              <legend className="px-1 text-xs font-medium text-muted-foreground">
                Permissions
              </legend>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="flex items-start gap-2 border border-border bg-background/60 p-2.5 text-xs">
                  <Checkbox
                    id="perm-delete-messages"
                    checked={canDeleteMessages}
                    onChange={(event) =>
                      setCanDeleteMessages(event.target.checked)
                    }
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="perm-delete-messages"
                    className="min-w-0 cursor-pointer font-normal"
                  >
                    <span className="block font-medium text-foreground">
                      Can delete messages
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Allow soft-deleting messages inside assigned mailboxes.
                    </span>
                  </Label>
                </div>
                <div className="flex items-start gap-2 border border-border bg-background/60 p-2.5 text-xs">
                  <Checkbox
                    id="perm-delete-mailboxes"
                    checked={canDeleteMailboxes}
                    onChange={(event) =>
                      setCanDeleteMailboxes(event.target.checked)
                    }
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="perm-delete-mailboxes"
                    className="min-w-0 cursor-pointer font-normal"
                  >
                    <span className="block font-medium text-foreground">
                      Can delete mailboxes
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Allow deleting assigned mailboxes from user panel.
                    </span>
                  </Label>
                </div>
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button type="submit" size="sm" disabled={pending}>
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
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => void submitForm(true)}
                >
                  <Icon glyph={Copy} />
                  <span>Create &amp; copy</span>
                </Button>
              ) : null}
              <Button asChild size="sm" variant="outline">
                <Link href="/vcon/users">Cancel</Link>
              </Button>
            </div>
          </form>
        </PanelBody>
      </Panel>

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
            <div className="space-y-2.5 border border-border bg-muted/60 p-3 text-xs">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Username
                </p>
                <p className="mt-0.5 font-mono font-medium text-foreground">
                  {createdCredentials.username}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Password
                </p>
                <p className="mt-0.5 break-all font-mono font-medium text-foreground">
                  {createdCredentials.password}
                </p>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            {createdCredentials ? (
              <Button
                type="button"
                size="sm"
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
              size="sm"
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
