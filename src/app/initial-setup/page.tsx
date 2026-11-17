import { FirstAdminForm } from "@/components/setup/first-admin-form";
import { getPrismaClient } from "@/core/database/client";
import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Initial administrator setup | ReadBox",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function InitialSetupPage() {
  let available = false;
  try {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.DOCKER_RUNTIME === "true" &&
      process.env.AUTH_ENABLED !== "false" &&
      process.env.READBOX_SETUP_TOKEN_SHA256 &&
      process.env.READBOX_SETUP_TOKEN_EXPIRES_AT &&
      Number(process.env.READBOX_SETUP_TOKEN_EXPIRES_AT) * 1000 > Date.now()
    ) {
      const prisma = getPrismaClient();
      const [existing, legacy] = await Promise.all([
        prisma.adminAccount.count(),
        prisma.administratorProfile.count({ where: { isSuperuser: true } }),
      ]);
      available = existing === 0 && legacy === 0;
    }
  } catch {
    available = false;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-10">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        ReadBox / Secure initial setup
      </div>
      {available ? (
        <FirstAdminForm />
      ) : (
        <div role="status" className="rounded-lg border bg-card p-5 text-sm">
          <h1 className="mb-2 text-lg font-semibold">Initial setup unavailable</h1>
          <p className="text-muted-foreground">
            Setup is already completed, the one-time code expired, or the
            database is unavailable. For recovery, use the existing local
            administrator operator command.
          </p>
          <Link href="/vcon/login" className="mt-3 inline-block underline">
            Go to admin sign in
          </Link>
        </div>
      )}
    </main>
  );
}
