"use client";

import {
  completePasswordResetAction,
  type PasswordResetRequestState,
  type PasswordResetState,
} from "@/app/reset-password/actions";
import {
  AlertBanner,
  Button,
  FormField,
  Input,
  Panel,
  PanelBody,
  SectionTitle,
} from "@/components/ui";
import { passwordConfirmationMatches } from "@/core/auth/password-policy";
import { useActionState, useState, type FormEvent } from "react";

const initialRequestState: PasswordResetRequestState = { status: "idle" };
const initialResetState: PasswordResetState = { status: "idle" };

async function defaultRequestPasswordResetAction(
  previousState: PasswordResetRequestState,
): Promise<PasswordResetRequestState> {
  return previousState;
}

export interface PasswordResetFormProps {
  readonly minPasswordLength?: number;
  readonly requireStrongPassword?: boolean;
  readonly requestResetAction?: (
    previousState: PasswordResetRequestState,
    formData: FormData,
  ) => Promise<PasswordResetRequestState>;
}

export function PasswordResetForm({
  minPasswordLength = 15,
  requireStrongPassword = true,
  requestResetAction = defaultRequestPasswordResetAction,
}: PasswordResetFormProps = {}) {
  const [requestState, requestAction, requestPending] = useActionState(
    requestResetAction,
    initialRequestState,
  );
  const [state, action, pending] = useActionState(
    completePasswordResetAction,
    initialResetState,
  );
  const [tokenValue, setTokenValue] = useState("");
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  const effectiveMinLength = Math.max(8, minPasswordLength);

  function updatePasswordMismatch(form: HTMLFormElement) {
    const formData = new FormData(form);
    const password = formData.get("password");
    const confirmation = formData.get("confirmation");
    setPasswordMismatch(
      typeof confirmation === "string" &&
        confirmation.length > 0 &&
        !passwordConfirmationMatches(password, confirmation),
    );
  }

  function validatePasswordConfirmation(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const matches = passwordConfirmationMatches(
      formData.get("password"),
      formData.get("confirmation"),
    );
    setPasswordMismatch(!matches);
    if (!matches) event.preventDefault();
  }

  return (
    <div className="space-y-4">
      <Panel>
        <PanelBody className="space-y-2.5 p-3">
          <SectionTitle>Request reset token</SectionTitle>
          <form action={requestAction} className="space-y-2.5">
            <FormField id="reset-identifier" label="Username or email">
              <Input
                autoComplete="username"
                id="reset-identifier"
                maxLength={254}
                name="identifier"
                placeholder="username or email@domain"
                required
              />
            </FormField>
            {requestState.status === "invalid" && requestState.error ? (
              <AlertBanner variant="error">{requestState.error}</AlertBanner>
            ) : null}
            {requestState.status === "issued" && requestState.token ? (
              <AlertBanner variant="success">
                <div className="space-y-1.5">
                  <p>
                    Reset token issued
                    {requestState.username ? ` for ${requestState.username}` : ""}:
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <code className="break-all font-mono text-xs text-foreground">
                      {requestState.token}
                    </code>
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => setTokenValue(requestState.token ?? "")}
                    >
                      Use token
                    </Button>
                  </div>
                </div>
              </AlertBanner>
            ) : null}
            <Button
              className="w-full"
              disabled={requestPending}
              size="sm"
              type="submit"
              variant="outline"
            >
              {requestPending ? "Issuing token..." : "Generate reset token"}
            </Button>
          </form>
        </PanelBody>
      </Panel>

      <form
        action={action}
        className="space-y-3"
        onInput={(event) => updatePasswordMismatch(event.currentTarget)}
        onSubmit={validatePasswordConfirmation}
      >
        <FormField
          id="reset-token"
          label="Reset token"
          error={state.fieldErrors?.token}
        >
          <Input
            autoComplete="off"
            id="reset-token"
            maxLength={43}
            name="token"
            onChange={(event) => setTokenValue(event.target.value)}
            required
            spellCheck={false}
            value={tokenValue}
          />
        </FormField>
        <FormField
          id="new-password"
          label="New password"
          error={state.fieldErrors?.password}
        >
          <Input
            autoComplete="new-password"
            id="new-password"
            maxLength={128}
            minLength={effectiveMinLength}
            name="password"
            required
            title={`Minimum ${effectiveMinLength} characters${requireStrongPassword ? " with uppercase, lowercase, number, and symbol" : ""}`}
            type="password"
          />
        </FormField>
        <FormField
          id="confirm-password"
          label="Confirm new password"
          error={state.fieldErrors?.confirmation}
        >
          <Input
            autoComplete="new-password"
            id="confirm-password"
            aria-describedby={passwordMismatch ? "password-mismatch" : undefined}
            aria-invalid={passwordMismatch}
            maxLength={128}
            minLength={effectiveMinLength}
            name="confirmation"
            required
            type="password"
          />
        </FormField>
        {passwordMismatch ? (
          <AlertBanner id="password-mismatch" variant="error">
            Passwords do not match.
          </AlertBanner>
        ) : null}
        {state.status === "success" ? (
          <AlertBanner variant="success">
            Password reset complete. You can sign in now.
          </AlertBanner>
        ) : null}
        {state.status === "invalid" ? (
          <AlertBanner variant="error">
            {state.error ??
              "Reset could not be completed. Check the token and password requirements."}
          </AlertBanner>
        ) : null}
        <Button className="w-full" disabled={pending} type="submit">
          {pending ? "Updating password..." : "Set new password"}
        </Button>
      </form>
    </div>
  );
}
