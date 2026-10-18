import { PasswordResetForm } from "@/components/auth/password-reset-form";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Reset password",
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold">Set a new password</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter the one-time token supplied by the local operator.
      </p>
      <PasswordResetForm />
      <Link className="mt-6 text-sm underline" href="/sign-in">
        Back to sign in
      </Link>
    </main>
  );
}
