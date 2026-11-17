import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInboxUrl,
  buildMailboxesUrl,
  buildMessageUrl,
  formatCompactTimestamp,
  formatGmailInboxDate,
  formatMessageByteSize,
  generateRandomUsaLocalPart,
  generateUsaMailboxSuggestions,
  getSenderDisplayName,
  getSenderInitials,
  sanitizeLocalPartInput,
} from "../../src/components/users/user-workspace-helpers";

test("sanitizeLocalPartInput lowercases and strips disallowed characters", () => {
  assert.equal(sanitizeLocalPartInput("Olivia.Martin+Ops!@#"), "olivia.martin+ops");
  assert.equal(sanitizeLocalPartInput("  TEST_User-1 "), "test_user-1");
});

test("generateUsaMailboxSuggestions produces distinct valid local parts", () => {
  const suggestions = generateUsaMailboxSuggestions(3);
  assert.equal(suggestions.length, 3);
  assert.equal(new Set(suggestions).size, 3);
  for (const candidate of suggestions) {
    assert.match(candidate, /^[a-z0-9.]+$/);
  }
});

test("generateRandomUsaLocalPart formats first.lastNN", () => {
  const localPart = generateRandomUsaLocalPart(() => 0.25);
  assert.match(localPart, /^[a-z]+\.[a-z]+\d{2}$/);
});

test("URL builders preserve search, filter, and pagination parameters cleanly", () => {
  assert.equal(buildMailboxesUrl({ q: "", status: "all", page: 1 }), "/users/mailboxes");
  assert.equal(
    buildMailboxesUrl({ q: "billing", status: "active", page: 2 }),
    "/users/mailboxes?q=billing&status=active&page=2",
  );

  const mbxUuid = "11111111-1111-4111-8111-111111111101";
  const msgUuid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001";
  assert.equal(
    buildInboxUrl(mbxUuid, { q: "invoice", read: "unread", attachments: "yes", page: 3 }),
    `/users/inbox/${mbxUuid}?q=invoice&read=unread&attachments=yes&page=3`,
  );
  assert.equal(
    buildMessageUrl(mbxUuid, msgUuid, { read: "unread" }),
    `/users/inbox/${mbxUuid}/${msgUuid}?read=unread`,
  );
});

test("formatMessageByteSize, formatCompactTimestamp, and formatGmailInboxDate format safely", () => {
  assert.equal(formatMessageByteSize(512), "512 B");
  assert.equal(formatMessageByteSize(2048), "2.0 KB");
  assert.equal(formatMessageByteSize(1572864), "1.5 MB");
  assert.equal(formatCompactTimestamp("2026-11-15T10:30:00.000Z"), "2026-11-15 10:30");
  assert.equal(formatCompactTimestamp(null, "No email"), "No email");
  assert.equal(formatGmailInboxDate("2026-11-15T09:20:00.000Z"), "Nov 15, 09:20");
  assert.equal(formatGmailInboxDate(null, "—"), "—");
});

test("getSenderDisplayName and getSenderInitials derive crisp labels and monograms", () => {
  assert.equal(
    getSenderDisplayName("Customer Care", "care@example.com"),
    "Customer Care",
  );
  assert.equal(
    getSenderDisplayName("  ", "billing@example.com"),
    "billing@example.com",
  );
  assert.equal(getSenderDisplayName(null, null), "Unknown sender");

  assert.equal(getSenderInitials("Customer Care", "care@example.com"), "CC");
  assert.equal(getSenderInitials("Vendor Billing", "b@x.com"), "VB");
  assert.equal(getSenderInitials("", "alice.martin@example.com"), "AM");
  assert.equal(getSenderInitials("", "support@example.com"), "SU");
  assert.equal(getSenderInitials("", ""), "?");
});
