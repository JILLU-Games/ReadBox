"use client";

import {
  AlertBanner,
  Button,
  FormField,
  Input,
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
          title="Registration submitted for approval"
        >
          Account <span className="font-medium">{approvalPendingUser}</span> has
          been created and is awaiting approval. You will be able to sign in
          once your account is activated.
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
      <FormField
        id="signup-username"
        label="Username"
        error={fieldErrors.username}
      >
        <Input
          autoComplete="username"
          id="signup-username"
          maxLength={150}
          name="username"
          onChange={(event) => setUsername(event.target.value)}
          required
          aria-invalid={Boolean(fieldErrors.username)}
          aria-describedby={
            fieldErrors.username ? "signup-username-error" : undefined
          }
          value={username}
        />
      </FormField>

      {showFirstName || showLastName ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {showFirstName ? (
            <FormField
              id="signup-first-name"
              label={`First name${
                settings.firstNameRequirement === "optional" ? " (optional)" : ""
              }`}
              error={fieldErrors.firstName}
            >
              <Input
                autoComplete="given-name"
                id="signup-first-name"
                maxLength={150}
                name="firstName"
                onChange={(event) => setFirstName(event.target.value)}
                required={settings.firstNameRequirement === "required"}
                aria-invalid={Boolean(fieldErrors.firstName)}
                aria-describedby={
                  fieldErrors.firstName ? "signup-first-name-error" : undefined
                }
                value={firstName}
              />
            </FormField>
          ) : null}

          {showLastName ? (
            <FormField
              id="signup-last-name"
              label={`Last name${
                settings.lastNameRequirement === "optional" ? " (optional)" : ""
              }`}
              error={fieldErrors.lastName}
            >
              <Input
                autoComplete="family-name"
                id="signup-last-name"
                maxLength={150}
                name="lastName"
                onChange={(event) => setLastName(event.target.value)}
                required={settings.lastNameRequirement === "required"}
                aria-invalid={Boolean(fieldErrors.lastName)}
                aria-describedby={
                  fieldErrors.lastName ? "signup-last-name-error" : undefined
                }
                value={lastName}
              />
            </FormField>
          ) : null}
        </div>
      ) : null}

      {showEmail ? (
        <FormField
          id="signup-email"
          label={`Email address${
            settings.emailRequirement === "optional" ? " (optional)" : ""
          }`}
          error={fieldErrors.email}
        >
          <Input
            autoComplete="email"
            id="signup-email"
            maxLength={254}
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required={settings.emailRequirement === "required"}
            type="email"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={
              fieldErrors.email ? "signup-email-error" : undefined
            }
            value={email}
          />
        </FormField>
      ) : null}

      {showPhone ? (
        <FormField
          id="signup-phone"
          label={`Phone number${
            settings.phoneRequirement === "optional" ? " (optional)" : ""
          }`}
          error={fieldErrors.phone}
        >
          <Input
            autoComplete="tel"
            id="signup-phone"
            maxLength={40}
            name="phone"
            onChange={(event) => setPhone(event.target.value)}
            required={settings.phoneRequirement === "required"}
            type="tel"
            aria-invalid={Boolean(fieldErrors.phone)}
            aria-describedby={
              fieldErrors.phone ? "signup-phone-error" : undefined
            }
            value={phone}
          />
        </FormField>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <FormField
          id="signup-password"
          label={`Password (min ${settings.minPasswordLength})`}
          error={fieldErrors.password}
        >
          <Input
            autoComplete="new-password"
            id="signup-password"
            maxLength={1024}
            minLength={settings.minPasswordLength}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={
              fieldErrors.password ? "signup-password-error" : undefined
            }
            value={password}
          />
        </FormField>

        <FormField
          id="signup-password-confirm"
          label="Confirm password"
          error={fieldErrors.passwordConfirmation}
        >
          <Input
            autoComplete="new-password"
            id="signup-password-confirm"
            maxLength={1024}
            minLength={settings.minPasswordLength}
            name="passwordConfirmation"
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            required
            type="password"
            aria-invalid={Boolean(fieldErrors.passwordConfirmation)}
            aria-describedby={
              fieldErrors.passwordConfirmation
                ? "signup-password-confirm-error"
                : undefined
            }
            value={passwordConfirmation}
          />
        </FormField>
      </div>

      {showInviteCode ? (
        <FormField
          id="signup-invite-code"
          label="Invite code"
          error={fieldErrors.inviteCode}
        >
          <Input
            autoComplete="off"
            id="signup-invite-code"
            maxLength={120}
            name="inviteCode"
            onChange={(event) => setInviteCode(event.target.value)}
            required
            aria-invalid={Boolean(fieldErrors.inviteCode)}
            aria-describedby={
              fieldErrors.inviteCode ? "signup-invite-code-error" : undefined
            }
            value={inviteCode}
          />
        </FormField>
      ) : null}

      {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}

      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Creating account..." : "Create user account"}
      </Button>
    </form>
  );
}
