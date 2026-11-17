"use client";

import { RouteErrorPanel } from "@/components/layout/route-error-panel";

export default function SignUpError({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <RouteErrorPanel
      title="Account registration temporarily unavailable"
      description="An unexpected error prevented loading the sign-up form. Retry or return to sign in."
      backHref="/sign-in"
      backLabel="Back to sign in"
      onReset={reset}
    />
  );
}
