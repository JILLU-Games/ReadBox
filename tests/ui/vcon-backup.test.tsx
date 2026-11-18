import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("allows only read-only preflight when the host restore gate is closed", async () => {
    const user = userEvent.setup();
    const backupId = "a".repeat(32);
    const testRestore = vi.fn(async () => ({
      ok: true, code: "RESTORE_PREFLIGHT_PASS",
      message: "Read-only verified; no data changed.",
      preflight: { backupId, verified: true as const, includesQueue: true,
        format: "age-r05-v1" as const, rollbackRequired: true as const,
        rollbackAvailable: false as const, productionAuthorized: false },
    }));
    const commit = vi.fn();
    render(<BackupConsole
      initialDashboard={{
        connected: true, jobs: [], r2: undefined,
        restore: { enabled: false, operatorReviewRequired: false },
        backups: [{ id: backupId, createdAt: "2026-11-18T00:00:00Z",
          state: "verified", level: "V2", bytes: 1000, sha256: "f".repeat(64),
          format: "age-r05-v1", includesQueue: true, includesHostSecrets: false }],
      }}
      onTestRestore={testRestore}
      onCommitRestore={commit}
    />);
    await user.click(screen.getByRole("button", { name: "Test restore" }));
    expect(testRestore).toHaveBeenCalledWith(backupId);
    expect(screen.getByText("Read-only verified; no data changed.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore backup" })).toBeDisabled();
    expect(commit).not.toHaveBeenCalled();
  });

  it("requires exact typed phrase and a fresh permit before guarded restore dispatch", async () => {
    const user = userEvent.setup();
    const backupId = "b".repeat(32);
    const prepare = vi.fn(async () => ({
      ok: true, code: "RESTORE_CONFIRMATION_READY", message: "Confirm",
      permit: { permitId: "c".repeat(32), token: "d".repeat(64),
        expiresAt: Date.now() / 1000 + 90 },
      preflight: { backupId, verified: true as const, includesQueue: false,
        format: "age-r05-v1" as const, rollbackRequired: true as const,
        rollbackAvailable: false as const, productionAuthorized: true },
    }));
    const commit = vi.fn(async () => ({
      ok: false, code: "RESTORE_OPERATOR_GATE_CLOSED", message: "Blocked",
    }));
    render(<BackupConsole
      initialDashboard={{
        connected: true, jobs: [],
        restore: { enabled: true, operatorReviewRequired: false },
        backups: [{ id: backupId, createdAt: "2026-11-18T00:00:00Z",
          state: "verified", level: "V2", bytes: 1000, sha256: "e".repeat(64),
          format: "age-r05-v1", includesQueue: false, includesHostSecrets: false }],
      }}
      onPrepareRestore={prepare} onCommitRestore={commit}
    />);
    await user.click(screen.getByRole("button", { name: "Restore backup" }));
    expect(prepare).toHaveBeenCalledWith(backupId);
    const confirmed = screen.getByRole("button", { name: "Confirm guarded restore" });
    expect(confirmed).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Exact restore confirmation" }),
      "RESTORE " + backupId);
    expect(confirmed).toBeEnabled();
    await user.click(confirmed);
    expect(commit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith(backupId, "c".repeat(32),
      "d".repeat(64), "RESTORE " + backupId);
    expect(screen.queryByRole("button", { name: "Confirm guarded restore" })).not.toBeInTheDocument();
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
