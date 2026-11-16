import { PasswordResetForm } from "@/components/auth/password-reset-form";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  BrandLogo,
  PageTitle,
  Panel,
  PanelBody,
  PanelHeader,
} from "@/components/ui";
import { getSiteSettings } from "@/core/settings/service";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const siteName = settings.siteName || "ReadBox";
  return {
    title: {
      absolute: `Reset password | ${siteName}`,
    },
    referrer: "no-referrer",
  };
}

export default async function ResetPasswordPage() {
  const settings = await getSiteSettings();
  const siteName = settings.siteName || "ReadBox";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md min-w-0 flex-col justify-center gap-3 px-4 py-8">
      <div className="flex items-center justify-between gap-2">
        <Link href="/" className="inline-flex min-w-0 items-center">
          <BrandLogo siteName={siteName} logoUrl={settings.logoUrl} size="sm" />
        </Link>
        <ThemeToggle />
      </div>

      <Panel>
        <PanelHeader>
          <PageTitle>Set a new password</PageTitle>
        </PanelHeader>
        <PanelBody className="p-4">
          <PasswordResetForm />
        </PanelBody>
      </Panel>

      <div className="text-xs">
        <Link
          className="text-muted-foreground underline hover:text-foreground"
          href="/sign-in"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
