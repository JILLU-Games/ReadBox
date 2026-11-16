import { signOutAction } from "@/app/sign-in/actions";
import { SignInForm } from "@/components/auth/sign-in-form";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  AlertBanner,
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
import { DEV_DEMO_ACCOUNTS } from "@/core/auth/dev-demo-auth";
import { getPrismaClient } from "@/core/database/client";
import { getSiteSettings } from "@/core/settings/service";
import { Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const siteName = settings.siteName || "ReadBox";
  return {
    title: {
      absolute: `User sign in | ${siteName}`,
    },
    referrer: "same-origin",
  };
}

export default async function SignInPage() {
  const devBypassActive =
    env.nodeEnv === "development" && env.devAuthMode === "bypass";
  const devDemoActive =
    env.nodeEnv === "development" && env.devAuthMode === "demo";
  const authActive = env.authEnabled || devDemoActive;
  const prisma = env.databaseUrl ? getPrismaClient() : null;
  const [currentUser, settings, userControl] = await Promise.all([
    authActive ? getCurrentUser() : Promise.resolve(null),
    getSiteSettings(),
    getUserControlSettings(prisma),
  ]);
  const siteName = settings.siteName || "ReadBox";

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
          <PageTitle>User sign in</PageTitle>
        </PanelHeader>
        <PanelBody className="space-y-3 p-4">
          {devBypassActive ? (
            <div className="space-y-3">
              <AlertBanner
                variant="info"
                role="status"
                title="Local workspace preview is active."
              >
                You can open the user workspace directly without signing in.
              </AlertBanner>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href="/users">Open workspace</Link>
                </Button>
              </div>
            </div>
          ) : currentUser ? (
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
                  <Link href="/users">Open workspace</Link>
                </Button>
                <form action={signOutAction}>
                  <Button type="submit" size="sm" variant="outline">
                    Sign out
                  </Button>
                </form>
              </div>
            </div>
          ) : (
            <SignInForm
              enabled={authActive}
              loginScope="user"
              demoAccounts={
                devDemoActive
                  ? DEV_DEMO_ACCOUNTS.filter(
                      (account) => !account.isAdministrator,
                    ).map((account) => ({
                      username: account.username,
                      password: account.password,
                      roleLabel: "User",
                    }))
                  : undefined
              }
            />
          )}
        </PanelBody>
      </Panel>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {userControl.signupEnabled ? (
          <Link
            className="font-medium text-foreground underline hover:text-primary"
            href="/sign-up"
          >
            Create user account
          </Link>
        ) : null}
        <Link
          className="text-muted-foreground underline hover:text-foreground"
          href="/reset-password"
        >
          Reset password
        </Link>
      </div>
    </main>
  );
}
