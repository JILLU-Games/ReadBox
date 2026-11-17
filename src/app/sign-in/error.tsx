"use client";

import { RouteErrorPanel } from "@/components/layout/route-error-panel";

export default function SignInError({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <RouteErrorPanel
      title="Sign-in view temporarily unavailable"
      description="An unexpected error prevented loading user sign in. Retry or return to the home page."
      backHref="/"
      backLabel="Back to home"
      onReset={reset}
    />
  );
}
