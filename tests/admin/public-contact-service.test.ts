import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  consumeContactCsrfToken,
  consumeContactCsrfTokenDurable,
  issueContactCsrfToken,
  listContactSubmissions,
  recordContactSubmission,
  resetContactServiceStateForTests,
  validateContactPayload,
} from "../../src/core/contact/service";

describe("Public Contact Service (CSRF, Validation, Rate Limiting & Audit)", () => {
  beforeEach(() => {
    resetContactServiceStateForTests();
  });

  it("issues a CSRF token and consumes it exactly once", () => {
    const now = 1_750_000_000_000;
    const issued = issueContactCsrfToken(now);
    assert.ok(issued.token.length > 20);
    assert.ok(issued.sessionValue.length > 10);
    assert.equal(issued.expiresIn, 1200);
    assert.match(issued.cookieHeader, /vm_contact_session=/);
    assert.match(issued.cookieHeader, /HttpOnly; SameSite=Strict/);

    const firstUse = consumeContactCsrfToken(
      issued.sessionValue,
      issued.token,
      now + 5_000,
    );
    assert.equal(firstUse, true);

    const replayUse = consumeContactCsrfToken(
      issued.sessionValue,
      issued.token,
      now + 6_000,
    );
    assert.equal(replayUse, false);
  });

  it("rejects expired or mismatched CSRF tokens", () => {
    const now = 1_750_000_000_000;
    const issued = issueContactCsrfToken(now);

    assert.equal(
      consumeContactCsrfToken("wrong-session", issued.token, now + 1_000),
      false,
    );
    assert.equal(
      consumeContactCsrfToken(
        issued.sessionValue,
        issued.token,
        now + 1_201_000,
      ),
      false,
    );
  });

  it("validates contact form payload, normalizes email, and enforces honeypot + timing guard", () => {
    const now = 1_750_000_010_000;
    const valid = validateContactPayload(
      {
        full_name: "  Alex Morgan  ",
        work_email: "  Alex.Morgan@Example.COM ",
        company: "Example Corp",
        phone: "+1 (555) 010-2400",
        service_type: "team",
        team_size: "6-20",
        message:
          "We need shared support@ and billing@ mailboxes on our custom domain.",
        consent: true,
        website: "",
        form_started_at: String(now - 5_000),
      },
      { nowMs: now },
    );

    assert.deepEqual(valid.errors, {});
    assert.equal(valid.cleaned.full_name, "Alex Morgan");
    assert.equal(valid.cleaned.work_email, "alex.morgan@example.com");
    assert.equal(valid.cleaned.service_type, "team");

    const spamHoneypot = validateContactPayload(
      {
        full_name: "Bot User",
        work_email: "bot@example.com",
        service_type: "personal",
        team_size: "1",
        message: "Automated spam message with more than twenty characters.",
        consent: true,
        website: "https://spam.invalid",
        form_started_at: String(now - 5_000),
      },
      { nowMs: now },
    );
    assert.equal(spamHoneypot.errors._spam, "Submission rejected.");

    const tooFast = validateContactPayload(
      {
        full_name: "Fast User",
        work_email: "fast@example.com",
        service_type: "personal",
        team_size: "1",
        message: "Submitted way too fast under two point five seconds.",
        consent: true,
        website: "",
        form_started_at: String(now - 500),
      },
      { nowMs: now },
    );
    assert.equal(tooFast.errors._spam, "Submission timing was invalid.");
  });

  it("enforces per-email and per-IP rate limits and records PostgreSQL audit entries", async () => {
    const now = 1_750_000_050_000;
    const audits: unknown[] = [];
    const mockPrisma = {
      auditLog: {
        create: async (args: unknown) => {
          audits.push(args);
          return args;
        },
      },
    };

    const sampleCleaned = {
      full_name: "Jordan Taylor",
      work_email: "jordan@company.org",
      company: "Company Org",
      phone: "",
      service_type: "business",
      team_size: "21-50",
      message: "Need multi-domain mailbox provisioning with DKIM and DMARC.",
    };

    for (let i = 0; i < 3; i += 1) {
      const result = await recordContactSubmission({
        requestIp: "198.51.100.25",
        cleaned: sampleCleaned,
        prisma: mockPrisma as never,
        nowMs: now + i * 1_000,
      });
      assert.equal(result.ok, true);
    }

    assert.equal(audits.length, 3);

    // 4th submission within 1 hour for the same email should be rate-limited (3/email/hr)
    const fourth = await recordContactSubmission({
      requestIp: "198.51.100.25",
      cleaned: sampleCleaned,
      prisma: mockPrisma as never,
      nowMs: now + 4_000,
    });
    assert.equal(fourth.ok, false);
    if (!fourth.ok) {
      assert.equal(fourth.status, 429);
      assert.equal(fourth.retryAfterSeconds, 3600);
    }

    // BUG-07: Verify full contact details are persisted in AuditLog and queryable via listContactSubmissions
    const firstAudit = (audits[0] as { data: { details: Record<string, unknown>; targetIdentifier: string } }).data;
    assert.equal(firstAudit.details.full_name, "Jordan Taylor");
    assert.equal(firstAudit.details.work_email, "jordan@company.org");
    assert.equal(firstAudit.details.company, "Company Org");
    assert.equal(
      firstAudit.details.message,
      "Need multi-domain mailbox provisioning with DKIM and DMARC.",
    );

    const listedFromDb = await listContactSubmissions({
      prisma: {
        auditLog: {
          findMany: async () => [
            {
              targetIdentifier: firstAudit.targetIdentifier,
              details: firstAudit.details,
              createdAt: new Date(now),
            },
          ],
        },
      },
    });
    assert.equal(listedFromDb.length, 1);
    assert.equal(listedFromDb[0]?.fullName, "Jordan Taylor");
    assert.equal(listedFromDb[0]?.workEmail, "jordan@company.org");
    assert.equal(
      listedFromDb[0]?.message,
      "Need multi-domain mailbox provisioning with DKIM and DMARC.",
    );

    // BUG-07: Fail-closed (status 500) when configured database fails to persist inquiry
    const failingPrisma = {
      auditLog: {
        create: async () => {
          throw new Error("DB unavailable");
        },
      },
    };
    const failedPersist = await recordContactSubmission({
      requestIp: "198.51.100.99",
      cleaned: {
        ...sampleCleaned,
        work_email: "new.sender@company.org",
      },
      prisma: failingPrisma as never,
      nowMs: now + 10_000,
    });
    assert.equal(failedPersist.ok, false);
    if (!failedPersist.ok) {
      assert.equal(failedPersist.status, 500);
    }
  });

  it("FA-002: enforces durable DB-backed CSRF replay protection and rate limits across memory state resets", async () => {
    const now = 1_750_000_100_000;
    const dbAudits: Array<{
      action: string;
      targetType: string;
      targetIdentifier: string;
      details: Record<string, unknown>;
      createdAt: Date;
    }> = [];

    const dbMockPrisma = {
      auditLog: {
        create: async (args: {
          data: {
            action: string;
            targetType: string;
            targetIdentifier: string;
            details: Record<string, unknown>;
          };
        }) => {
          const row = {
            ...args.data,
            createdAt: new Date(now),
          };
          dbAudits.push(row);
          return row;
        },
        findMany: async (args: {
          where: {
            action?: string;
            targetType?: string;
            targetIdentifier?: string;
          };
        }) =>
          dbAudits.filter(
            (row) =>
              (!args.where.action || row.action === args.where.action) &&
              (!args.where.targetType ||
                row.targetType === args.where.targetType) &&
              (!args.where.targetIdentifier ||
                row.targetIdentifier === args.where.targetIdentifier),
          ),
      },
    };

    const issued = issueContactCsrfToken(now);
    assert.equal(
      await consumeContactCsrfTokenDurable(
        issued.sessionValue,
        issued.token,
        dbMockPrisma as never,
        now + 1_000,
      ),
      true,
    );

    // Clear in-memory map to simulate worker restart/different replica
    resetContactServiceStateForTests();

    assert.equal(
      await consumeContactCsrfTokenDurable(
        issued.sessionValue,
        issued.token,
        dbMockPrisma as never,
        now + 2_000,
      ),
      false,
    );

    const payload = {
      full_name: "Multi Worker Check",
      work_email: "multiworker@company.org",
      company: "Worker Co",
      phone: "",
      service_type: "team",
      team_size: "2-5",
      message: "Checking durable rate limit enforcement across restarts.",
    };

    for (let i = 0; i < 3; i += 1) {
      resetContactServiceStateForTests();
      const okRes = await recordContactSubmission({
        requestIp: "203.0.113.45",
        cleaned: payload,
        prisma: dbMockPrisma as never,
        nowMs: now + i * 1_000,
      });
      assert.equal(okRes.ok, true);
    }

    // Even after memory clear, 4th submission within 1 hour is blocked by DB query
    resetContactServiceStateForTests();
    const blockedAfterRestart = await recordContactSubmission({
      requestIp: "203.0.113.45",
      cleaned: payload,
      prisma: dbMockPrisma as never,
      nowMs: now + 5_000,
    });
    assert.equal(blockedAfterRestart.ok, false);
    if (!blockedAfterRestart.ok) {
      assert.equal(blockedAfterRestart.status, 429);
    }
  });
});
