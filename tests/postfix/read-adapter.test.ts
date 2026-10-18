import type {
  MockLookupHandler,
  MockReadOnlyMailServerHandlers,
} from "@/core/postfix/mock-read-adapter";
import { createMockReadOnlyMailServerAdapter } from "@/core/postfix/mock-read-adapter";
import type { LookupResult } from "@/core/postfix/read-adapter";
import assert from "node:assert/strict";
import { test } from "node:test";

interface TestQuery {
  readonly scenario: string;
}

interface TestRecord {
  readonly fixtureId: string;
}

function records(query: TestQuery): LookupResult<TestRecord> {
  return { kind: "records", records: [{ fixtureId: query.scenario }] };
}

function makeHandlers(
  overrides: Partial<
    MockReadOnlyMailServerHandlers<
      TestQuery,
      TestRecord,
      TestQuery,
      TestRecord,
      TestQuery,
      TestRecord
    >
  > = {},
) {
  const defaultHandler: MockLookupHandler<TestQuery, TestRecord> = async (
    query,
  ) => records(query);

  return {
    lookupDomains: overrides.lookupDomains ?? defaultHandler,
    lookupMailboxes: overrides.lookupMailboxes ?? defaultHandler,
    lookupAliases: overrides.lookupAliases ?? defaultHandler,
  };
}

test("mock adapter returns successful domain, mailbox, and alias records", async () => {
  const adapter = createMockReadOnlyMailServerAdapter(makeHandlers());

  assert.deepEqual(await adapter.lookupDomains({ scenario: "domain-result" }), {
    kind: "records",
    records: [{ fixtureId: "domain-result" }],
  });
  assert.deepEqual(
    await adapter.lookupMailboxes({ scenario: "mailbox-result" }),
    { kind: "records", records: [{ fixtureId: "mailbox-result" }] },
  );
  assert.deepEqual(await adapter.lookupAliases({ scenario: "alias-result" }), {
    kind: "records",
    records: [{ fixtureId: "alias-result" }],
  });
});

test("empty, not-found, and ambiguous results remain distinct", async () => {
  const adapter = createMockReadOnlyMailServerAdapter(
    makeHandlers({
      lookupDomains: async () => ({ kind: "records", records: [] }),
      lookupMailboxes: async () => ({ kind: "not_found" }),
      lookupAliases: async () => ({ kind: "ambiguous", matchCount: 2 }),
    }),
  );

  assert.deepEqual(await adapter.lookupDomains({ scenario: "empty" }), {
    kind: "records",
    records: [],
  });
  assert.deepEqual(await adapter.lookupMailboxes({ scenario: "missing" }), {
    kind: "not_found",
  });
  assert.deepEqual(await adapter.lookupAliases({ scenario: "duplicate" }), {
    kind: "ambiguous",
    matchCount: 2,
  });
});

test("mock handlers can report invalid input without echoing the query", async () => {
  const adapter = createMockReadOnlyMailServerAdapter(
    makeHandlers({
      lookupDomains: async (query) =>
        query.scenario.trim() === ""
          ? { kind: "error", code: "invalid_input" }
          : records(query),
    }),
  );

  assert.deepEqual(await adapter.lookupDomains({ scenario: " " }), {
    kind: "error",
    code: "invalid_input",
  });
});

test("unavailable, query failure, and timeout use safe error codes", async () => {
  const privateMarker = "synthetic-private-error-marker";
  const adapter = createMockReadOnlyMailServerAdapter(
    makeHandlers({
      lookupDomains: async () => ({ kind: "error", code: "unavailable" }),
      lookupMailboxes: async () => {
        throw new Error(privateMarker);
      },
      lookupAliases: async () => ({ kind: "error", code: "timeout" }),
    }),
  );

  const unavailable = await adapter.lookupDomains({ scenario: "offline" });
  const queryFailure = await adapter.lookupMailboxes({ scenario: "failure" });
  const timeout = await adapter.lookupAliases({ scenario: "timeout" });

  assert.deepEqual(unavailable, { kind: "error", code: "unavailable" });
  assert.deepEqual(queryFailure, { kind: "error", code: "query_failed" });
  assert.deepEqual(timeout, { kind: "error", code: "timeout" });
  assert.equal(
    JSON.stringify([unavailable, queryFailure, timeout]).includes(
      privateMarker,
    ),
    false,
  );
});

test("operation abort signal is passed through to the mock handler", async () => {
  const controller = new AbortController();
  controller.abort();
  let receivedSignal: AbortSignal | undefined;
  const adapter = createMockReadOnlyMailServerAdapter(
    makeHandlers({
      lookupDomains: async (_query, options) => {
        receivedSignal = options?.signal;
        return { kind: "error", code: "cancelled" };
      },
    }),
  );

  assert.deepEqual(
    await adapter.lookupDomains(
      { scenario: "cancelled" },
      { signal: controller.signal },
    ),
    { kind: "error", code: "cancelled" },
  );
  assert.strictEqual(receivedSignal, controller.signal);
});
