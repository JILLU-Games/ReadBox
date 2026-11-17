import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { OperationsConsole } from "@/components/vcon/operations-console";
import type { OperationsOverviewData } from "@/core/operations/service";

const sampleOverview: OperationsOverviewData = {
  databaseConfigured: true,
  databaseConnected: true,
  health: {
    ingestion: {
      label: "Ingestion service",
      state: "ok",
      detail: "Healthy",
      meta: "2026-11-15T18:00:00.000Z",
    },
    mailStorage: { ok: true, detail: "Accessible" },
    attachmentStorage: { ok: true, detail: "Accessible" },
    lockStorage: { ok: true, detail: "Accessible" },
  },
  postfixContract: {
    verified: true,
    domains: 1,
    mailboxes: 2,
    postfixRows: 2,
    error: null,
  },
  syncDrift: {
    appMailboxes: 2,
    mailserverMailboxes: 2,
    missingInApp: 0,
    missingInMailserver: 0,
    statusMismatches: 0,
  },
  indexingStats: {
    totalMailboxes: 2,
    totalMessages: 14,
    totalUnread: 3,
    warningMessages: 1,
    oversizedMessages: 0,
    failedMessages: 0,
  },
  mailboxes: [
    {
      uuid: "11111111-1111-4111-8111-111111111111",
      emailAddress: "support@readbox.test",
      status: "active",
    },
  ],
};

describe("Phase 4 /vcon/operations console UI", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders operations telemetry and enforces body repair confirmation guard without leaking message bodies", async () => {
    const user = userEvent.setup();

    const onVerifyPostfix = vi.fn(async () => ({
      ok: true as const,
      data: { domains: 1, mailboxes: 2, postfixRows: 2 },
      message: "Postfix contract verified.",
    }));
    const onSyncMailserver = vi.fn(async () => ({
      ok: true as const,
      data: {
        dryRun: true,
        strict: false,
        created: 0,
        updated: 0,
        unchanged: 2,
        errors: 0,
        errorSamples: [],
      },
      message: "Dry-run sync complete.",
    }));
    const onProvisionMaildirs = vi.fn(async () => ({
      ok: true as const,
      data: {
        scanned: 2,
        verifiedOrCreated: 2,
        errors: 0,
        issueSamples: [],
      },
      message: "Maildirs verified.",
    }));
    const onRebuildIndex = vi.fn(async () => ({
      ok: true as const,
      data: {
        status: "healthy" as const,
        dryRun: true,
        scanned: 4,
        created: 1,
        duplicates: 3,
        oversized: 0,
        skippedMissing: 0,
        errors: 0,
        startedAt: "2026-11-15T18:00:00.000Z",
        finishedAt: "2026-11-15T18:00:01.000Z",
        errorSamples: [],
      },
      message: "Dry-run index scan finished.",
    }));
    const onRecalculateCounters = vi.fn(async () => ({
      ok: true as const,
      data: { updatedCount: 2 },
      message: "Counters updated.",
    }));
    const onRepairBodies = vi.fn(async () => ({
      ok: true as const,
      data: {
        dryRun: false,
        scanned: 5,
        updated: 1,
        wouldUpdate: 0,
        unchanged: 4,
        missing: 0,
        mismatched: 0,
        oversized: 0,
        errors: 0,
        issueSamples: [],
      },
      message: "Repair finished.",
    }));
    const onRetentionPurge = vi.fn(async (input) => ({
      ok: true as const,
      data: {
        dryRun: input.dryRun,
        retentionDays: input.retentionDays ?? 30,
        cutoffIso: "2026-10-17T00:00:00.000Z",
        scannedMailboxes: 1,
        affectedMailboxes: 1,
        purgedMessages: 2,
        errors: 0,
      },
      message: input.dryRun
        ? "Dry-run retention scan finished."
        : "Retention cleanup completed.",
    }));

    const { container } = render(
      <OperationsConsole
        overview={sampleOverview}
        onVerifyPostfix={onVerifyPostfix}
        onSyncMailserver={onSyncMailserver}
        onProvisionMaildirs={onProvisionMaildirs}
        onRebuildIndex={onRebuildIndex}
        onRecalculateCounters={onRecalculateCounters}
        onRepairBodies={onRepairBodies}
        onRetentionPurge={onRetentionPurge}
      />,
    );

    expect(
      screen.getByText(/Operations & ingestion diagnostics/i),
    ).toBeInTheDocument();
    expect(screen.getByText("14 indexed")).toBeInTheDocument();

    // Ensure no raw filesystem paths leak into the DOM
    expect(container.textContent).not.toContain("/var/vmail");
    expect(container.textContent).not.toContain("/var/lib/readbox");

    // Scope selector + dry-run rebuild
    await user.selectOptions(
      screen.getByLabelText("Mailbox scope"),
      "11111111-1111-4111-8111-111111111111",
    );
    await user.click(screen.getByRole("button", { name: "Dry run scan" }));
    await waitFor(() => {
      expect(onRebuildIndex).toHaveBeenCalledWith({
        dryRun: true,
        mailboxUuid: "11111111-1111-4111-8111-111111111111",
      });
    });

    // Repair button is disabled until confirmed
    const repairBtn = screen.getByRole("button", { name: "Repair bodies" });
    expect(repairBtn).toBeDisabled();

    await user.click(
      screen.getByRole("checkbox", {
        name: /Confirm non-destructive body rewrite/i,
      }),
    );
    expect(repairBtn).toBeEnabled();

    await user.click(repairBtn);
    await waitFor(() => {
      expect(onRepairBodies).toHaveBeenCalledWith({
        dryRun: false,
        confirmRepair: true,
        limit: 500,
        mailboxUuid: "11111111-1111-4111-8111-111111111111",
      });
    });

    // Panel 7: Retention purge confirmation guard, override & dry-run
    expect(
      screen.getByText(/7\. Run email retention purge/i),
    ).toBeInTheDocument();
    const purgeBtn = screen.getByRole("button", {
      name: "Purge expired emails",
    });
    expect(purgeBtn).toBeDisabled();

    await user.type(screen.getByLabelText(/Retention days override/i), "14");
    await user.click(
      screen.getByRole("button", { name: "Dry run retention" }),
    );
    await waitFor(() => {
      expect(onRetentionPurge).toHaveBeenCalledWith({
        dryRun: true,
        retentionDays: 14,
        mailboxUuid: "11111111-1111-4111-8111-111111111111",
      });
    });

    await user.click(
      screen.getByRole("checkbox", {
        name: /Confirm batch purge of retention-expired emails/i,
      }),
    );
    expect(purgeBtn).toBeEnabled();
    await user.click(purgeBtn);
    await waitFor(() => {
      expect(onRetentionPurge).toHaveBeenCalledWith({
        dryRun: false,
        retentionDays: 14,
        mailboxUuid: "11111111-1111-4111-8111-111111111111",
      });
    });
    expect(
      screen.getByText(/Retention purge: 2 expired message\(s\)/i),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Verify Postfix contract" }),
    );
    await waitFor(() => {
      expect(onVerifyPostfix).toHaveBeenCalledTimes(1);
    });
  });

  it("renders status banner and disables operational buttons when DATABASE_URL is absent", () => {
    const noop = vi.fn();
    render(
      <OperationsConsole
        overview={{
          ...sampleOverview,
          databaseConfigured: false,
          databaseConnected: false,
        }}
        onVerifyPostfix={noop}
        onSyncMailserver={noop}
        onProvisionMaildirs={noop}
        onRebuildIndex={noop}
        onRecalculateCounters={noop}
        onRepairBodies={noop}
        onRetentionPurge={noop}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /Database is not configured/i,
    );
    expect(
      screen.getByRole("button", { name: "Verify Postfix contract" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Ingest unindexed files" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Dry run retention" }),
    ).toBeDisabled();
  });
});
