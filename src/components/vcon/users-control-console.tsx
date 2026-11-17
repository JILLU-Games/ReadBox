"use client";

import type { SaveUserControlSettingsActionResult } from "@/app/(workspace)/vcon/users/control/actions";
import {
  AlertBanner,
  Badge,
  Button,
  CaptionText,
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
  PanelHeader,
  SectionTitle,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import type {
  ControlDomainOption,
  ExtendedUserAccessPolicyShape,
  FieldRequirementMode,
  GovernedUserPolicyItem,
  PendingSignupUserItem,
  UserControlSettingsShape,
  UserVerificationMode,
} from "@/core/accounts/user-control-policy";
import {
  Check,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export interface UsersControlConsoleProps {
  readonly initialSettings: UserControlSettingsShape;
  readonly domains: readonly ControlDomainOption[];
  readonly pendingUsers: readonly PendingSignupUserItem[];
  readonly governedUsers: readonly GovernedUserPolicyItem[];
  readonly databaseConfigured?: boolean;
  readonly databaseConnected?: boolean;
  readonly databaseError?: string;
  readonly demoMode?: boolean;
  readonly onSaveSettings: (
    input: unknown,
  ) => Promise<SaveUserControlSettingsActionResult>;
  readonly onDecidePendingUser: (
    userId: string,
    decision: "verified" | "rejected",
  ) => Promise<{
    readonly ok: boolean;
    readonly message?: string;
    readonly error?: string;
  }>;
  readonly onSaveUserOverride: (
    userId: string,
    input: unknown,
  ) => Promise<{
    readonly ok: boolean;
    readonly policy?: ExtendedUserAccessPolicyShape;
    readonly message?: string;
    readonly error?: string;
  }>;
}

export function UsersControlConsole({
  initialSettings,
  domains,
  pendingUsers,
  governedUsers,
  databaseConfigured = true,
  databaseConnected = true,
  databaseError,
  demoMode = false,
  onSaveSettings,
  onDecidePendingUser,
  onSaveUserOverride,
}: UsersControlConsoleProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [signupEnabled, setSignupEnabled] = useState(
    initialSettings.signupEnabled,
  );
  const [firstNameRequirement, setFirstNameRequirement] =
    useState<FieldRequirementMode>(initialSettings.firstNameRequirement);
  const [lastNameRequirement, setLastNameRequirement] =
    useState<FieldRequirementMode>(initialSettings.lastNameRequirement);
  const [emailRequirement, setEmailRequirement] =
    useState<FieldRequirementMode>(initialSettings.emailRequirement);
  const [phoneRequirement, setPhoneRequirement] =
    useState<FieldRequirementMode>(initialSettings.phoneRequirement);

  const [minPasswordLength, setMinPasswordLength] = useState(
    String(initialSettings.minPasswordLength),
  );
  const [requireStrongPassword, setRequireStrongPassword] = useState(
    initialSettings.requireStrongPassword,
  );
  const [verificationMode, setVerificationMode] =
    useState<UserVerificationMode>(initialSettings.verificationMode);
  const [inviteCode, setInviteCode] = useState(initialSettings.inviteCode);

  const [allowedDomainUuids, setAllowedDomainUuids] = useState<string[]>([
    ...initialSettings.allowedDomainUuids,
  ]);
  const [defaultMaxMailboxes, setDefaultMaxMailboxes] = useState(
    String(initialSettings.defaultMaxMailboxes),
  );
  const [autoProvisionStarterMailbox, setAutoProvisionStarterMailbox] =
    useState(initialSettings.autoProvisionStarterMailbox);
  const [defaultCanCreateMailboxes, setDefaultCanCreateMailboxes] = useState(
    initialSettings.defaultCanCreateMailboxes,
  );
  const [defaultCanDeleteMessages, setDefaultCanDeleteMessages] = useState(
    initialSettings.defaultCanDeleteMessages,
  );
  const [defaultCanDeleteMailboxes, setDefaultCanDeleteMailboxes] = useState(
    initialSettings.defaultCanDeleteMailboxes,
  );

  const [autoDeleteEnabled, setAutoDeleteEnabled] = useState(
    initialSettings.autoDeleteEnabled,
  );
  const [autoDeleteDays, setAutoDeleteDays] = useState(
    String(initialSettings.autoDeleteDays),
  );

  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [editingUser, setEditingUser] = useState<GovernedUserPolicyItem | null>(
    null,
  );
  const [overrideCanCreate, setOverrideCanCreate] = useState(true);
  const [overrideCanDeleteMessages, setOverrideCanDeleteMessages] =
    useState(false);
  const [overrideCanDeleteMailboxes, setOverrideCanDeleteMailboxes] =
    useState(false);
  const [overrideMaxMailboxes, setOverrideMaxMailboxes] = useState("3");
  const [overrideDomainUuids, setOverrideDomainUuids] = useState<string[]>([]);
  const [overrideAutoDeleteEnabled, setOverrideAutoDeleteEnabled] =
    useState(false);
  const [overrideAutoDeleteDays, setOverrideAutoDeleteDays] = useState("30");

  function toggleGlobalDomain(uuid: string) {
    setAllowedDomainUuids((prev) =>
      prev.includes(uuid)
        ? prev.filter((item) => item !== uuid)
        : [...prev, uuid],
    );
  }

  function toggleOverrideDomain(uuid: string) {
    setOverrideDomainUuids((prev) =>
      prev.includes(uuid)
        ? prev.filter((item) => item !== uuid)
        : [...prev, uuid],
    );
  }

  function openUserOverrideModal(user: GovernedUserPolicyItem) {
    setEditingUser(user);
    setOverrideCanCreate(user.policy.canCreateMailboxes);
    setOverrideCanDeleteMessages(user.policy.canDeleteMessages);
    setOverrideCanDeleteMailboxes(user.policy.canDeleteMailboxes);
    setOverrideMaxMailboxes(String(user.policy.maxMailboxes));
    setOverrideDomainUuids([...user.policy.allowedDomainUuids]);
    setOverrideAutoDeleteEnabled(user.policy.autoDeleteEnabled);
    setOverrideAutoDeleteDays(
      String(
        user.policy.autoDeleteDays > 0
          ? user.policy.autoDeleteDays
          : Number(autoDeleteDays) || 30,
      ),
    );
  }

  function handleSaveGlobalSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorBanner(null);
    setSuccessBanner(null);
    setFieldErrors({});

    const payload = {
      signupEnabled,
      firstNameRequirement,
      lastNameRequirement,
      emailRequirement,
      phoneRequirement,
      minPasswordLength: Number.parseInt(minPasswordLength, 10) || 12,
      requireStrongPassword,
      verificationMode,
      inviteCode: inviteCode.trim(),
      allowedDomainUuids,
      defaultMaxMailboxes: Math.max(
        0,
        Number.parseInt(defaultMaxMailboxes, 10) || 0,
      ),
      autoProvisionStarterMailbox,
      defaultCanCreateMailboxes,
      defaultCanDeleteMessages,
      defaultCanDeleteMailboxes,
      autoDeleteEnabled,
      autoDeleteDays: Math.max(1, Number.parseInt(autoDeleteDays, 10) || 30),
    };

    startTransition(async () => {
      try {
        const result = await onSaveSettings(payload);
        if (!result.ok) {
          const msg = result.error ?? "Check the highlighted policy fields.";
          setErrorBanner(msg);
          setFieldErrors(result.fieldErrors ?? {});
          notify.error(msg);
          return;
        }
        const message = result.message ?? "Users control policy saved.";
        setSuccessBanner(message);
        notify.success(message);
        router.refresh();
      } catch {
        const msg = "Could not save users control settings.";
        setErrorBanner(msg);
        notify.error(msg);
      }
    });
  }

  function handlePendingDecision(
    userId: string,
    decision: "verified" | "rejected",
  ) {
    startTransition(async () => {
      try {
        const result = await onDecidePendingUser(userId, decision);
        if (!result.ok) {
          notify.error(result.error ?? "Failed to update registration status.");
          return;
        }
        notify.success(
          result.message ??
            (decision === "verified" ? "User approved." : "User rejected."),
        );
        router.refresh();
      } catch {
        notify.error("Failed to update registration status.");
      }
    });
  }

  function handleSaveOverride() {
    if (!editingUser) return;
    const targetUserId = editingUser.id;
    const payload = {
      canCreateMailboxes: overrideCanCreate,
      canDeleteMessages: overrideCanDeleteMessages,
      canDeleteMailboxes: overrideCanDeleteMailboxes,
      maxMailboxes: Math.max(
        0,
        Number.parseInt(overrideMaxMailboxes, 10) || 0,
      ),
      allowedDomainUuids: overrideDomainUuids,
      autoDeleteEnabled: overrideAutoDeleteEnabled,
      autoDeleteDays: overrideAutoDeleteEnabled
        ? Math.max(1, Number.parseInt(overrideAutoDeleteDays, 10) || 30)
        : 0,
    };

    startTransition(async () => {
      try {
        const result = await onSaveUserOverride(targetUserId, payload);
        if (!result.ok) {
          notify.error(result.error ?? "Failed to save user policy override.");
          return;
        }
        notify.success(
          result.message ??
            `Updated permissions for ${editingUser.username}.`,
        );
        setEditingUser(null);
        router.refresh();
      } catch {
        notify.error("Failed to save user policy override.");
      }
    });
  }

  const domainMap = new Map(domains.map((d) => [d.uuid, d.name]));

  return (
    <section className="space-y-3" aria-labelledby="users-control-page-title">
      <PageHeader
        id="users-control-page-title"
        title="Users control"
        icon={SlidersHorizontal}
        actions={
          <Button
            type="submit"
            form="users-control-settings-form"
            size="sm"
            disabled={isPending}
          >
            <Icon
              glyph={isPending ? RefreshCw : Check}
              className={isPending ? "animate-spin" : undefined}
            />
            <span>{isPending ? "Saving..." : "Save control policy"}</span>
          </Button>
        }
      />

      {!databaseConfigured && !demoMode ? (
        <AlertBanner
          variant="warning"
          title="Database not configured"
        >
          Users control settings, verified domain allowlists, and user policy
          overrides require PostgreSQL configuration.
        </AlertBanner>
      ) : !databaseConnected && !demoMode ? (
        <AlertBanner
          variant="error"
          title="Database temporarily unavailable"
        >
          {databaseError ??
            "Live domains and governed user policies could not be loaded from PostgreSQL. Verify connectivity and refresh."}
        </AlertBanner>
      ) : null}

      {errorBanner ? (
        <AlertBanner variant="error">{errorBanner}</AlertBanner>
      ) : null}

      {successBanner ? (
        <AlertBanner variant="success">{successBanner}</AlertBanner>
      ) : null}

      <form
        id="users-control-settings-form"
        onSubmit={handleSaveGlobalSettings}
        className="space-y-3"
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {/* Panel 1: Sign-Up & Registration Form Fields */}
          <Panel>
            <PanelHeader>
              <SectionTitle>Sign-up &amp; form fields</SectionTitle>
              <Badge variant={signupEnabled ? "success" : "warning"}>
                {signupEnabled ? "Sign-up open" : "Sign-up disabled"}
              </Badge>
            </PanelHeader>
            <PanelBody className="space-y-3">
              <div className="border border-border bg-background p-2.5">
                <Label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium">
                  <Checkbox
                    id="id_signup_enabled"
                    checked={signupEnabled}
                    onChange={(e) => setSignupEnabled(e.target.checked)}
                  />
                  <span>Enable public user sign-up (/sign-up)</span>
                </Label>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <FormField id="id_req_first_name" label="First name field">
                  <Select
                    id="id_req_first_name"
                    value={firstNameRequirement}
                    onChange={(e) =>
                      setFirstNameRequirement(
                        e.target.value as FieldRequirementMode,
                      )
                    }
                  >
                    <option value="required">Required</option>
                    <option value="optional">Optional</option>
                    <option value="none">Hidden</option>
                  </Select>
                </FormField>

                <FormField id="id_req_last_name" label="Last name field">
                  <Select
                    id="id_req_last_name"
                    value={lastNameRequirement}
                    onChange={(e) =>
                      setLastNameRequirement(
                        e.target.value as FieldRequirementMode,
                      )
                    }
                  >
                    <option value="required">Required</option>
                    <option value="optional">Optional</option>
                    <option value="none">Hidden</option>
                  </Select>
                </FormField>

                <FormField id="id_req_email" label="Email address field">
                  <Select
                    id="id_req_email"
                    value={emailRequirement}
                    onChange={(e) =>
                      setEmailRequirement(
                        e.target.value as FieldRequirementMode,
                      )
                    }
                  >
                    <option value="required">Required</option>
                    <option value="optional">Optional</option>
                    <option value="none">Hidden</option>
                  </Select>
                </FormField>

                <FormField id="id_req_phone" label="Phone number field">
                  <Select
                    id="id_req_phone"
                    value={phoneRequirement}
                    onChange={(e) =>
                      setPhoneRequirement(
                        e.target.value as FieldRequirementMode,
                      )
                    }
                  >
                    <option value="required">Required</option>
                    <option value="optional">Optional</option>
                    <option value="none">Hidden</option>
                  </Select>
                </FormField>
              </div>
            </PanelBody>
          </Panel>

          {/* Panel 2: Credentials & Verification */}
          <Panel>
            <PanelHeader>
              <SectionTitle>Credentials &amp; verification</SectionTitle>
              <Badge variant="default">{verificationMode}</Badge>
            </PanelHeader>
            <PanelBody className="space-y-3">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <FormField
                  id="id_min_password_len"
                  label="Minimum password length"
                  error={fieldErrors.minPasswordLength}
                >
                  <Input
                    id="id_min_password_len"
                    type="number"
                    min={8}
                    max={64}
                    value={minPasswordLength}
                    aria-invalid={Boolean(fieldErrors.minPasswordLength)}
                    aria-describedby={
                      fieldErrors.minPasswordLength
                        ? "id_min_password_len-error"
                        : undefined
                    }
                    onChange={(e) => setMinPasswordLength(e.target.value)}
                  />
                </FormField>

                <FormField
                  id="id_verification_mode"
                  label="Sign-up verification mode"
                  error={fieldErrors.verificationMode}
                >
                  <Select
                    id="id_verification_mode"
                    value={verificationMode}
                    aria-invalid={Boolean(fieldErrors.verificationMode)}
                    aria-describedby={
                      fieldErrors.verificationMode
                        ? "id_verification_mode-error"
                        : undefined
                    }
                    onChange={(e) =>
                      setVerificationMode(
                        e.target.value as UserVerificationMode,
                      )
                    }
                  >
                    <option value="instant">Instant activation</option>
                    <option value="invite_code">Invite code required</option>
                    <option value="admin_approval">
                      Admin approval required
                    </option>
                  </Select>
                </FormField>
              </div>

              <div className="border border-border bg-background p-2.5">
                <Label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium">
                  <Checkbox
                    id="id_require_strong_password"
                    checked={requireStrongPassword}
                    onChange={(e) => setRequireStrongPassword(e.target.checked)}
                  />
                  <span>
                    Require uppercase, lowercase, number, and symbol in password
                  </span>
                </Label>
              </div>

              <FormField
                id="id_invite_code"
                label="Registration invite code"
                error={fieldErrors.inviteCode}
              >
                <Input
                  id="id_invite_code"
                  type="text"
                  maxLength={120}
                  placeholder="Enter shared invite code (required when mode is invite_code)"
                  value={inviteCode}
                  aria-invalid={Boolean(fieldErrors.inviteCode)}
                  aria-describedby={
                    fieldErrors.inviteCode ? "id_invite_code-error" : undefined
                  }
                  onChange={(e) => setInviteCode(e.target.value)}
                />
              </FormField>
            </PanelBody>
          </Panel>

          {/* Panel 3: Domain Access & Mailbox Quota */}
          <Panel>
            <PanelHeader>
              <SectionTitle>Domain access &amp; mailbox quota</SectionTitle>
              <Badge variant="default">
                {allowedDomainUuids.length === 0
                  ? "All verified domains"
                  : `${allowedDomainUuids.length} selected`}
              </Badge>
            </PanelHeader>
            <PanelBody className="space-y-3">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    Allowed domains for new &amp; governed users
                  </span>
                  <CaptionText>
                    Leave all unchecked to allow all verified domains
                  </CaptionText>
                </div>
                <div className="grid gap-1.5 border border-border bg-background p-2.5 sm:grid-cols-2">
                  {domains.map((domain) => {
                    const checked = allowedDomainUuids.includes(domain.uuid);
                    return (
                      <Label
                        key={domain.uuid}
                        className="inline-flex cursor-pointer items-center justify-between gap-2 border border-border bg-card px-2 py-1.5 text-xs font-normal"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Checkbox
                            checked={checked}
                            onChange={() => toggleGlobalDomain(domain.uuid)}
                          />
                          <span className="truncate font-mono">
                            {domain.name}
                          </span>
                        </span>
                        {domain.isDefault ? (
                          <Badge variant="default">Default</Badge>
                        ) : null}
                      </Label>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <FormField
                  id="id_default_max_mailboxes"
                  label="Max mailboxes per user (0 = unlimited)"
                  error={fieldErrors.defaultMaxMailboxes}
                >
                  <Input
                    id="id_default_max_mailboxes"
                    type="number"
                    min={0}
                    max={500}
                    value={defaultMaxMailboxes}
                    aria-invalid={Boolean(fieldErrors.defaultMaxMailboxes)}
                    aria-describedby={
                      fieldErrors.defaultMaxMailboxes
                        ? "id_default_max_mailboxes-error"
                        : undefined
                    }
                    onChange={(e) => setDefaultMaxMailboxes(e.target.value)}
                  />
                </FormField>

                <div className="space-y-1.5 border border-border bg-background p-2.5">
                  <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal">
                    <Checkbox
                      id="id_default_can_create_mailboxes"
                      checked={defaultCanCreateMailboxes}
                      onChange={(e) =>
                        setDefaultCanCreateMailboxes(e.target.checked)
                      }
                    />
                    <span>Allow self-service mailbox creation</span>
                  </Label>
                  <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal">
                    <Checkbox
                      id="id_default_can_delete_messages"
                      checked={defaultCanDeleteMessages}
                      onChange={(e) =>
                        setDefaultCanDeleteMessages(e.target.checked)
                      }
                    />
                    <span>Allow message deletion by default</span>
                  </Label>
                  <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal">
                    <Checkbox
                      id="id_default_can_delete_mailboxes"
                      checked={defaultCanDeleteMailboxes}
                      onChange={(e) =>
                        setDefaultCanDeleteMailboxes(e.target.checked)
                      }
                    />
                    <span>Allow mailbox deletion by default</span>
                  </Label>
                  <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal">
                    <Checkbox
                      id="id_auto_starter_mailbox"
                      checked={autoProvisionStarterMailbox}
                      onChange={(e) =>
                        setAutoProvisionStarterMailbox(e.target.checked)
                      }
                    />
                    <span>Auto-create starter mailbox on sign-up</span>
                  </Label>
                </div>
              </div>
            </PanelBody>
          </Panel>

          {/* Panel 4: Email Auto-Delete Retention */}
          <Panel>
            <PanelHeader>
              <SectionTitle>Email auto-delete retention</SectionTitle>
              <Badge variant={autoDeleteEnabled ? "warning" : "default"}>
                {autoDeleteEnabled
                  ? `Auto-delete after ${autoDeleteDays}d`
                  : "Retain indefinitely"}
              </Badge>
            </PanelHeader>
            <PanelBody className="space-y-3">
              <div className="border border-border bg-background p-2.5">
                <Label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium">
                  <Checkbox
                    id="id_auto_delete_enabled"
                    checked={autoDeleteEnabled}
                    onChange={(e) => setAutoDeleteEnabled(e.target.checked)}
                  />
                  <span>
                    Automatically delete user emails older than retention window
                  </span>
                </Label>
              </div>

              <FormField
                id="id_auto_delete_days"
                label="Retention window (days)"
                error={fieldErrors.autoDeleteDays}
              >
                <Input
                  id="id_auto_delete_days"
                  type="number"
                  min={1}
                  max={3650}
                  disabled={!autoDeleteEnabled}
                  value={autoDeleteDays}
                  aria-invalid={Boolean(fieldErrors.autoDeleteDays)}
                  aria-describedby={
                    fieldErrors.autoDeleteDays
                      ? "id_auto_delete_days-error"
                      : undefined
                  }
                  onChange={(e) => setAutoDeleteDays(e.target.value)}
                />
              </FormField>

              <div className="border border-border bg-background p-2.5 text-xs text-muted-foreground">
                When enabled, messages older than the configured day limit are
                automatically hidden and purged from governed user inboxes.
              </div>
            </PanelBody>
          </Panel>
        </div>
      </form>

      {/* Pending Sign-Up Approvals Queue */}
      <Panel>
        <PanelHeader>
          <SectionTitle>Pending sign-up approvals</SectionTitle>
          <Badge variant={pendingUsers.length > 0 ? "warning" : "default"}>
            {pendingUsers.length} pending
          </Badge>
        </PanelHeader>
        <PanelBody className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingUsers.length > 0 ? (
                pendingUsers.map((pending) => (
                  <TableRow key={pending.id}>
                    <TableCell className="font-mono text-xs font-medium">
                      {pending.username}
                    </TableCell>
                    <TableCell className="text-xs">
                      {[pending.firstName, pending.lastName]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {pending.email || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {pending.phone || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          disabled={isPending}
                          onClick={() =>
                            handlePendingDecision(pending.id, "verified")
                          }
                        >
                          <Icon glyph={Check} />
                          <span>Approve</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={isPending}
                          onClick={() =>
                            handlePendingDecision(pending.id, "rejected")
                          }
                        >
                          <Icon glyph={X} />
                          <span>Reject</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-5 text-center text-xs text-muted-foreground"
                  >
                    No pending user registrations waiting for approval.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </PanelBody>
      </Panel>

      {/* Per-User Permission & Quota Overrides */}
      <Panel>
        <PanelHeader>
          <SectionTitle>Per-user permission &amp; quota control</SectionTitle>
          <Badge variant="default">{governedUsers.length} users</Badge>
        </PanelHeader>
        <PanelBody className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Domain access</TableHead>
                <TableHead>Mailbox limit</TableHead>
                <TableHead>Auto-delete</TableHead>
                <TableHead>Capabilities</TableHead>
                <TableHead className="text-right">Control</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {governedUsers.length > 0 ? (
                governedUsers.map((item) => {
                  const domainNames =
                    item.policy.allowedDomainUuids.length === 0
                      ? "All verified"
                      : item.policy.allowedDomainUuids
                          .map((id) => domainMap.get(id) ?? id.slice(0, 8))
                          .join(", ");
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-medium text-foreground">
                            {item.username}
                          </p>
                          <p className="truncate">
                            <CaptionText>
                              {item.email ||
                                [item.firstName, item.lastName]
                                  .filter(Boolean)
                                  .join(" ") ||
                                "Standard user"}
                            </CaptionText>
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.verificationStatus === "pending_approval"
                              ? "warning"
                              : item.isActive
                                ? "success"
                                : "warning"
                          }
                        >
                          {item.verificationStatus === "pending_approval"
                            ? "Pending"
                            : item.isActive
                              ? "Active"
                              : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {domainNames}
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">
                        {item.mailboxCount} /{" "}
                        {item.policy.maxMailboxes === 0
                          ? "∞"
                          : item.policy.maxMailboxes}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.policy.autoDeleteEnabled &&
                        item.policy.autoDeleteDays > 0
                          ? `${item.policy.autoDeleteDays} days`
                          : "Off"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {[
                          item.policy.canCreateMailboxes
                            ? "Create mbx"
                            : null,
                          item.policy.canDeleteMessages ? "Del msg" : null,
                          item.policy.canDeleteMailboxes ? "Del mbx" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Read-only"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openUserOverrideModal(item)}
                        >
                          <Icon glyph={ShieldCheck} />
                          <span>Configure policy</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-5 text-center text-xs text-muted-foreground"
                  >
                    No governed workspace users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </PanelBody>
      </Panel>

      {/* Per-user Policy Override Modal */}
      <Dialog
        open={editingUser !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setEditingUser(null);
        }}
      >
        <DialogContent>
          <DialogTitle>
            Configure policy for {editingUser?.username}
          </DialogTitle>
          <DialogDescription>
            Set domain access, mailbox creation limit, and email auto-delete
            retention for this user.
          </DialogDescription>

          <div className="mt-2 space-y-3">
            <FormField
              id="id_override_max_mbx"
              label="Max mailboxes (0 = unlimited)"
            >
              <Input
                id="id_override_max_mbx"
                type="number"
                min={0}
                max={500}
                value={overrideMaxMailboxes}
                onChange={(e) => setOverrideMaxMailboxes(e.target.value)}
              />
            </FormField>

            <div>
              <span className="mb-1 block text-xs font-medium text-foreground">
                Allowed domains (unchecked = all verified domains)
              </span>
              <div className="grid gap-1.5 border border-border bg-background p-2">
                {domains.map((domain) => (
                  <Label
                    key={domain.uuid}
                    className="inline-flex cursor-pointer items-center gap-2 text-xs font-normal"
                  >
                    <Checkbox
                      checked={overrideDomainUuids.includes(domain.uuid)}
                      onChange={() => toggleOverrideDomain(domain.uuid)}
                    />
                    <span className="font-mono">{domain.name}</span>
                  </Label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 border border-border bg-background p-2.5">
              <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal">
                <Checkbox
                  checked={overrideCanCreate}
                  onChange={(e) => setOverrideCanCreate(e.target.checked)}
                />
                <span>Allow creating new mailboxes</span>
              </Label>
              <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal">
                <Checkbox
                  checked={overrideCanDeleteMessages}
                  onChange={(e) =>
                    setOverrideCanDeleteMessages(e.target.checked)
                  }
                />
                <span>Allow deleting messages</span>
              </Label>
              <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal">
                <Checkbox
                  checked={overrideCanDeleteMailboxes}
                  onChange={(e) =>
                    setOverrideCanDeleteMailboxes(e.target.checked)
                  }
                />
                <span>Allow deleting mailboxes</span>
              </Label>
            </div>

            <div className="grid gap-2 border border-border bg-background p-2.5 sm:grid-cols-2">
              <Label className="inline-flex cursor-pointer items-center gap-2 text-xs font-normal">
                <Checkbox
                  checked={overrideAutoDeleteEnabled}
                  onChange={(e) =>
                    setOverrideAutoDeleteEnabled(e.target.checked)
                  }
                />
                <span>Auto-delete emails</span>
              </Label>
              <FormField id="id_override_retention_days" label="Retention days">
                <Input
                  id="id_override_retention_days"
                  type="number"
                  min={1}
                  max={3650}
                  disabled={!overrideAutoDeleteEnabled}
                  value={overrideAutoDeleteDays}
                  onChange={(e) => setOverrideAutoDeleteDays(e.target.value)}
                />
              </FormField>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => setEditingUser(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={handleSaveOverride}
            >
              {isPending ? "Saving..." : "Save user policy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
