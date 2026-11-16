"use client";

import {
  AlertBanner,
  Button,
  FormField,
  Input,
  Panel,
  PanelBody,
} from "@/components/ui";
import {
  getCredentialsSignInErrorMessage,
  isSuccessfulCredentialsSignIn,
} from "@/core/auth/sign-in-result";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";

export interface DemoAccountHint {
  readonly username: string;
  readonly password: string;
  readonly roleLabel: string;
}

export function SignInForm({
  enabled,
  demoAccounts,
  loginScope = "user",
}: {
  enabled: boolean;
  demoAccounts?: readonly DemoAccountHint[];
  loginScope?: "admin" | "user";
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cookieBlocked, setCookieBlocked] = useState(false);

  function fillDemoAccount(account: DemoAccountHint) {
    setUsername(account.username);
    setPassword(account.password);
    setError(null);
    setCookieBlocked(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || pending) return;

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setError("Enter both username and password.");
      return;
    }

    setPending(true);
    setError(null);
    setCookieBlocked(false);

    try {
      const result = await signIn("credentials", {
        username: trimmedUsername,
        password,
        loginScope,
        redirect: false,
      });

      if (!isSuccessfulCredentialsSignIn(result)) {
        if (result?.error === "MissingCSRF") {
          setCookieBlocked(true);
        }
        setError(
          getCredentialsSignInErrorMessage(result) ??
            (loginScope === "admin"
              ? "Invalid administrator credentials."
              : "Invalid user credentials."),
        );
        return;
      }

      const sessionResponse = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const sessionData = sessionResponse.ok
        ? ((await sessionResponse.json()) as {
            user?: { id?: string; isAdministrator?: boolean };
          } | null)
        : null;

      if (!sessionData?.user) {
        setCookieBlocked(true);
        setError(
          "Sign-in succeeded on the server, but your browser blocked the session cookie in this embedded frame. Allow cookies for this site or open sign-in in a new tab.",
        );
        return;
      }

      setUsername("");
      setPassword("");
      window.location.assign(
        loginScope === "admin" || sessionData.user.isAdministrator
          ? "/vcon"
          : "/users",
      );
    } catch {
      setError("Sign-in is unavailable. Try again later.");
    } finally {
      setPending(false);
    }
  }

  if (!enabled) {
    return (
      <AlertBanner variant="warning" role="status">
        Authentication is disabled in this local environment.
      </AlertBanner>
    );
  }

  const fallbackTabHref = loginScope === "admin" ? "/vcon/login" : "/sign-in";

  return (
    <div className="space-y-3">
      <form className="space-y-3" method="post" onSubmit={submit}>
        <FormField id="username" label="Username">
          <Input
            autoComplete="username"
            id="username"
            maxLength={150}
            name="username"
            onChange={(event) => setUsername(event.target.value)}
            required
            value={username}
          />
        </FormField>
        <FormField id="password" label="Password">
          <Input
            autoComplete="current-password"
            id="password"
            maxLength={1024}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </FormField>
        {error ? (
          <AlertBanner variant="error">
            <p>{error}</p>
            {cookieBlocked ? (
              <p className="mt-1">
                <a
                  className="font-medium underline"
                  href={fallbackTabHref}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Open sign-in in a new tab
                </a>
              </p>
            ) : null}
          </AlertBanner>
        ) : null}
        <Button className="w-full" disabled={pending} type="submit">
          {pending
            ? "Signing in..."
            : loginScope === "admin"
              ? "Admin sign in"
              : "Sign in"}
        </Button>
      </form>
      {demoAccounts?.length ? (
        <Panel>
          <PanelBody className="space-y-2 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">
              Development demo accounts
            </p>
            <ul className="space-y-2">
              {demoAccounts.map((account) => (
                <li
                  key={account.username}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="font-medium text-foreground">
                      {account.username}
                    </span>{" "}
                    /{" "}
                    <code className="break-all font-mono">
                      {account.password}
                    </code>{" "}
                    ({account.roleLabel})
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fillDemoAccount(account)}
                  >
                    Fill {account.roleLabel}
                  </Button>
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  );
}
