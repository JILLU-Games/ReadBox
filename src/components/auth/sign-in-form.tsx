"use client";

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
}: {
  enabled: boolean;
  demoAccounts?: readonly DemoAccountHint[];
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
        redirect: false,
      });

      if (!isSuccessfulCredentialsSignIn(result)) {
        if (result?.error === "MissingCSRF") {
          setCookieBlocked(true);
        }
        setError(getCredentialsSignInErrorMessage(result));
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
        sessionData.user.isAdministrator ? "/vcon" : "/users",
      );
    } catch {
      setError("Sign-in is unavailable. Try again later.");
    } finally {
      setPending(false);
    }
  }

  if (!enabled) {
    return (
      <p
        className="mt-6 rounded-md border border-border p-4 text-sm"
        role="status"
      >
        Authentication is disabled in this local environment.
      </p>
    );
  }

  return (
    <>
      <form className="mt-8 space-y-5" method="post" onSubmit={submit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="username">
            Username
          </label>
          <input
            autoComplete="username"
            className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
            id="username"
            maxLength={150}
            name="username"
            onChange={(event) => setUsername(event.target.value)}
            required
            value={username}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            autoComplete="current-password"
            className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
            id="password"
            maxLength={1024}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </div>
        {error ? (
          <div
            className="rounded-md border border-destructive/40 bg-destructive-bg px-3 py-2 text-sm text-destructive-muted"
            role="alert"
          >
            <p>{error}</p>
            {cookieBlocked ? (
              <p className="mt-1">
                <a
                  className="font-medium underline"
                  href="/sign-in"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Open sign-in in a new tab
                </a>
              </p>
            ) : null}
          </div>
        ) : null}
        <button
          className="min-h-11 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
      {demoAccounts?.length ? (
        <div className="mt-6 rounded-md border border-border bg-card p-4 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">
            Development demo accounts
          </p>
          <ul className="mt-2 space-y-2">
            {demoAccounts.map((account) => (
              <li
                key={account.username}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  <span className="font-medium text-foreground">
                    {account.username}
                  </span>{" "}
                  / <code className="break-all">{account.password}</code> (
                  {account.roleLabel})
                </span>
                <button
                  type="button"
                  onClick={() => fillDemoAccount(account)}
                  className="rounded border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Fill {account.roleLabel}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
