"use client";

import type {
  UpdateUserPasswordActionInput,
  UpdateUserProfileActionInput,
} from "@/app/(workspace)/users/settings/actions";
import {
  AlertBanner,
  Badge,
  Button,
  CaptionText,
  Checkbox,
  FormField,
  Icon,
  IconButton,
  Input,
  Label,
  MonoText,
  notify,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  SectionTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { formatCompactTimestamp } from "@/components/users/user-workspace-helpers";
import {
  DEFAULT_USER_PASSWORD_POLICY,
  type UserProfileActionResult,
  type UserProfileRecord,
  type UserSecuritySnapshot,
} from "@/core/accounts/user-profile-schema";
import {
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

export interface UserSettingsViewProps {
  readonly profile: UserProfileRecord;
  readonly security?: UserSecuritySnapshot;
  readonly mailboxQuota: {
    readonly used: number;
    readonly max: number;
  };
  readonly databaseConfigured: boolean;
  readonly updateProfileAction: (
    input: UpdateUserProfileActionInput,
  ) => Promise<UserProfileActionResult<UserProfileRecord>>;
  readonly updatePasswordAction?: (
    input: UpdateUserPasswordActionInput,
  ) => Promise<
    UserProfileActionResult<{ readonly revokedOtherSessions: number }>
  >;
  readonly revokeSessionAction?: (
    sessionId: string,
  ) => Promise<UserProfileActionResult<{ readonly revoked: number }>>;
  readonly revokeOtherSessionsAction?: () => Promise<
    UserProfileActionResult<{ readonly revoked: number }>
  >;
}

const DEFAULT_SECURITY: UserSecuritySnapshot = {
  passwordPolicy: DEFAULT_USER_PASSWORD_POLICY,
  activeSessions: [],
  recentEvents: [],
  canManageSecurity: false,
};

export function UserSettingsView({
  profile,
  security = DEFAULT_SECURITY,
  mailboxQuota,
  databaseConfigured,
  updateProfileAction,
  updatePasswordAction,
  revokeSessionAction,
  revokeOtherSessionsAction,
}: UserSettingsViewProps) {
  const router = useRouter();
  const [savedProfile, setSavedProfile] = useState<UserProfileRecord>(profile);
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  // Password update state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<
    Record<string, string>
  >({});
  const [isPasswordPending, startPasswordTransition] = useTransition();

  // Session revocation state
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(
    null,
  );
  const [isSessionPending, startSessionTransition] = useTransition();

  const hasChanges =
    firstName.trim() !== savedProfile.firstName ||
    lastName.trim() !== savedProfile.lastName ||
    email.trim() !== savedProfile.email ||
    phone.trim() !== savedProfile.phone;

  const canSubmitPassword =
    security.canManageSecurity &&
    Boolean(updatePasswordAction) &&
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    confirmPassword.length > 0;

  const otherSessionsCount = security.activeSessions.filter(
    (session) => !session.isCurrent,
  ).length;

  function clearFieldError(field: string) {
    setFormError(null);
    setSaveSuccess(null);
    if (field in fieldErrors) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function clearPasswordFieldError(field: string) {
    setPasswordError(null);
    setPasswordSuccess(null);
    if (field in passwordFieldErrors) {
      setPasswordFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function handleReset() {
    setFirstName(savedProfile.firstName);
    setLastName(savedProfile.lastName);
    setEmail(savedProfile.email);
    setPhone(savedProfile.phone);
    setFormError(null);
    setSaveSuccess(null);
    setFieldErrors({});
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || !savedProfile.editable) return;

    setFormError(null);
    setSaveSuccess(null);
    setFieldErrors({});

    startTransition(async () => {
      try {
        const result = await updateProfileAction({
          firstName,
          lastName,
          email,
          phone,
        });

        if (!result.ok) {
          setFormError(result.error);
          setFieldErrors(result.fieldErrors ?? {});
          notify.error(result.error);
          return;
        }

        setSavedProfile(result.data);
        setFirstName(result.data.firstName);
        setLastName(result.data.lastName);
        setEmail(result.data.email);
        setPhone(result.data.phone);
        setSaveSuccess(result.message);
        notify.success(result.message);
        router.refresh();
      } catch {
        const message = "Could not save profile changes. Try again.";
        setFormError(message);
        notify.error(message);
      }
    });
  }

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPasswordPending || !updatePasswordAction || !security.canManageSecurity) {
      return;
    }

    setPasswordError(null);
    setPasswordSuccess(null);
    setPasswordFieldErrors({});

    startPasswordTransition(async () => {
      try {
        const result = await updatePasswordAction({
          currentPassword,
          newPassword,
          confirmPassword,
          revokeOtherSessions,
        });

        if (!result.ok) {
          setPasswordError(result.error);
          setPasswordFieldErrors(result.fieldErrors ?? {});
          notify.error(result.error);
          return;
        }

        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPasswordSuccess(result.message);
        notify.success(result.message);
        router.refresh();
      } catch {
        const message = "Could not update password. Try again.";
        setPasswordError(message);
        notify.error(message);
      }
    });
  }

  function handleRevokeSession(sessionId: string) {
    if (isSessionPending || !revokeSessionAction) return;
    setSessionError(null);
    setRevokingSessionId(sessionId);

    startSessionTransition(async () => {
      try {
        const result = await revokeSessionAction(sessionId);
        if (!result.ok) {
          setSessionError(result.error);
          notify.error(result.error);
          return;
        }
        notify.success(result.message);
        router.refresh();
      } catch {
        const message = "Could not revoke session. Try again.";
        setSessionError(message);
        notify.error(message);
      } finally {
        setRevokingSessionId(null);
      }
    });
  }

  function handleRevokeOtherSessions() {
    if (isSessionPending || !revokeOtherSessionsAction) return;
    setSessionError(null);

    startSessionTransition(async () => {
      try {
        const result = await revokeOtherSessionsAction();
        if (!result.ok) {
          setSessionError(result.error);
          notify.error(result.error);
          return;
        }
        notify.success(result.message);
        router.refresh();
      } catch {
        const message = "Could not sign out other sessions. Try again.";
        setSessionError(message);
        notify.error(message);
      }
    });
  }

  const quotaDisplay =
    mailboxQuota.max > 0
      ? `${mailboxQuota.used} / ${mailboxQuota.max}`
      : `${mailboxQuota.used} / Unlimited`;

  const passwordRuleHint = security.passwordPolicy.requireStrongPassword
    ? `Minimum ${security.passwordPolicy.minLength} characters with uppercase, lowercase, number, and symbol.`
    : `Minimum ${security.passwordPolicy.minLength} characters.`;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Settings"
        actions={
          <div className="flex items-center gap-2">
            {savedProfile.isAdministrator ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/vcon">Admin panel</Link>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="outline">
              <Link href="/users">Overview</Link>
            </Button>
          </div>
        }
      />

      {!databaseConfigured ? (
        <AlertBanner variant="warning" role="status">
          Database is not configured. Profile edits require DATABASE_URL or demo mode.
        </AlertBanner>
      ) : null}

      {!savedProfile.editable ? (
        <AlertBanner variant="info" role="status">
          This account profile is managed externally and cannot be modified here.
        </AlertBanner>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader>
            <SectionTitle>Profile details</SectionTitle>
          </PanelHeader>
          <PanelBody>
            <form
              className="space-y-3"
              noValidate
              onSubmit={handleSubmit}
            >
              {formError ? (
                <AlertBanner variant="error">{formError}</AlertBanner>
              ) : null}

              {saveSuccess ? (
                <AlertBanner variant="success">{saveSuccess}</AlertBanner>
              ) : null}

              <FormField id="profile-username" label="Username">
                <Input
                  id="profile-username"
                  name="username"
                  value={savedProfile.username}
                  readOnly
                  disabled
                  className="font-mono"
                />
              </FormField>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  id="profile-first-name"
                  label="First name"
                  error={fieldErrors.firstName}
                >
                  <Input
                    id="profile-first-name"
                    name="firstName"
                    value={firstName}
                    onChange={(event) => {
                      setFirstName(event.target.value);
                      clearFieldError("firstName");
                    }}
                    maxLength={150}
                    autoComplete="given-name"
                    disabled={isPending || !savedProfile.editable}
                    aria-invalid={Boolean(fieldErrors.firstName)}
                    aria-describedby={
                      fieldErrors.firstName
                        ? "profile-first-name-error"
                        : undefined
                    }
                  />
                </FormField>

                <FormField
                  id="profile-last-name"
                  label="Last name"
                  error={fieldErrors.lastName}
                >
                  <Input
                    id="profile-last-name"
                    name="lastName"
                    value={lastName}
                    onChange={(event) => {
                      setLastName(event.target.value);
                      clearFieldError("lastName");
                    }}
                    maxLength={150}
                    autoComplete="family-name"
                    disabled={isPending || !savedProfile.editable}
                    aria-invalid={Boolean(fieldErrors.lastName)}
                    aria-describedby={
                      fieldErrors.lastName
                        ? "profile-last-name-error"
                        : undefined
                    }
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  id="profile-email"
                  label="Email"
                  error={fieldErrors.email}
                >
                  <Input
                    id="profile-email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      clearFieldError("email");
                    }}
                    maxLength={254}
                    placeholder="name@example.com"
                    autoComplete="email"
                    disabled={isPending || !savedProfile.editable}
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={
                      fieldErrors.email ? "profile-email-error" : undefined
                    }
                  />
                </FormField>

                <FormField
                  id="profile-phone"
                  label="Phone"
                  error={fieldErrors.phone}
                >
                  <Input
                    id="profile-phone"
                    name="phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      clearFieldError("phone");
                    }}
                    maxLength={40}
                    placeholder="+1 555 010 9900"
                    autoComplete="tel"
                    disabled={isPending || !savedProfile.editable}
                    aria-invalid={Boolean(fieldErrors.phone)}
                    aria-describedby={
                      fieldErrors.phone ? "profile-phone-error" : undefined
                    }
                  />
                </FormField>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending || !hasChanges || !savedProfile.editable}
                >
                  <Icon glyph={Save} />
                  <span>{isPending ? "Saving..." : "Save changes"}</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending || !hasChanges || !savedProfile.editable}
                  onClick={handleReset}
                >
                  <Icon glyph={RotateCcw} />
                  <span>Reset</span>
                </Button>
              </div>
            </form>
          </PanelBody>
        </Panel>

        <Panel className="lg:col-span-1">
          <PanelHeader>
            <SectionTitle>Account summary</SectionTitle>
          </PanelHeader>
          <PanelBody className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
              <CaptionText>Username</CaptionText>
              <MonoText>{savedProfile.username}</MonoText>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
              <CaptionText>Role</CaptionText>
              <Badge variant="outline">
                {savedProfile.isAdministrator ? "Administrator" : "User"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
              <CaptionText>Mailboxes</CaptionText>
              <MonoText>{quotaDisplay}</MonoText>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
              <CaptionText>Active sessions</CaptionText>
              <MonoText>{security.activeSessions.length}</MonoText>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
              <CaptionText>Password policy</CaptionText>
              <MonoText>
                {security.passwordPolicy.minLength}+ chars
                {security.passwordPolicy.requireStrongPassword ? " · Strong" : ""}
              </MonoText>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
              <CaptionText>Joined</CaptionText>
              <CaptionText className="text-foreground">
                {savedProfile.dateJoined
                  ? formatCompactTimestamp(savedProfile.dateJoined)
                  : "Local demo"}
              </CaptionText>
            </div>
            <div className="flex items-center justify-between gap-2">
              <CaptionText>Last sign-in</CaptionText>
              <CaptionText className="text-foreground">
                {savedProfile.lastLogin
                  ? formatCompactTimestamp(savedProfile.lastLogin)
                  : "Current session"}
              </CaptionText>
            </div>
          </PanelBody>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <span className="flex items-center gap-2">
              <Icon glyph={KeyRound} className="text-muted-foreground" />
              <SectionTitle>Change password</SectionTitle>
            </span>
          </PanelHeader>
          <PanelBody>
            <form
              className="space-y-3"
              noValidate
              onSubmit={handlePasswordSubmit}
            >
              {passwordError ? (
                <AlertBanner variant="error">{passwordError}</AlertBanner>
              ) : null}

              {passwordSuccess ? (
                <AlertBanner variant="success">{passwordSuccess}</AlertBanner>
              ) : null}

              <FormField
                id="security-current-password"
                label="Current password"
                error={passwordFieldErrors.currentPassword}
              >
                <div className="flex items-center gap-1.5">
                  <Input
                    id="security-current-password"
                    name="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(event) => {
                      setCurrentPassword(event.target.value);
                      clearPasswordFieldError("currentPassword");
                    }}
                    autoComplete="current-password"
                    disabled={isPasswordPending || !security.canManageSecurity}
                    aria-invalid={Boolean(passwordFieldErrors.currentPassword)}
                    aria-describedby={
                      passwordFieldErrors.currentPassword
                        ? "security-current-password-error"
                        : undefined
                    }
                  />
                  <IconButton
                    type="button"
                    label={
                      showCurrentPassword
                        ? "Hide current password"
                        : "Show current password"
                    }
                    className="shrink-0 border border-border bg-card"
                    onClick={() => setShowCurrentPassword((v) => !v)}
                    disabled={isPasswordPending || !security.canManageSecurity}
                  >
                    <Icon glyph={showCurrentPassword ? EyeOff : Eye} />
                  </IconButton>
                </div>
              </FormField>

              <FormField
                id="security-new-password"
                label="New password"
                error={passwordFieldErrors.newPassword}
                hint={passwordRuleHint}
              >
                <div className="flex items-center gap-1.5">
                  <Input
                    id="security-new-password"
                    name="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value);
                      clearPasswordFieldError("newPassword");
                    }}
                    maxLength={128}
                    autoComplete="new-password"
                    disabled={isPasswordPending || !security.canManageSecurity}
                    aria-invalid={Boolean(passwordFieldErrors.newPassword)}
                    aria-describedby={
                      passwordFieldErrors.newPassword
                        ? "security-new-password-error"
                        : "security-new-password-hint"
                    }
                  />
                  <IconButton
                    type="button"
                    label={
                      showNewPassword
                        ? "Hide new password"
                        : "Show new password"
                    }
                    className="shrink-0 border border-border bg-card"
                    onClick={() => setShowNewPassword((v) => !v)}
                    disabled={isPasswordPending || !security.canManageSecurity}
                  >
                    <Icon glyph={showNewPassword ? EyeOff : Eye} />
                  </IconButton>
                </div>
              </FormField>

              <FormField
                id="security-confirm-password"
                label="Confirm new password"
                error={passwordFieldErrors.confirmPassword}
              >
                <Input
                  id="security-confirm-password"
                  name="confirmPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    clearPasswordFieldError("confirmPassword");
                  }}
                  maxLength={128}
                  autoComplete="new-password"
                  disabled={isPasswordPending || !security.canManageSecurity}
                  aria-invalid={Boolean(passwordFieldErrors.confirmPassword)}
                  aria-describedby={
                    passwordFieldErrors.confirmPassword
                      ? "security-confirm-password-error"
                      : undefined
                  }
                />
              </FormField>

              <Label
                htmlFor="security-revoke-other-sessions"
                className="inline-flex cursor-pointer items-center gap-2 text-xs font-normal text-foreground"
              >
                <Checkbox
                  id="security-revoke-other-sessions"
                  checked={revokeOtherSessions}
                  onChange={(event) =>
                    setRevokeOtherSessions(event.target.checked)
                  }
                  disabled={isPasswordPending || !security.canManageSecurity}
                />
                <span>Sign out other active sessions after updating</span>
              </Label>

              <div className="border-t border-border pt-3">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPasswordPending || !canSubmitPassword}
                >
                  <Icon glyph={KeyRound} />
                  <span>
                    {isPasswordPending ? "Updating..." : "Update password"}
                  </span>
                </Button>
              </div>
            </form>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <span className="flex items-center gap-2">
              <Icon glyph={ShieldCheck} className="text-muted-foreground" />
              <SectionTitle>Active sessions</SectionTitle>
              <Badge variant="outline">{security.activeSessions.length}</Badge>
            </span>
            {otherSessionsCount > 0 && revokeOtherSessionsAction ? (
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={isSessionPending || !security.canManageSecurity}
                onClick={handleRevokeOtherSessions}
              >
                <Icon glyph={LogOut} />
                <span>Sign out other sessions</span>
              </Button>
            ) : null}
          </PanelHeader>
          <PanelBody className="space-y-2.5">
            {sessionError ? (
              <AlertBanner variant="error">{sessionError}</AlertBanner>
            ) : null}

            {security.activeSessions.length === 0 ? (
              <CaptionText className="block py-2">
                No active registered sessions found.
              </CaptionText>
            ) : (
              <div className="divide-y divide-border border border-border">
                {security.activeSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">
                          {session.label}
                        </span>
                        {session.isCurrent ? (
                          <Badge variant="accent">Current</Badge>
                        ) : null}
                        {session.ipAddress ? (
                          <MonoText className="text-muted-foreground">
                            {session.ipAddress}
                          </MonoText>
                        ) : null}
                      </div>
                      <CaptionText className="block">
                        Started {formatCompactTimestamp(session.createdAt)} ·
                        Expires {formatCompactTimestamp(session.expiresAt)}
                      </CaptionText>
                    </div>

                    {!session.isCurrent && revokeSessionAction ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={isSessionPending}
                        onClick={() => handleRevokeSession(session.id)}
                      >
                        {revokingSessionId === session.id
                          ? "Revoking..."
                          : "Revoke"}
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <span className="flex items-center gap-2">
            <Icon glyph={ShieldCheck} className="text-muted-foreground" />
            <SectionTitle>Recent security activity</SectionTitle>
          </span>
        </PanelHeader>
        <PanelBody className="p-0">
          {security.recentEvents.length === 0 ? (
            <div className="p-3">
              <CaptionText>No recent security events recorded yet.</CaptionText>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>IP address</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {security.recentEvents.map((evt) => (
                  <TableRow key={evt.id}>
                    <TableCell>
                      <Badge
                        variant={
                          evt.outcome === "success"
                            ? "success"
                            : evt.outcome === "warning"
                              ? "warning"
                              : "outline"
                        }
                      >
                        {evt.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <MonoText>{evt.ipAddress ?? "—"}</MonoText>
                    </TableCell>
                    <TableCell className="text-right">
                      <CaptionText className="font-mono tabular-nums">
                        {formatCompactTimestamp(evt.createdAt)}
                      </CaptionText>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
