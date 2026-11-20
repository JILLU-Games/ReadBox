import { signOutAction } from "@/app/sign-in/actions";
import { registerUserSignupAction } from "@/app/sign-up/actions";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  AlertBanner,
  BrandLogo,
  Button,
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
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const siteName = settings.siteName || "ReadBox";
  return {
    title: {
      absolute: `User sign up | ${siteName}`,
    },
    referrer: "same-origin",
    robots: { index: false, follow: false },
  };
}

export default async function SignUpPage() {
  const devDemoActive =
    env.nodeEnv === "development" && env.devAuthMode === "demo";
  const authActive = env.authEnabled || devDemoActive;
  let prisma = null;
  let dbUnavailable = !env.databaseUrl && !devDemoActive;
  if (env.databaseUrl) {
    try {
      prisma = getPrismaClient();
    } catch {
      prisma = null;
      dbUnavailable = true;
    }
  }
  const [currentUser, settings, userControl] = await Promise.all([
    authActive ? getCurrentUser() : Promise.resolve(null),
    getSiteSettings(),
    getUserControlSettings(prisma),
  ]);
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
          <PageTitle>Create user account</PageTitle>
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
                  <Link href="/users">Open workspace</Link>
                </Button>
                <form action={signOutAction}>
                  <Button type="submit" size="sm" variant="outline">
                    Sign out
                  </Button>
                </form>
              </div>
            </div>
          ) : dbUnavailable ? (
            <AlertBanner
              variant="error"
              title="Account registration unavailable"
            >
              PostgreSQL database connectivity is required to create new user
              accounts right now. Please try again later or contact an
              administrator.
            </AlertBanner>
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
      </div>
    </main>
  );
}
