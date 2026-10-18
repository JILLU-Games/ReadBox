import { signOutAction } from "@/app/sign-in/actions";
import { SignInForm } from "@/components/auth/sign-in-form";
import { env } from "@/config/env";
import { getCurrentUser } from "@/core/auth/current-user";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign in",
  referrer: "no-referrer",
};

export default async function SignInPage() {
  const currentUser = env.authEnabled ? await getCurrentUser() : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Use your local ReadBox account.
      </p>
      {currentUser ? (
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
        <SignInForm enabled={env.authEnabled} />
      )}
      <Link className="mt-6 text-sm underline" href="/reset-password">
        Set a new password with an operator-issued reset token
      </Link>
    </main>
  );
}
