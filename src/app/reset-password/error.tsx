"use client";

import { RouteErrorPanel } from "@/components/layout/route-error-panel";

export default function ResetPasswordError({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <RouteErrorPanel
      title="Password reset temporarily unavailable"
      description="An unexpected error prevented loading password reset. Retry or return to sign in."
      backHref="/sign-in"
      backLabel="Back to sign in"
      onReset={reset}
    />
  );
}
