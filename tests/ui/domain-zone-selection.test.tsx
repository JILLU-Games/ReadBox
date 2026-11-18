import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("server-only", () => ({}));

import { DomainForm } from "@/components/vcon/domain-form";

const id = "a".repeat(32);
const selected = { id, name: "example.test" };

function zoneApi(input: RequestInfo | URL, opts?: RequestInit) {
  if (String(input).endsWith("/api/vcon/domains/cloudflare-zones")) {
    return Promise.resolve(new Response(JSON.stringify({ zones: [selected] }), {
      status: 200,
    }));
  }
  if (String(input).endsWith("/dkim") && opts?.method !== "POST") {
    return Promise.resolve(new Response(JSON.stringify({
      key: "ready", dns: "missing", signing: "inactive",
    }), { status: 200 }));
  }
  if (String(input).endsWith("/dkim") && opts?.method === "POST") {
    return Promise.resolve(new Response(JSON.stringify({
      ok: true, provision: "existing", dns: "created", routing: "pending",
    }), { status: 200 }));
  }
  throw new Error("Unexpected route " + String(input));
}

describe("DOMAIN-AUTO-02 Cloudflare zone selector", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("requires explicit active zone and submits its ID during automatic domain creation", async () => {
    const create = vi.fn(async () => ({ ok: true as const,
      data: { uuid: "11111111-1111-4111-8111-111111111111", name: "example.test" } }));
    vi.stubGlobal("fetch", vi.fn(zoneApi));
    const user = userEvent.setup();
    render(<DomainForm mode="create" databaseConfigured onCreate={create} />);
    await user.type(screen.getByLabelText(/Domain name/i), "example.test");
    await screen.findByRole("option", { name: "example.test" });
    await user.click(screen.getByRole("button", { name: "Add domain" }));
    expect(create).not.toHaveBeenCalled();
    expect(screen.getAllByText("Select a Cloudflare zone before automatic setup.").length).toBeGreaterThan(0);
    await user.selectOptions(screen.getByLabelText("Select an active Cloudflare zone"), id);
    await user.click(screen.getByRole("button", { name: "Add domain" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({
      name: "example.test", dnsConfirmed: true, autoDkim: true, zoneId: id,
    }));
  });

  it("preserves an immutable bound zone in the repair API request", async () => {
    const fetchMock = vi.fn(zoneApi);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DomainForm mode="edit" databaseConfigured
      initialDomain={{
        id: "1", uuid: "11111111-1111-4111-8111-111111111111",
        name: "example.test", status: "disabled",
        verificationStatus: "pending", isDefault: false,
        lastCheckedAt: null, mailboxCount: 0, totalMailboxCount: 0,
        verificationDetails: { cloudflareZone: selected },
      }}
      onPreviewDns={async () => ({ ok: true, records: [] })}
    />);
    const selector = screen.getByLabelText("Select an active Cloudflare zone");
    expect(selector).toBeDisabled();
    expect(selector).toHaveValue(id);
    await user.click(screen.getByRole("button", { name: "Provision / Repair DKIM" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input, opts]) =>
      String(input).endsWith("/dkim") &&
      opts?.method === "POST" &&
      JSON.parse(String(opts.body)).zoneId === id &&
      JSON.parse(String(opts.body)).publish === true)).toBe(true));
  });
});
