import { ServiceWorkerRegistration } from "@/components/providers/service-worker-registration";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { getSiteSettings } from "@/core/settings/service";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const siteName = settings.siteName || "ReadBox";
  const description =
    settings.siteTagline || "Self-hosted mail server and shared team inbox.";

  return {
    applicationName: siteName,
    title: {
      default: siteName,
      template: `%s | ${siteName}`,
    },
    description,
    manifest: "/manifest.webmanifest",
    ...(settings.faviconUrl
      ? {
          icons: {
            icon: settings.faviconUrl,
          },
        }
      : {}),
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#10171d" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <ThemeProvider>
          {children}
          <ServiceWorkerRegistration />
        </ThemeProvider>
      </body>
    </html>
  );
}
