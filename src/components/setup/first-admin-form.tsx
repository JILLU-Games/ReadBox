"use client";

import {
  createFirstAdminAction,
  type InitialSetupActionState,
} from "@/app/initial-setup/actions";
import {
  completePasswordResetAction,
  type PasswordResetState,
} from "@/app/reset-password/actions";
import { AlertBanner, Button, FormField, Input, Panel, PanelBody, PanelHeader, PageTitle } from "@/components/ui";
import Link from "next/link";
import { useActionState, type FormEvent } from "react";

const initial: InitialSetupActionState = { status: "idle" };
const initialReset: PasswordResetState = { status: "idle" };

function FinishAdminPassword({ token }: { readonly token: string }) {
  const [state, action, pending] = useActionState(completePasswordResetAction, initialReset);
  function validateConfirmation(event: FormEvent<HTMLFormElement>) {
    const fields = new FormData(event.currentTarget);
    if (fields.get("password") !== fields.get("confirmation")) {
      event.preventDefault();
    }
  }
  if (state.status === "success") {
    return (
      <div role="status" className="space-y-3">
        <AlertBanner variant="success">Administrator password activated.</AlertBanner>
        <Link className="text-sm font-medium underline" href="/vcon/login">
          Continue to administrator login
        </Link>
      </div>
    );
  }
  return (
    <form action={action} onSubmit={validateConfirmation} className="space-y-3" autoComplete="off">
      <p className="text-sm text-muted-foreground">
        Administrator created. Complete the existing one-time password reset
        to activate login. Keep this browser tab open until finished.
      </p>
      <input type="hidden" name="token" value={token} readOnly />
      <FormField id="initial-password" label="New administrator password">
        <Input id="initial-password" type="password" name="password"
          autoComplete="new-password" minLength={15} maxLength={128} required />
      </FormField>
      <FormField id="initial-confirmation" label="Confirm new password">
        <Input id="initial-confirmation" type="password" name="confirmation"
          autoComplete="new-password" minLength={15} maxLength={128} required />
      </FormField>
      {state.status === "invalid" ? (
        <AlertBanner variant="error">
          {state.error ?? "Password activation failed. Use the operator recovery procedure."}
        </AlertBanner>
      ) : null}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Activating password..." : "Activate administrator"}
      </Button>
    </form>
  );
}

export function FirstAdminForm() {
  const [state, action, pending] = useActionState(createFirstAdminAction, initial);
  return (
    <Panel>
      <PanelHeader>
        <PageTitle>Set up administrator</PageTitle>
        <p className="text-xs text-muted-foreground">
          Only the VPS owner with the one-time installer code can activate the
          first administrator. Requires a trusted HTTPS connection.
        </p>
      </PanelHeader>
      <PanelBody className="space-y-3 p-4">
        {state.status === "created" ? (
          <FinishAdminPassword token={state.resetToken} />
        ) : (
          <form action={action} className="space-y-3" autoComplete="off">
            <FormField id="first-admin-code" label="One-time VPS setup code">
              <Input id="first-admin-code" type="password" name="activationToken"
                autoComplete="off" minLength={43} maxLength={43} required />
            </FormField>
            <FormField id="first-admin-username" label="Admin username">
              <Input id="first-admin-username" name="username"
                minLength={3} maxLength={64} autoComplete="off" required />
            </FormField>
            <FormField id="first-admin-email" label="Admin email">
              <Input id="first-admin-email" name="email" type="email"
                maxLength={254} autoComplete="off" required />
            </FormField>
            <FormField id="first-admin-first" label="First name (optional)">
              <Input id="first-admin-first" name="firstName" maxLength={150} />
            </FormField>
            <FormField id="first-admin-last" label="Last name (optional)">
              <Input id="first-admin-last" name="lastName" maxLength={150} />
            </FormField>
            {state.status === "invalid" ? (
              <AlertBanner variant="error">{state.message}</AlertBanner>
            ) : null}
            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? "Creating administrator..." : "Continue securely"}
            </Button>
          </form>
        )}
      </PanelBody>
    </Panel>
  );
}
