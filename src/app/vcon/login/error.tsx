"use client";

import { RouteErrorPanel } from "@/components/layout/route-error-panel";

export default function AdminLoginError({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <RouteErrorPanel
      title="Admin sign-in temporarily unavailable"
      description="An unexpected error prevented loading administrator authentication. Retry or return to the home page."
      backHref="/"
      backLabel="Back to home"
      onReset={reset}
    />
  );
}
