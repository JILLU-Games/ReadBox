import { signOutAction } from "@/app/sign-in/actions";
import { SignInForm } from "@/components/auth/sign-in-form";
import { env } from "@/config/env";
import { getCurrentUser } from "@/core/auth/current-user";
import { DEV_DEMO_ACCOUNTS } from "@/core/auth/dev-demo-auth";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  referrer: "same-origin",
};

export default async function SignInPage() {
  const devBypassActive =
    env.nodeEnv === "development" && env.devAuthMode === "bypass";
  const devDemoActive =
    env.nodeEnv === "development" && env.devAuthMode === "demo";
  const authActive = env.authEnabled || devDemoActive;
  const currentUser = authActive ? await getCurrentUser() : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md min-w-0 flex-col justify-center px-4 py-10 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Use your local ReadBox account.
      </p>
      {devBypassActive ? (
        <div className="mt-8 space-y-4 rounded-md border border-border bg-card p-4">
          <p className="text-sm font-medium">
            Development auth bypass is active ({env.devAuthRole}).
          </p>
          <p className="text-sm text-muted-foreground">
            Protected workspace routes are open locally without signing in.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              href="/users"
            >
              Open user panel
            </Link>
            <Link
              className="inline-flex min-h-10 items-center rounded-md border border-border px-4 text-sm font-medium"
              href="/vcon"
            >
              Open admin panel
            </Link>
          </div>
        </div>
      ) : currentUser ? (
        <div className="mt-8 space-y-4">
          <p className="text-sm">Signed in as {currentUser.username}.</p>
          <form action={signOutAction}>
            <button
              className="min-h-11 rounded-md border border-border px-4 text-sm font-medium"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <>
          <SignInForm
            enabled={authActive}
            demoAccounts={
              devDemoActive
                ? DEV_DEMO_ACCOUNTS.map((account) => ({
                    username: account.username,
                    password: account.password,
                    roleLabel: account.isAdministrator ? "Admin" : "User",
                  }))
                : undefined
            }
          />
        </>
      )}
      <Link className="mt-6 text-sm underline" href="/reset-password">
        Set a new password with an operator-issued reset token
      </Link>
    </main>
  );
}
