import { signOutAction } from "@/app/sign-in/actions";
import { registerUserSignupAction } from "@/app/sign-up/actions";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  Badge,
  Button,
  Icon,
  PageTitle,
  Panel,
  PanelBody,
  PanelHeader,
} from "@/components/ui";
import { env } from "@/config/env";
import { getUserControlSettings } from "@/core/accounts/user-control-policy";
import { getCurrentUser } from "@/core/auth/current-user";
import { getPrismaClient } from "@/core/database/client";
import { getSiteSettings } from "@/core/settings/service";
import { Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "User sign up",
  referrer: "same-origin",
};

export default async function SignUpPage() {
  const devDemoActive =
    env.nodeEnv === "development" && env.devAuthMode === "demo";
  const authActive = env.authEnabled || devDemoActive;
  const prisma = env.databaseUrl ? getPrismaClient() : null;
  const [currentUser, settings, userControl] = await Promise.all([
    authActive ? getCurrentUser() : Promise.resolve(null),
    getSiteSettings(),
    getUserControlSettings(prisma),
  ]);
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
          <div className="flex items-center gap-2">
            <PageTitle>Create user account</PageTitle>
            <Badge variant="outline">
              {userControl.verificationMode === "admin_approval"
                ? "Approval required"
                : userControl.verificationMode === "invite_code"
                  ? "Invite code"
                  : "Instant"}
            </Badge>
          </div>
          <span className="text-[11px] text-muted-foreground">{siteName}</span>
        </PanelHeader>
        <PanelBody className="space-y-3 p-4">
          {currentUser ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Signed in as{" "}
                <span className="font-medium text-foreground">
                  {currentUser.username}
                </span>
                .
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild size="sm">
                  <Link href={currentUser.isAdministrator ? "/vcon" : "/users"}>
                    {currentUser.isAdministrator
                      ? "Open admin panel"
                      : "Open user panel"}
                  </Link>
                </Button>
                <form action={signOutAction}>
                  <Button type="submit" size="sm" variant="outline">
                    Sign out
                  </Button>
                </form>
              </div>
            </div>
          ) : (
            <SignUpForm
              settings={userControl}
              onRegister={registerUserSignupAction}
            />
          )}
        </PanelBody>
      </Panel>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <Link
          className="font-medium text-foreground underline hover:text-primary"
          href="/sign-in"
        >
          Already have an account? Sign in
        </Link>
        <Link
          className="text-muted-foreground underline hover:text-foreground"
          href="/vcon/login"
        >
          Admin login
        </Link>
      </div>
    </main>
  );
}
