import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/core/auth/route-guards", () => ({
  requireAdminUser: vi.fn(async () => ({ id: BigInt(1), isAdministrator: true })),
}));

import AdminBackupPage from "@/app/(workspace)/vcon/backup/page";
import { BackupConsole } from "@/components/vcon/backup-console";
import { requireAdminUser } from "@/core/auth/route-guards";

describe("BR-01 /vcon/backup read-only interface", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the compact admin backup sections without claiming a connected service", () => {
    render(<BackupConsole />);

    expect(screen.getByRole("heading", { name: "Backup & Restore" })).toBeInTheDocument();
    expect(screen.getByText("Setup required")).toBeInTheDocument();
    expect(screen.getByText("Read-only preview")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Local backups" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Automatic schedule" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cloudflare R2 storage" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Activity & logs" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Restore & recovery" })).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
    expect(screen.getAllByText("Not configured")).toHaveLength(2);
    expect(screen.getByTestId("backup-page-read-only")).toHaveClass("space-y-4");
  });

  it("keeps every future operation disabled and performs no network request", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    render(<BackupConsole />);
    for (const label of [
      "Create backup",
      "Verify backup",
      "View files",
      "Configure schedule",
      "Configure R2",
      "Test connection",
      "Upload to R2",
      "Copy logs",
      "Test restore",
      "Restore backup",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requires the existing server-side administrator gate before rendering the page", async () => {
    const tree = await AdminBackupPage();
    expect(requireAdminUser).toHaveBeenCalledTimes(1);
    render(tree);
    expect(screen.getByRole("heading", { name: "Backup & Restore" })).toBeInTheDocument();
  });

  it("does not render when the existing administrator gate rejects access", async () => {
    vi.mocked(requireAdminUser).mockRejectedValueOnce(new Error("Not authorized"));
    await expect(AdminBackupPage()).rejects.toThrow("Not authorized");
  });
});
