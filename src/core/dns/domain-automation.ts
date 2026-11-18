import { callBackupAgent, BackupAgentError } from "@/core/backup/agent-client";
import {
  DkimProvisionError, requestDkimProvision, validateDkimRsaRecord,
} from "./dkim-provision";
import { readOpenDkimRecord } from "./opendkim";
import {
  DomainAutomationError, resolveSelectedCloudflareZone, publishManagedDomainDns,
} from "./cloudflare-auto";
import { validateDomain } from "@/core/mailboxes/validators";
import { isIP } from "node:net";
import "server-only";

export interface DomainSetupResult {
  readonly provision: "created" | "existing";
  readonly dns: "created" | "existing" | "manual";
  readonly zone?: string;
  readonly createdRecords?: number;
}

/** Safe to re-enter after any failed phase. Never rotates existing keys. */
export async function automateDomainSetup(
  domainInput: string,
  settings: {
    readonly publish: boolean;
    readonly zoneId?: string;
    readonly opendkimKeysRoot: string;
    readonly mailHostname: string;
    readonly serverIp: string;
  },
): Promise<DomainSetupResult> {
  const domain = validateDomain(domainInput);
  const mailHostname = validateDomain(settings.mailHostname);
  if (!isIP(settings.serverIp) ||
      ["127.0.0.1", "0.0.0.0", "::1", "::"].includes(settings.serverIp)) {
    throw new DomainAutomationError("PUBLIC_MAIL_IP_REQUIRED");
  }
  // Refuse to generate private keys when the requested automatic Cloudflare
  // zone is not configured, active or visible to this scoped token.
  const zone = settings.publish ?
    await resolveSelectedCloudflareZone(domain, settings.zoneId ?? "") : null;
  try {
    await requestDkimProvision(domain);
  } catch (error) {
    if (!(error instanceof DkimProvisionError && error.code === "ESCROW_REQUIRED")) {
      throw error;
    }
    // Expected on first use: offline agent stages only the private key.
  }
  try {
    const receipt = await callBackupAgent("dkim.escrow", { domain });
    if (!["verified", "verified_existing"].includes(receipt.escrow ?? "")) {
      throw new DomainAutomationError("DKIM_R2_ESCROW_UNVERIFIED");
    }
  } catch (error) {
    if (error instanceof DomainAutomationError) throw error;
    if (error instanceof BackupAgentError) {
      throw new DomainAutomationError(error.code);
    }
    throw new DomainAutomationError("DKIM_R2_ESCROW_UNAVAILABLE");
  }
  // Publication is forbidden by the DKIM agent until the root-only R2
  // readback receipt exists and matches this exact unrotated key.
  const provision = await requestDkimProvision(domain);
  const publicRecord = await readOpenDkimRecord(domain, settings.opendkimKeysRoot);
  if (!publicRecord.available) throw new DomainAutomationError("DKIM_PUBLIC_KEY_UNAVAILABLE");
  validateDkimRsaRecord(publicRecord.value);
  if (!zone) return { provision, dns: "manual" };
  const result = await publishManagedDomainDns(domain, zone, {
    mailHostname, serverIp: settings.serverIp, dkimRecord: publicRecord.value,
  });
  return {
    provision,
    dns: result.created ? "created" : "existing",
    zone: result.zone,
    createdRecords: result.created,
  };
}

/** User-safe error codes: no domains, credentials, key data or raw network bodies. */
export function domainSetupErrorCode(error: unknown): string {
  if (error instanceof DomainAutomationError || error instanceof DkimProvisionError) {
    return error.code;
  }
  return "DOMAIN_AUTOMATION_UNAVAILABLE";
}
