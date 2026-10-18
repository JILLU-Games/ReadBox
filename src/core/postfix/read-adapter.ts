export interface ReadOperationOptions {
  readonly signal?: AbortSignal;
}

export type ReadAdapterErrorCode =
  | "invalid_input"
  | "unavailable"
  | "timeout"
  | "query_failed"
  | "cancelled";

export type LookupResult<TRecord> =
  | { readonly kind: "records"; readonly records: readonly TRecord[] }
  | { readonly kind: "not_found" }
  | { readonly kind: "ambiguous"; readonly matchCount: number }
  | { readonly kind: "error"; readonly code: ReadAdapterErrorCode };

export interface ReadOnlyMailServerAdapter<
  TDomainQuery,
  TDomainRecord,
  TMailboxQuery,
  TMailboxRecord,
  TAliasQuery,
  TAliasRecord,
> {
  lookupDomains(
    query: TDomainQuery,
    options?: ReadOperationOptions,
  ): Promise<LookupResult<TDomainRecord>>;
  lookupMailboxes(
    query: TMailboxQuery,
    options?: ReadOperationOptions,
  ): Promise<LookupResult<TMailboxRecord>>;
  lookupAliases(
    query: TAliasQuery,
    options?: ReadOperationOptions,
  ): Promise<LookupResult<TAliasRecord>>;
}
