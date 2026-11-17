import { readOpenDkimRecord } from "@/core/dns/opendkim";
import {
  buildExpectedDnsRecords,
  type DnsRecordType,
  type ExpectedDnsRecord,
} from "@/core/dns/records";
import { validateDomain } from "@/core/mailboxes/validators";
import { Resolver } from "node:dns/promises";
import "server-only";

export class DnsVerificationError extends Error {
  readonly code: "timeout" | "unavailable" | "malformed";

  constructor(
    code: "timeout" | "unavailable" | "malformed",
    message: string,
  ) {
    super(message);
    this.name = "DnsVerificationError";
    this.code = code;
  }
}

export interface DnsLookupPort {
  resolve(name: string, recordType: DnsRecordType): Promise<readonly string[]>;
}

export type CheckedDnsRecordStatus =
  | "verified"
  | "missing"
  | "unavailable"
  | "error";

export interface CheckedDnsRecord extends ExpectedDnsRecord {
  readonly status: CheckedDnsRecordStatus;
  readonly observed: readonly string[];
}

export interface RoutingVerificationResult {
  readonly verified: boolean;
  readonly mxOk: boolean;
  readonly targetOk: boolean;
  readonly mx: readonly string[];
  readonly target: string;
  readonly targetAddresses: readonly string[];
  readonly message: string;
  readonly errorCode?: string;
}

export interface FullDnsVerificationResult {
  readonly routingVerified: boolean;
  readonly allVerified: boolean;
  readonly records: readonly CheckedDnsRecord[];
  readonly message: string;
  readonly lookupFailed: boolean;
}

function normalizeHostAnswer(value: string): string {
  return value.trim().replace(/\.+$/, "").toLowerCase();
}

export function createNodeDnsLookup(timeoutSeconds = 3): DnsLookupPort {
  const timeoutMs = Math.max(500, Math.round(timeoutSeconds * 1000));

  return {
    async resolve(
      name: string,
      recordType: DnsRecordType,
    ): Promise<readonly string[]> {
      const resolver = new Resolver();
      let timer: ReturnType<typeof setTimeout> | undefined;

      const lookupPromise = (async (): Promise<readonly string[]> => {
        try {
          if (recordType === "MX") {
            const entries = await resolver.resolveMx(name);
            return entries.map((entry) => entry.exchange);
          }
          if (recordType === "A") {
            return await resolver.resolve4(name);
          }
          if (recordType === "AAAA") {
            return await resolver.resolve6(name);
          }
          const txtRows = await resolver.resolveTxt(name);
          return txtRows.map((chunks) => chunks.join(""));
        } catch (error) {
          const code = (error as NodeJS.ErrnoException)?.code;
          if (code === "ENODATA" || code === "ENOTFOUND") {
            return [];
          }
          if (code === "ECANCELLED" || code === "ETIMEOUT") {
            throw new DnsVerificationError(
              "timeout",
              "DNS lookup timed out.",
            );
          }
          throw new DnsVerificationError(
            "unavailable",
            "DNS lookup was unavailable.",
          );
        }
      })();

      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          resolver.cancel();
          reject(new DnsVerificationError("timeout", "DNS lookup timed out."));
        }, timeoutMs);
      });

      try {
        return await Promise.race([lookupPromise, timeoutPromise]);
      } finally {
        if (timer !== undefined) {
          clearTimeout(timer);
        }
      }
    },
  };
}

export interface DnsVerifyOptions {
  readonly mailHostname: string;
  readonly serverIp: string;
  readonly opendkimKeysRoot: string;
  readonly timeoutSeconds?: number;
  readonly lookup?: DnsLookupPort;
}

export async function getExpectedDnsRecordsForDomain(
  domain: string,
  options: Pick<
    DnsVerifyOptions,
    "mailHostname" | "serverIp" | "opendkimKeysRoot"
  >,
): Promise<readonly ExpectedDnsRecord[]> {
  const normalizedDomain = validateDomain(domain);
  const dkim = await readOpenDkimRecord(
    normalizedDomain,
    options.opendkimKeysRoot,
  );
  return buildExpectedDnsRecords(normalizedDomain, {
    mailHostname: options.mailHostname,
    serverIp: options.serverIp,
    dkim,
  });
}

export async function verifyRoutingDns(
  domain: string,
  options: Pick<DnsVerifyOptions, "mailHostname" | "timeoutSeconds" | "lookup"> & {
    readonly expectedServerIp?: string;
  },
): Promise<RoutingVerificationResult> {
  const lookup =
    options.lookup ?? createNodeDnsLookup(options.timeoutSeconds ?? 3);
  const expectedMx = normalizeHostAnswer(options.mailHostname);

  try {
    const normalizedDomain = validateDomain(domain);
    const [mxAnswers, ipv4Answers, ipv6Answers] = await Promise.all([
      lookup.resolve(normalizedDomain, "MX"),
      lookup.resolve(expectedMx, "A"),
      lookup.resolve(expectedMx, "AAAA"),
    ]);

    const normalizedMx = Array.from(
      new Set(mxAnswers.map(normalizeHostAnswer).filter(Boolean)),
    ).sort();
    const targetAddresses = Array.from(
      new Set(
        [...ipv4Answers, ...ipv6Answers]
          .map((addr) => addr.trim().toLowerCase())
          .filter(Boolean),
      ),
    ).sort();

    const mxOk = normalizedMx.includes(expectedMx);
    const hasExpectedIpParam = options.expectedServerIp !== undefined;
    const targetIp = options.expectedServerIp?.trim().toLowerCase() ?? "";
    const isLoopbackDefault =
      targetIp === "127.0.0.1" || targetIp === "::1" || targetIp === "0.0.0.0";

    const targetOk = hasExpectedIpParam
      ? targetIp.length > 0 &&
        !isLoopbackDefault &&
        targetAddresses.includes(targetIp)
      : targetAddresses.length > 0;
    const verified = mxOk && targetOk;

    let message = "Required MX and mail-host records match.";
    if (!verified) {
      if (hasExpectedIpParam && (!targetIp || isLoopbackDefault)) {
        message =
          "Configure a public non-loopback SERVER_IP before verifying mail-host A/AAAA routing records.";
      } else {
        message = "Required MX or mail-host records are missing or incorrect.";
      }
    }

    return {
      verified,
      mxOk,
      targetOk,
      mx: normalizedMx,
      target: expectedMx,
      targetAddresses,
      message,
    };
  } catch (error) {
    return {
      verified: false,
      mxOk: false,
      targetOk: false,
      mx: [],
      target: expectedMx,
      targetAddresses: [],
      message: "DNS verification could not complete safely.",
      errorCode:
        error instanceof DnsVerificationError ? error.code : "lookup_error",
    };
  }
}

export async function verifyAllDnsRecords(
  domain: string,
  options: DnsVerifyOptions,
): Promise<FullDnsVerificationResult> {
  const lookup =
    options.lookup ?? createNodeDnsLookup(options.timeoutSeconds ?? 3);
  const expectedRecords = await getExpectedDnsRecordsForDomain(domain, options);
  let lookupFailed = false;

  const checkedRecords: CheckedDnsRecord[] = await Promise.all(
    expectedRecords.map(async (record): Promise<CheckedDnsRecord> => {
      if (!record.copyable) {
        return {
          ...record,
          status: "unavailable",
          observed: [],
        };
      }

      try {
        const answers = await lookup.resolve(record.host, record.type);
        const cleanAnswers = answers.map((item) => item.trim()).filter(Boolean);
        let matched = false;

        if (record.type === "MX") {
          const expectedHost = normalizeHostAnswer(record.value);
          matched = cleanAnswers
            .map(normalizeHostAnswer)
            .includes(expectedHost);
        } else if (record.type === "A" || record.type === "AAAA") {
          const expectedIp = record.value.trim().toLowerCase();
          matched = cleanAnswers
            .map((item) => item.toLowerCase())
            .includes(expectedIp);
        } else {
          matched = cleanAnswers.includes(record.value);
        }

        return {
          ...record,
          status: matched ? "verified" : "missing",
          observed: cleanAnswers,
        };
      } catch {
        lookupFailed = true;
        return {
          ...record,
          status: "error",
          observed: [],
        };
      }
    }),
  );

  const routingRecords = checkedRecords.filter(
    (record) => record.category === "routing",
  );
  const routingVerified =
    routingRecords.length > 0 &&
    routingRecords.every((record) => record.status === "verified");
  const allVerified =
    checkedRecords.length > 0 &&
    checkedRecords.every((record) => record.status === "verified");

  const message = lookupFailed
    ? "DNS verification could not complete safely."
    : allVerified
      ? "All routing and deliverability DNS records match."
      : routingVerified
        ? "Required routing records (MX + A/AAAA) match; deliverability records need attention."
        : "Required routing DNS records are missing or incorrect.";

  return {
    routingVerified,
    allVerified,
    records: checkedRecords,
    message,
    lookupFailed,
  };
}
