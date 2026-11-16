"use client";

import {
  AlertBanner,
  Button,
  Input,
  Label,
} from "@/components/ui";
import type { UserControlSettingsShape } from "@/core/accounts/user-control-policy";
import {
  getCredentialsSignInErrorMessage,
  isSuccessfulCredentialsSignIn,
} from "@/core/auth/sign-in-result";
import type {
  RegisterUserResult,
  SignUpFormInput,
} from "@/core/auth/sign-up";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

export function SignUpForm({
  settings,
  onRegister,
}: {
  settings: UserControlSettingsShape;
  onRegister: (input: SignUpFormInput) => Promise<RegisterUserResult>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [approvalPendingUser, setApprovalPendingUser] = useState<string | null>(
    null,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !settings.signupEnabled) return;

    setPending(true);
    setError(null);
    setFieldErrors({});

    try {
      const response = await onRegister({
        username,
        password,
        passwordConfirmation,
        firstName,
        lastName,
        email,
        phone,
        inviteCode,
      });

      if (!response.ok) {
        setError(response.error);
        setFieldErrors(response.fieldErrors ?? {});
        return;
      }

      if (response.requiresApproval) {
        setApprovalPendingUser(response.username);
        setPassword("");
        setPasswordConfirmation("");
        return;
      }

      const signInResult = await signIn("credentials", {
        username: response.username,
        password,
        loginScope: "user",
        redirect: false,
      });

      if (!isSuccessfulCredentialsSignIn(signInResult)) {
        setError(
          getCredentialsSignInErrorMessage(signInResult) ??
            "Account created. Please sign in on the User Sign-In page.",
        );
        return;
      }

      window.location.assign("/users");
    } catch {
      setError("Registration could not be completed. Try again later.");
    } finally {
      setPending(false);
    }
  }

  if (!settings.signupEnabled) {
    return (
      <AlertBanner variant="warning" role="status">
        New user registration is currently disabled by the administrator.
      </AlertBanner>
    );
  }

  if (approvalPendingUser) {
    return (
      <div className="space-y-3">
        <AlertBanner
          variant="success"
          role="status"
          title="Registration submitted for administrator approval"
        >
          Account <span className="font-medium">{approvalPendingUser}</span> has
          been created and is awaiting verification in Users Control. You will
          be able to sign in once approved.
        </AlertBanner>
        <Button asChild className="w-full" size="sm" variant="outline">
          <Link href="/sign-in">Return to user sign in</Link>
        </Button>
      </div>
    );
  }

  const showFirstName = settings.firstNameRequirement !== "none";
  const showLastName = settings.lastNameRequirement !== "none";
  const showEmail = settings.emailRequirement !== "none";
  const showPhone = settings.phoneRequirement !== "none";
  const showInviteCode = settings.verificationMode === "invite_code";

  return (
    <form className="space-y-3" method="post" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <Label htmlFor="signup-username">Username</Label>
        <Input
          autoComplete="username"
          id="signup-username"
          maxLength={150}
          name="username"
          onChange={(event) => setUsername(event.target.value)}
          required
          value={username}
        />
        {fieldErrors.username ? (
          <p className="text-[11px] text-destructive">{fieldErrors.username}</p>
        ) : null}
      </div>

      {showFirstName || showLastName ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {showFirstName ? (
            <div className="space-y-1">
              <Label htmlFor="signup-first-name">
                First name
                {settings.firstNameRequirement === "optional"
                  ? " (optional)"
                  : ""}
              </Label>
              <Input
                autoComplete="given-name"
                id="signup-first-name"
                maxLength={150}
                name="firstName"
                onChange={(event) => setFirstName(event.target.value)}
                required={settings.firstNameRequirement === "required"}
                value={firstName}
              />
              {fieldErrors.firstName ? (
                <p className="text-[11px] text-destructive">
                  {fieldErrors.firstName}
                </p>
              ) : null}
            </div>
          ) : null}

          {showLastName ? (
            <div className="space-y-1">
              <Label htmlFor="signup-last-name">
                Last name
                {settings.lastNameRequirement === "optional"
                  ? " (optional)"
                  : ""}
              </Label>
              <Input
                autoComplete="family-name"
                id="signup-last-name"
                maxLength={150}
                name="lastName"
                onChange={(event) => setLastName(event.target.value)}
                required={settings.lastNameRequirement === "required"}
                value={lastName}
              />
              {fieldErrors.lastName ? (
                <p className="text-[11px] text-destructive">
                  {fieldErrors.lastName}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {showEmail ? (
        <div className="space-y-1">
          <Label htmlFor="signup-email">
            Email address
            {settings.emailRequirement === "optional" ? " (optional)" : ""}
          </Label>
          <Input
            autoComplete="email"
            id="signup-email"
            maxLength={254}
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required={settings.emailRequirement === "required"}
            type="email"
            value={email}
          />
          {fieldErrors.email ? (
            <p className="text-[11px] text-destructive">{fieldErrors.email}</p>
          ) : null}
        </div>
      ) : null}

      {showPhone ? (
        <div className="space-y-1">
          <Label htmlFor="signup-phone">
            Phone number
            {settings.phoneRequirement === "optional" ? " (optional)" : ""}
          </Label>
          <Input
            autoComplete="tel"
            id="signup-phone"
            maxLength={40}
            name="phone"
            onChange={(event) => setPhone(event.target.value)}
            required={settings.phoneRequirement === "required"}
            type="tel"
            value={phone}
          />
          {fieldErrors.phone ? (
            <p className="text-[11px] text-destructive">{fieldErrors.phone}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="signup-password">
            Password (min {settings.minPasswordLength})
          </Label>
          <Input
            autoComplete="new-password"
            id="signup-password"
            maxLength={1024}
            minLength={settings.minPasswordLength}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          {fieldErrors.password ? (
            <p className="text-[11px] text-destructive">
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <Label htmlFor="signup-password-confirm">Confirm password</Label>
          <Input
            autoComplete="new-password"
            id="signup-password-confirm"
            maxLength={1024}
            minLength={settings.minPasswordLength}
            name="passwordConfirmation"
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            required
            type="password"
            value={passwordConfirmation}
          />
          {fieldErrors.passwordConfirmation ? (
            <p className="text-[11px] text-destructive">
              {fieldErrors.passwordConfirmation}
            </p>
          ) : null}
        </div>
      </div>

      {showInviteCode ? (
        <div className="space-y-1">
          <Label htmlFor="signup-invite-code">Invite code</Label>
          <Input
            autoComplete="off"
            id="signup-invite-code"
            maxLength={120}
            name="inviteCode"
            onChange={(event) => setInviteCode(event.target.value)}
            required
            value={inviteCode}
          />
          {fieldErrors.inviteCode ? (
            <p className="text-[11px] text-destructive">
              {fieldErrors.inviteCode}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}

      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Creating account..." : "Create user account"}
      </Button>
    </form>
  );
}
