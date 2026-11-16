import { signOutAction } from "@/app/sign-in/actions";
import { SignInForm } from "@/components/auth/sign-in-form";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  AlertBanner,
  Badge,
  Button,
  Icon,
  PageTitle,
  Panel,
  PanelBody,
  PanelHeader,
} from "@/components/ui";
import { env } from "@/config/env";
import { getCurrentUser } from "@/core/auth/current-user";
import { DEV_DEMO_ACCOUNTS } from "@/core/auth/dev-demo-auth";
import { getSiteSettings } from "@/core/settings/service";
import { Shield } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin sign in",
  referrer: "same-origin",
};

export default async function AdminLoginPage() {
  const devBypassActive =
    env.nodeEnv === "development" && env.devAuthMode === "bypass";
  const devDemoActive =
    env.nodeEnv === "development" && env.devAuthMode === "demo";
  const authActive = env.authEnabled || devDemoActive;
  const [currentUser, settings] = await Promise.all([
    authActive ? getCurrentUser() : Promise.resolve(null),
    getSiteSettings(),
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
            <Icon glyph={Shield} className="size-3.5" />
          </span>
          <span className="truncate">{siteName}</span>
        </Link>
        <ThemeToggle />
      </div>

      <Panel>
        <PanelHeader>
          <div className="flex items-center gap-2">
            <PageTitle>Admin sign in</PageTitle>
            <Badge variant="outline">vcon</Badge>
          </div>
          <span className="text-[11px] text-muted-foreground">{siteName}</span>
        </PanelHeader>
        <PanelBody className="space-y-3 p-4">
          {devBypassActive ? (
            <div className="space-y-3">
              <AlertBanner
                variant="info"
                role="status"
                title={`Development auth bypass is active (${env.devAuthRole}).`}
              >
                Protected admin routes are open locally without signing in.
              </AlertBanner>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href="/vcon">Open admin panel</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/users">Open user panel</Link>
                </Button>
              </div>
            </div>
          ) : currentUser ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Signed in as{" "}
                <span className="font-medium text-foreground">
                  {currentUser.username}
                </span>{" "}
                (
                {currentUser.isAdministrator ? "Administrator" : "User account"}
                ).
              </p>
              {!currentUser.isAdministrator ? (
                <AlertBanner variant="warning">
                  Active session belongs to a user account. Sign out first to
                  authenticate with an administrator account.
                </AlertBanner>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                {currentUser.isAdministrator ? (
                  <Button asChild size="sm">
                    <Link href="/vcon">Open admin panel</Link>
                  </Button>
                ) : (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/users">Open user panel</Link>
                  </Button>
                )}
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
              loginScope="admin"
              demoAccounts={
                devDemoActive
                  ? DEV_DEMO_ACCOUNTS.filter(
                      (account) => account.isAdministrator,
                    ).map((account) => ({
                      username: account.username,
                      password: account.password,
                      roleLabel: "Admin",
                    }))
                  : undefined
              }
            />
          )}
        </PanelBody>
      </Panel>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <Link
          className="text-muted-foreground underline hover:text-foreground"
          href="/sign-in"
        >
          User sign in
        </Link>
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
