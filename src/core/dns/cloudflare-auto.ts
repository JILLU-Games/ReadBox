import { buildExpectedDnsRecords, type ExpectedDnsRecord } from "./records";
import { validateDomain } from "@/core/mailboxes/validators";
import "server-only";

const API = "https://api.cloudflare.com/client/v4";
const ZONE_ID = /^[0-9a-f]{32}$/i;

export class DomainAutomationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "DomainAutomationError";
  }
}

type RemoteRecord = {
  readonly id?: string;
  readonly type?: string;
  readonly name?: string;
  readonly content?: string;
  readonly priority?: number;
  readonly proxied?: boolean;
};
type ApiReply = {
  readonly success?: boolean;
  readonly result?: unknown;
  readonly result_info?: { readonly total_count?: number };
};
export interface ZoneContext {
  readonly name: string;
  readonly id: string;
  readonly token: string;
  readonly fetchImpl: typeof fetch;
}
export interface DnsPublishResult {
  readonly created: number;
  readonly existing: number;
  readonly zone: string;
}

async function request(
  zone: Pick<ZoneContext, "token" | "fetchImpl">,
  path: string,
  method: "GET" | "POST" = "GET",
  body?: object,
): Promise<ApiReply> {
  let response: Response;
  try {
    response = await zone.fetchImpl(API + path, {
      method,
      headers: {
        Authorization: "Bearer " + zone.token,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new DomainAutomationError("CLOUDFLARE_UNAVAILABLE");
  }
  if (!response.ok) {
    throw new DomainAutomationError(response.status === 403
      ? "CLOUDFLARE_PERMISSION_REQUIRED" : "CLOUDFLARE_REQUEST_FAILED");
  }
  let data: ApiReply;
  try {
    data = await response.json() as ApiReply;
  } catch {
    throw new DomainAutomationError("CLOUDFLARE_INVALID_REPLY");
  }
  if (!data?.success) throw new DomainAutomationError("CLOUDFLARE_REQUEST_FAILED");
  return data;
}

/** Look up the exact managed zone; never guess an account or write another zone. */
export async function findCloudflareZone(
  rawDomain: string,
  options: { readonly token?: string; readonly fetchImpl?: typeof fetch } = {},
): Promise<ZoneContext> {
  const domain = validateDomain(rawDomain);
  const token = options.token ?? process.env.READBOX_CF_DNS_TOKEN ?? "";
  if (!token) throw new DomainAutomationError("CLOUDFLARE_DNS_NOT_CONFIGURED");
  const fetchImpl = options.fetchImpl ?? fetch;
  const labels = domain.split(".");
  for (let i = 0; i <= labels.length - 2; i++) {
    const candidate = labels.slice(i).join(".");
    const reply = await request({ token, fetchImpl },
      "/zones?name=" + encodeURIComponent(candidate) + "&per_page=50");
    if (!Array.isArray(reply.result) ||
        (reply.result_info?.total_count ?? reply.result.length) > 50) {
      throw new DomainAutomationError("CLOUDFLARE_ZONE_AMBIGUOUS");
    }
    const exact = (reply.result as Array<{
      id?: string; name?: string; status?: string;
    }>).filter((item) => item?.name === candidate);
    if (exact.length > 1) throw new DomainAutomationError("CLOUDFLARE_ZONE_AMBIGUOUS");
    if (exact.length === 1) {
      if (exact[0].status !== "active" || !ZONE_ID.test(exact[0].id ?? "")) {
        throw new DomainAutomationError("CLOUDFLARE_ZONE_NOT_ACTIVE");
      }
      return { name: candidate, id: exact[0].id!, token, fetchImpl };
    }
  }
  throw new DomainAutomationError("CLOUDFLARE_ZONE_NOT_FOUND");
}

async function recordsAt(zone: ZoneContext, fqdn: string): Promise<RemoteRecord[]> {
  const reply = await request(zone, "/zones/" + zone.id + "/dns_records?name=" +
    encodeURIComponent(fqdn) + "&per_page=100");
  if (!Array.isArray(reply.result) ||
      (reply.result_info?.total_count ?? reply.result.length) > 100) {
    throw new DomainAutomationError("CLOUDFLARE_RECORD_SET_UNSAFE");
  }
  const records = reply.result as RemoteRecord[];
  if (records.some((r) =>
    !r || r.name !== fqdn || typeof r.type !== "string" ||
    typeof r.content !== "string")) {
    throw new DomainAutomationError("CLOUDFLARE_INVALID_REPLY");
  }
  return records;
}

function recordIsSame(existing: RemoteRecord, required: ExpectedDnsRecord): boolean {
  if (existing.type !== required.type || existing.name !== required.host ||
      existing.content?.replace(/\.$/, "") !== required.value.replace(/\.$/, "")) {
    return false;
  }
  if (required.type === "MX") return existing.priority === Number(required.priority);
  if (required.type === "A" || required.type === "AAAA") {
    return existing.proxied === false;
  }
  return true;
}

function isRelevant(existing: RemoteRecord, required: ExpectedDnsRecord): boolean {
  if (existing.type === "CNAME") return true;
  if (required.type === "TXT") {
    if (required.host.startsWith("mail._domainkey.")) return existing.type === "TXT";
    if (required.host.startsWith("_dmarc.")) {
      return existing.type === "TXT" && /^v=DMARC1(?:;|$)/i.test(existing.content ?? "");
    }
    return existing.type === "TXT" && /^v=spf1(?:\s|$)/i.test(existing.content ?? "");
  }
  return existing.type === required.type;
}

function insideZone(host: string, zone: string): boolean {
  return host === zone || host.endsWith("." + zone);
}

/**
 * Preflight ALL intended names before the first write. Existing different
 * ownership, SPF, MX, DMARC or DKIM is never overwritten or deleted.
 * An interrupted create is safely reconciled by the next idempotent call.
 */
export async function publishManagedDomainDns(
  domainInput: string,
  zone: ZoneContext,
  settings: {
    readonly mailHostname: string;
    readonly serverIp: string;
    readonly dkimRecord: string;
  },
): Promise<DnsPublishResult> {
  const domain = validateDomain(domainInput);
  if (!insideZone(domain, zone.name) || !ZONE_ID.test(zone.id)) {
    throw new DomainAutomationError("CLOUDFLARE_ZONE_MISMATCH");
  }
  const expected = buildExpectedDnsRecords(domain, {
    mailHostname: settings.mailHostname,
    serverIp: settings.serverIp,
    dkim: { copyable: true, value: settings.dkimRecord },
  });
  const desired = expected.filter((r) => insideZone(r.host, zone.name));
  const byName = new Map<string, RemoteRecord[]>();
  for (const item of desired) {
    if (!byName.has(item.host)) byName.set(item.host, await recordsAt(zone, item.host));
  }
  let existing = 0;
  const pending: ExpectedDnsRecord[] = [];
  for (const item of desired) {
    const matchingType = (byName.get(item.host) ?? [])
      .filter((r) => isRelevant(r, item));
    if (matchingType.length === 0) {
      pending.push(item);
    } else if (matchingType.length === 1 && recordIsSame(matchingType[0], item)) {
      existing++;
    } else {
      throw new DomainAutomationError("CLOUDFLARE_DNS_RECORD_CONFLICT");
    }
  }
  let created = 0;
  for (const item of pending) {
    const body: Record<string, unknown> = {
      type: item.type,
      name: item.host,
      content: item.value,
      ttl: 300,
    };
    if (item.type === "MX") body.priority = Number(item.priority);
    if (item.type === "A" || item.type === "AAAA") body.proxied = false;
    try {
      await request(zone, "/zones/" + zone.id + "/dns_records", "POST", body);
    } catch (error) {
      // Lost acknowledgement: read-back is required before accepting success.
      const current = await recordsAt(zone, item.host).catch(() => []);
      if (!current.some((r) => recordIsSame(r, item))) throw error;
    }
    const confirmed = await recordsAt(zone, item.host);
    if (!confirmed.some((r) => recordIsSame(r, item))) {
      throw new DomainAutomationError("CLOUDFLARE_DNS_READBACK_FAILED");
    }
    created++;
  }
  return { zone: zone.name, created, existing };
}
