"use client";

import {
    completePasswordResetAction,
    type PasswordResetState,
} from "@/app/reset-password/actions";
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
      className="mt-8 space-y-5"
      onInput={(event) => updatePasswordMismatch(event.currentTarget)}
      onSubmit={validatePasswordConfirmation}
    >
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="reset-token">Reset token</label>
        <input
          autoComplete="off"
          className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
          id="reset-token"
          maxLength={43}
          name="token"
          required
          spellCheck={false}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="new-password">New password</label>
        <input
          autoComplete="new-password"
          className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
          id="new-password"
          maxLength={128}
          minLength={15}
          name="password"
          required
          type="password"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="confirm-password">Confirm new password</label>
        <input
          autoComplete="new-password"
          className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
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
        <p className="text-sm text-destructive" id="password-mismatch" role="alert">
          Passwords do not match.
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-sm" role="status">Password reset complete. You can sign in now.</p>
      ) : null}
      {state.status === "invalid" ? (
        <p className="text-sm text-destructive" role="alert">
          Reset could not be completed. Check the token and password requirements.
        </p>
      ) : null}
      <button
        className="min-h-11 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Updating password..." : "Set new password"}
      </button>
    </form>
  );
}
