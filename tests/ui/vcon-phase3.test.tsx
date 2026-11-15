import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { DomainForm } from "@/components/vcon/domain-form";
import { DomainsDirectory } from "@/components/vcon/domains-directory";
import { MailboxForm } from "@/components/vcon/mailbox-form";
import { MailboxPurgeConfirm } from "@/components/vcon/mailbox-purge-confirm";
import { MailboxesDirectory } from "@/components/vcon/mailboxes-directory";
import type { ExpectedDnsRecord } from "@/core/dns/records";

const sampleRecords: readonly ExpectedDnsRecord[] = [
  {
    type: "MX",
    category: "routing",
    host: "example.test",
    cfHost: "@",
    value: "mail.example.test",
    priority: "10",
    copyable: true,
  },
  {
    type: "A",
    category: "routing",
    host: "mail.example.test",
    cfHost: "mail",
    value: "192.0.2.10",
    priority: "-",
    copyable: true,
  },
  {
    type: "TXT",
    category: "deliverability",
    host: "example.test",
    cfHost: "@",
    value: "v=spf1 a:mail.example.test -all",
    priority: "-",
    copyable: true,
  },
  {
    type: "TXT",
    category: "deliverability",
    host: "mail._domainkey.example.test",
    cfHost: "mail._domainkey",
    value: "DKIM signing key is not configured for this domain.",
    priority: "-",
    copyable: false,
  },
  {
    type: "TXT",
    category: "deliverability",
    host: "_dmarc.example.test",
    cfHost: "_dmarc",
    value: "v=DMARC1; p=none; rua=mailto:postmaster@example.test",
    priority: "-",
    copyable: true,
  },
];

describe("Phase 3 /vcon/domains and /vcon/mailboxes UI", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders DomainsDirectory, runs Check DNS, and blocks deleting default domain", async () => {
    const user = userEvent.setup();
    const onCheckDns = vi.fn(async () => ({
      ok: true as const,
      data: {
        verified: true,
        mxOk: true,
        targetOk: true,
        mx: ["mail.example.test"],
        target: "mail.example.test",
        targetAddresses: ["192.0.2.10"],
        message: "Required MX and mail-host records match.",
      },
    }));

    render(
      <DomainsDirectory
        domains={[
          {
            id: "1",
            uuid: "11111111-1111-4111-8111-111111111111",
            name: "example.test",
            status: "active",
            verificationStatus: "verified",
            isDefault: true,
            lastCheckedAt: "2026-11-15T12:00:00.000Z",
            mailboxCount: 3,
            totalMailboxCount: 3,
            verificationDetails: {},
          },
        ]}
        query=""
        configuredMailDomain="example.test"
        databaseConfigured
        databaseConnected
        onCheckDns={onCheckDns}
        onToggleStatus={vi.fn()}
        onMakeDefault={vi.fn()}
        onDeleteDomain={vi.fn()}
      />,
    );

    expect(screen.getByText("example.test")).toBeInTheDocument();
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete example.test" }),
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Check DNS/i }));
    expect(onCheckDns).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("previews 5 DNS records and requires DNS confirmation before creating domain", async () => {
    const user = userEvent.setup();
    const onPreviewDns = vi.fn(async () => ({
      ok: true,
      records: sampleRecords,
    }));
    const onCreate = vi.fn(async (input) => ({
      ok: true as const,
      data: {
        uuid: "11111111-1111-4111-8111-111111111111",
        name: input.name,
      },
    }));

    render(
      <DomainForm
        mode="create"
        databaseConfigured
        onPreviewDns={onPreviewDns}
        onCreate={onCreate}
      />,
    );

    expect(screen.getByText(/No DNS records generated yet/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Domain name"), "example.test");
    await user.click(screen.getByRole("button", { name: /Preview DNS/i }));

    const hostMatches = await screen.findAllByText("mail.example.test");
    expect(hostMatches.length).toBe(2);
    expect(screen.getAllByText("Required routing").length).toBe(2);
    expect(screen.getAllByText("Deliverability").length).toBe(3);

    await user.click(screen.getByRole("button", { name: "Add domain" }));
    expect(onCreate).not.toHaveBeenCalled();

    await user.click(
      screen.getByLabelText(/I have reviewed the DNS records above/i),
    );
    await user.click(screen.getByRole("button", { name: "Add domain" }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({
        name: "example.test",
        dnsConfirmed: true,
      });
    });
  });

  it("renders DomainForm edit mode with immutable name and live routing vs deliverability DNS modal", async () => {
    const user = userEvent.setup();
    const onInspectDnsStatus = vi.fn(async () => ({
      ok: true,
      result: {
        routingVerified: true,
        allVerified: false,
        lookupFailed: false,
        message: "Required routing records match; deliverability records need attention.",
        records: sampleRecords.map((record) => ({
          ...record,
          status:
            record.category === "routing"
              ? ("verified" as const)
              : ("missing" as const),
          observed: [],
        })),
      },
    }));

    render(
      <DomainForm
        mode="edit"
        databaseConfigured
        configuredMailDomain="mailstack.local"
        initialDomain={{
          id: "2",
          uuid: "22222222-2222-4222-8222-222222222222",
          name: "secondary.test",
          status: "disabled",
          verificationStatus: "pending",
          isDefault: false,
          lastCheckedAt: null,
          mailboxCount: 0,
          totalMailboxCount: 0,
          verificationDetails: {},
        }}
        initialRecords={sampleRecords}
        onInspectDnsStatus={onInspectDnsStatus}
        onUpdateStatus={vi.fn()}
        onCheckDns={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Domain name")).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: /Inspect all DNS records/i }),
    );
    expect(await screen.findByText(/Routing: Verified/i)).toBeInTheDocument();
    expect(screen.getByText(/All 5 records: Partial \/ Missing/i)).toBeInTheDocument();
  });

  it("supports bulk purge confirmation and system mailbox creation in MailboxesDirectory", async () => {
    const user = userEvent.setup();
    const onBulkPurge = vi.fn(async () => ({
      ok: true as const,
      data: { purgedCount: 1, purgedEmails: ["sales@example.test"] },
    }));
    const onCreateSystemMailbox = vi.fn(async () => ({
      ok: true as const,
      data: {
        uuid: "99999999-9999-4999-8999-999999999999",
        emailAddress: "postmaster@example.test",
        localPart: "postmaster",
      },
    }));

    render(
      <MailboxesDirectory
        list={{
          items: [
            {
              id: "10",
              uuid: "33333333-3333-4333-8333-333333333333",
              localPart: "sales",
              emailAddress: "sales@example.test",
              domainUuid: "11111111-1111-4111-8111-111111111111",
              domainName: "example.test",
              status: "active",
              maildirRelativePath: "example.test/sales/Maildir/",
              totalMessages: "12",
              unreadMessages: "4",
              lastReceivedAt: null,
              createdAt: "2026-11-15T10:00:00.000Z",
              assignedUserCount: 1,
              assignedUsernames: ["demo.user"],
            },
          ],
          totalCount: 1,
          page: 1,
          pageSize: 25,
          totalPages: 1,
          query: "",
          statusFilter: "all",
          domainUuidFilter: "",
          availableDomains: [
            {
              uuid: "11111111-1111-4111-8111-111111111111",
              name: "example.test",
            },
          ],
        }}
        verifiedDomains={[
          {
            id: "1",
            uuid: "11111111-1111-4111-8111-111111111111",
            name: "example.test",
            isDefault: true,
          },
        ]}
        databaseConfigured
        databaseConnected
        onToggleActive={vi.fn()}
        onBulkPurge={onBulkPurge}
        onCreateSystemMailbox={onCreateSystemMailbox}
      />,
    );

    await user.click(
      screen.getByRole("checkbox", { name: "Select sales@example.test" }),
    );
    await user.click(screen.getByRole("button", { name: /Purge selected/i }));
    await user.click(
      screen.getByLabelText(/I confirm permanent deletion/i),
    );
    await user.click(screen.getByRole("button", { name: "Permanently purge" }));
    expect(onBulkPurge).toHaveBeenCalledWith(
      ["33333333-3333-4333-8333-333333333333"],
      true,
    );

    await user.click(screen.getByRole("button", { name: "System mailbox" }));
    await user.click(
      screen.getByLabelText(/Confirm administrator-approved creation/i),
    );
    await user.click(
      screen.getByRole("button", { name: "Create system mailbox" }),
    );
    expect(onCreateSystemMailbox).toHaveBeenCalledWith({
      localPart: "postmaster",
      domainUuid: "11111111-1111-4111-8111-111111111111",
      confirm: true,
    });
  });

  it("supports Generate, user filter, and Create & copy in MailboxForm, plus typed confirmation in MailboxPurgeConfirm", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const onCreate = vi.fn(async (input) => ({
      ok: true as const,
      data: {
        uuid: "44444444-4444-4444-8444-444444444444",
        emailAddress: `${input.localPart}@example.test`,
        localPart: input.localPart,
      },
    }));

    render(
      <MailboxForm
        domains={[
          {
            id: "1",
            uuid: "11111111-1111-4111-8111-111111111111",
            name: "example.test",
            isDefault: true,
          },
        ]}
        users={[
          { id: "10", username: "alex.user", email: "alex@example.test" },
          { id: "11", username: "taylor.ops", email: "taylor@example.test" },
        ]}
        onCreate={onCreate}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Generate" }));
    const localInput = screen.getByLabelText(
      "Mailbox local part",
    ) as HTMLInputElement;
    expect(localInput.value).toMatch(/^[a-z]+\.[a-z]+\d{2}$/);

    await user.type(
      screen.getByPlaceholderText("Filter users by username or email"),
      "alex",
    );
    expect(screen.getByLabelText("alex.user")).toBeInTheDocument();
    expect(screen.queryByLabelText("taylor.ops")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("alex.user"));
    await user.click(screen.getByRole("button", { name: /Create & copy/i }));

    expect(
      await screen.findByText("Mailbox provisioned"),
    ).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(`${localInput.value}@example.test`);

    cleanup();
    const onPurge = vi.fn(async () => ({
      ok: true as const,
      data: { emailAddress: "sales@example.test" },
    }));

    render(
      <MailboxPurgeConfirm
        mailbox={{
          uuid: "33333333-3333-4333-8333-333333333333",
          emailAddress: "sales@example.test",
          domainName: "example.test",
          status: "active",
          totalMessages: "5",
          unreadMessages: "2",
          assignedUserCount: 1,
        }}
        onPurge={onPurge}
      />,
    );

    const submitPurge = screen.getByRole("button", {
      name: /Permanently delete mailbox/i,
    });
    expect(submitPurge).toBeDisabled();

    await user.type(
      screen.getByLabelText(/Type "sales@example\.test"/i),
      "sales@example.test",
    );
    expect(submitPurge).toBeEnabled();
    await user.click(submitPurge);

    expect(onPurge).toHaveBeenCalledWith(
      "33333333-3333-4333-8333-333333333333",
      "sales@example.test",
    );
  });
});
