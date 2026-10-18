import type {
  LookupResult,
  ReadOnlyMailServerAdapter,
  ReadOperationOptions,
} from "@/core/postfix/read-adapter";

export type MockLookupHandler<TQuery, TRecord> = (
  query: TQuery,
  options?: ReadOperationOptions,
) => LookupResult<TRecord> | Promise<LookupResult<TRecord>>;

export interface MockReadOnlyMailServerHandlers<
  TDomainQuery,
  TDomainRecord,
  TMailboxQuery,
  TMailboxRecord,
  TAliasQuery,
  TAliasRecord,
> {
  lookupDomains: MockLookupHandler<TDomainQuery, TDomainRecord>;
  lookupMailboxes: MockLookupHandler<TMailboxQuery, TMailboxRecord>;
  lookupAliases: MockLookupHandler<TAliasQuery, TAliasRecord>;
}

export function createMockReadOnlyMailServerAdapter<
  TDomainQuery,
  TDomainRecord,
  TMailboxQuery,
  TMailboxRecord,
  TAliasQuery,
  TAliasRecord,
>(
  handlers: MockReadOnlyMailServerHandlers<
    TDomainQuery,
    TDomainRecord,
    TMailboxQuery,
    TMailboxRecord,
    TAliasQuery,
    TAliasRecord
  >,
): ReadOnlyMailServerAdapter<
  TDomainQuery,
  TDomainRecord,
  TMailboxQuery,
  TMailboxRecord,
  TAliasQuery,
  TAliasRecord
> {
  async function invoke<TQuery, TRecord>(
    handler: MockLookupHandler<TQuery, TRecord>,
    query: TQuery,
    options?: ReadOperationOptions,
  ): Promise<LookupResult<TRecord>> {
    try {
      return await handler(query, options);
    } catch {
      return { kind: "error", code: "query_failed" };
    }
  }

  return {
    lookupDomains: (query, options) =>
      invoke(handlers.lookupDomains, query, options),
    lookupMailboxes: (query, options) =>
      invoke(handlers.lookupMailboxes, query, options),
    lookupAliases: (query, options) =>
      invoke(handlers.lookupAliases, query, options),
  };
}
