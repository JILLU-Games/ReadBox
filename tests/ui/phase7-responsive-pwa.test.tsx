import { PasswordResetForm } from "@/components/auth/password-reset-form";
import { SignInForm } from "@/components/auth/sign-in-form";
import { SystemUpdateConsole } from "@/components/vcon/system-update-console";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/reset-password/actions", () => ({
  completePasswordResetAction: vi.fn(async () => ({ status: "idle" })),
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

describe("Phase 7 — 320px Responsive Containment & PWA Cache Privacy Contract", () => {
  it("renders SignInForm with demo account credentials wrapped for 320px viewports (BUG-006)", () => {
    const { container } = render(
      <SignInForm
        enabled={true}
        demoAccounts={[
          {
            username: "demo.admin",
            password: "demo-admin-local-dev-long-secret",
            roleLabel: "Admin",
          },
          {
            username: "demo.user",
            password: "demo-user-local-dev-long-secret",
            roleLabel: "User",
          },
        ]}
      />,
    );

    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    const demoCodes = container.querySelectorAll("code.break-all");
    expect(demoCodes.length).toBe(2);
  });

  it("renders PasswordResetForm with accessible inputs for 320px viewports", () => {
    render(<PasswordResetForm />);
    expect(screen.getByLabelText("Reset token")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
  });

  it("renders SystemUpdateConsole with flex-wrap and min-w-0 containers for 320px viewports", () => {
    const { container } = render(
      <SystemUpdateConsole
        currentVersion="1.3.5.5"
        githubRepo="vibtools/MailStack"
        runtimeDir="/run/vibmail"
        initialPreflight={{
          status: "blocked",
          checks: [
            {
              name: "runtime directory",
              passed: false,
              detail: "/run/vibmail",
            },
          ],
          message: "Blocked by runtime directory (/run/vibmail)",
        }}
        initialStatus={{
          step: "idle",
          message: "No update in progress",
          progress: 0,
        }}
      />,
    );

    const minWZeroCards = container.querySelectorAll(".min-w-0");
    expect(minWZeroCards.length).toBeGreaterThanOrEqual(3);
  });

  it("enforces strict public-static-only caching in public/sw.js and never caches private routes", () => {
    const swSource = readFileSync(
      resolve(process.cwd(), "public", "sw.js"),
      "utf8",
    );

    expect(swSource).toContain('url.pathname.startsWith("/_next/static/")');
    expect(swSource).toContain('url.pathname.startsWith("/api/")');
    expect(swSource).toContain('cacheControl.includes("immutable")');
    expect(swSource).toContain('!response.headers.has("set-cookie")');
    expect(swSource).not.toContain('cache.put("/users"');
    expect(swSource).not.toContain('cache.put("/vcon"');
  });
});
