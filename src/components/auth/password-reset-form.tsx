"use client";

import {
  completePasswordResetAction,
  type PasswordResetState,
} from "@/app/reset-password/actions";
import { AlertBanner, Button, Input, Label } from "@/components/ui";
import { passwordConfirmationMatches } from "@/core/auth/password-policy";
import { useActionState, useState, type FormEvent } from "react";

const initialState: PasswordResetState = { status: "idle" };

export function PasswordResetForm() {
  const [state, action, pending] = useActionState(
    completePasswordResetAction,
    initialState,
  );
  const [passwordMismatch, setPasswordMismatch] = useState(false);

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
    <form
      action={action}
      className="space-y-3"
      onInput={(event) => updatePasswordMismatch(event.currentTarget)}
      onSubmit={validatePasswordConfirmation}
    >
      <div className="space-y-1">
        <Label htmlFor="reset-token">Reset token</Label>
        <Input
          autoComplete="off"
          id="reset-token"
          maxLength={43}
          name="token"
          required
          spellCheck={false}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="new-password">New password</Label>
        <Input
          autoComplete="new-password"
          id="new-password"
          maxLength={128}
          minLength={15}
          name="password"
          required
          type="password"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          autoComplete="new-password"
          id="confirm-password"
          aria-describedby={passwordMismatch ? "password-mismatch" : undefined}
          aria-invalid={passwordMismatch}
          maxLength={128}
          minLength={15}
          name="confirmation"
          required
          type="password"
        />
      </div>
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
          Reset could not be completed. Check the token and password
          requirements.
        </AlertBanner>
      ) : null}
      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Updating password..." : "Set new password"}
      </Button>
    </form>
  );
}
