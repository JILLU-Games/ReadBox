"use client";

import { isSuccessfulCredentialsSignIn } from "@/core/auth/sign-in-result";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function SignInForm({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || pending) return;

    const form = event.currentTarget;
    const values = new FormData(form);
    const username = values.get("username");
    const password = values.get("password");
    if (typeof username !== "string" || typeof password !== "string") {
      setError("Sign-in failed. Check your credentials and try again.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });
      if (isSuccessfulCredentialsSignIn(result)) {
        form.reset();
        router.replace("/users");
        router.refresh();
      } else {
        setError("Sign-in failed. Check your credentials and try again.");
      }
    } catch {
      setError("Sign-in is unavailable. Try again later.");
    } finally {
      setPending(false);
    }
  }

  if (!enabled) {
    return (
      <p className="mt-6 rounded-md border border-border p-4 text-sm" role="status">
        Authentication is disabled in this local environment.
      </p>
    );
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={submit}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="username">Username</label>
        <input
          autoComplete="username"
          className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
          id="username"
          maxLength={150}
          name="username"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="password">Password</label>
        <input
          autoComplete="current-password"
          className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
          id="password"
          maxLength={1024}
          name="password"
          required
          type="password"
        />
      </div>
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      <button
        className="min-h-11 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
