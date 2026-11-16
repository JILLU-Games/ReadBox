import { sanitizeHtmlEmail } from "@/core/ingestion/sanitizer";
import { createHash } from "node:crypto";
import PostalMime, { type Address } from "postal-mime";

export interface ParsedAttachmentItem {
  readonly originalFilename: string;
  readonly content: Uint8Array;
  readonly declaredMimeType: string;
  readonly isInline: boolean;
  readonly contentId: string;
}

export interface ParsedEmailMessage {
  readonly messageIdHeader: string;
  readonly senderName: string;
  readonly senderAddress: string;
  readonly recipientAddresses: readonly string[];
  readonly ccAddresses: readonly string[];
  readonly subject: string;
  readonly receivedAt: Date | null;
  readonly textBody: string;
  readonly sanitizedHtmlBody: string;
  readonly attachments: readonly ParsedAttachmentItem[];
  readonly warnings: readonly string[];
  readonly parseFailed: boolean;
}

export interface ParseEmailOptions {
  readonly maxAttachmentsPerMessage?: number;
}

export function sha256Bytes(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function normalizeAddresses(
  entries: readonly Address[] | undefined,
): { readonly addresses: string[]; readonly names: string[] } {
  if (!entries || entries.length === 0) {
    return { addresses: [], names: [] };
  }
  const addresses: string[] = [];
  const names: string[] = [];

  for (const entry of entries) {
    if ("group" in entry && Array.isArray(entry.group)) {
      for (const member of entry.group) {
        if (member.address) {
          addresses.push(member.address.trim().toLowerCase().slice(0, 320));
          names.push((member.name ?? "").trim().slice(0, 500));
        }
      }
      continue;
    }
    if (entry.address) {
      addresses.push(entry.address.trim().toLowerCase().slice(0, 320));
      names.push((entry.name ?? "").trim().slice(0, 500));
    }
  }

  return { addresses, names };
}

function parseEmailDate(
  rawDate: string | undefined,
  warnings: string[],
): Date | null {
  if (!rawDate || !rawDate.trim()) {
    warnings.push("Missing Date header");
    return null;
  }
  const timestamp = Date.parse(rawDate);
  if (!Number.isFinite(timestamp)) {
    warnings.push("Invalid Date header");
    return null;
  }
  return new Date(timestamp);
}

export async function parseEmailMessage(
  raw: Uint8Array,
  options: ParseEmailOptions = {},
): Promise<ParsedEmailMessage> {
  const maxAttachments = options.maxAttachmentsPerMessage ?? 25;
  const warnings: string[] = [];

  if (raw.byteLength === 0) {
    return {
      messageIdHeader: "",
      senderName: "",
      senderAddress: "",
      recipientAddresses: [],
      ccAddresses: [],
      subject: "(No subject)",
      receivedAt: null,
      textBody: "",
      sanitizedHtmlBody: "",
      attachments: [],
      warnings: ["Empty raw message payload"],
      parseFailed: true,
    };
  }

  let parsed: Awaited<ReturnType<typeof PostalMime.parse>>;
  try {
    parsed = await PostalMime.parse(raw);
  } catch (error) {
    const errorType = error instanceof Error ? error.name : "MimeError";
    return {
      messageIdHeader: "",
      senderName: "",
      senderAddress: "",
      recipientAddresses: [],
      ccAddresses: [],
      subject: "(Unreadable message)",
      receivedAt: null,
      textBody: Buffer.from(raw).toString("utf8").slice(0, 100_000),
      sanitizedHtmlBody: "",
      attachments: [],
      warnings: [`MIME parser error: ${errorType}`],
      parseFailed: true,
    };
  }

  const fromNorm = normalizeAddresses(parsed.from ? [parsed.from] : []);
  const senderName = fromNorm.names[0] ?? "";
  const senderAddress = fromNorm.addresses[0] ?? "";
  if (!senderAddress) {
    warnings.push("Missing sender");
  }

  const toNorm = normalizeAddresses(parsed.to);
  const ccNorm = normalizeAddresses(parsed.cc);
  const receivedAt = parseEmailDate(parsed.date, warnings);

  const subject =
    (parsed.subject ?? "").trim().slice(0, 998) || "(No subject)";
  const messageIdHeader = (parsed.messageId ?? "").trim().slice(0, 998);

  const textBody = (parsed.text ?? "").trim();

  const attachments: ParsedAttachmentItem[] = [];
  const rawAttachments = Array.isArray(parsed.attachments)
    ? parsed.attachments
    : [];
  const inlineCidDataUris = new Map<string, string>();
  const inlineRasterTypes = new Set([
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
  ]);

  for (const item of rawAttachments) {
    if (attachments.length >= maxAttachments) {
      warnings.push(
        `Attachment count exceeded limit (${maxAttachments}); additional attachments were skipped`,
      );
      break;
    }

    let contentBytes: Uint8Array;
    if (typeof item.content === "string") {
      contentBytes = new TextEncoder().encode(item.content);
    } else if (item.content instanceof Uint8Array) {
      contentBytes = item.content;
    } else if (item.content instanceof ArrayBuffer) {
      contentBytes = new Uint8Array(item.content);
    } else {
      contentBytes = new Uint8Array();
    }

    const declaredMimeType = (item.mimeType ?? "application/octet-stream")
      .trim()
      .toLowerCase()
      .slice(0, 255);
    const normalizedMime =
      declaredMimeType === "image/jpg" ? "image/jpeg" : declaredMimeType;
    const contentId = (item.contentId ?? "").replace(/^<|>$/g, "").trim().slice(0, 998);

    if (
      contentId &&
      inlineRasterTypes.has(normalizedMime) &&
      contentBytes.byteLength > 0 &&
      contentBytes.byteLength <= 2 * 1024 * 1024
    ) {
      const dataUri = `data:${normalizedMime};base64,${Buffer.from(contentBytes).toString("base64")}`;
      inlineCidDataUris.set(contentId, dataUri);
      inlineCidDataUris.set(contentId.toLowerCase(), dataUri);
    }

    attachments.push({
      originalFilename: (item.filename ?? "").trim() || "attachment.bin",
      content: contentBytes,
      declaredMimeType,
      isInline: item.disposition === "inline",
      contentId,
    });
  }

  let htmlSource = parsed.html ?? "";
  if (htmlSource && inlineCidDataUris.size > 0) {
    htmlSource = htmlSource.replace(
      /(<img\b[^>]*?\bsrc\s*=\s*["'])cid:([^"']+)(["'])/gi,
      (fullMatch, prefix: string, rawCid: string, suffix: string) => {
        const cleanedCid = rawCid.replace(/^<|>$/g, "").trim();
        const dataUri =
          inlineCidDataUris.get(cleanedCid) ??
          inlineCidDataUris.get(cleanedCid.toLowerCase());
        return dataUri ? `${prefix}${dataUri}${suffix}` : fullMatch;
      },
    );
  }

  const sanitizedHtmlBody = htmlSource
    ? sanitizeHtmlEmail(htmlSource)
    : "";

  if (!textBody && !sanitizedHtmlBody && attachments.length === 0) {
    warnings.push("Empty message body");
  }

  return {
    messageIdHeader,
    senderName,
    senderAddress,
    recipientAddresses: toNorm.addresses,
    ccAddresses: ccNorm.addresses,
    subject,
    receivedAt,
    textBody,
    sanitizedHtmlBody,
    attachments,
    warnings,
    parseFailed: false,
  };
}
