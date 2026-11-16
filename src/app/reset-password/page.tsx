import { PasswordResetForm } from "@/components/auth/password-reset-form";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  Icon,
  PageTitle,
  Panel,
  PanelBody,
  PanelHeader,
} from "@/components/ui";
import { getSiteSettings } from "@/core/settings/service";
import { Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset password",
  referrer: "no-referrer",
};

export default async function ResetPasswordPage() {
  const settings = await getSiteSettings();
  const siteName = settings.siteName || "MailStack";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md min-w-0 flex-col justify-center gap-3 px-4 py-8">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/"
          className="inline-flex min-w-0 items-center gap-2 text-xs font-medium text-foreground hover:text-primary"
        >
          <span className="flex size-6 shrink-0 items-center justify-center bg-primary text-primary-foreground">
            <Icon glyph={Mail} className="size-3.5" />
          </span>
          <span className="truncate">{siteName}</span>
        </Link>
        <ThemeToggle />
      </div>

      <Panel>
        <PanelHeader>
          <PageTitle>Set a new password</PageTitle>
          <span className="text-[11px] text-muted-foreground">{siteName}</span>
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
