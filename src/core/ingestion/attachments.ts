import { sha256Bytes } from "@/core/ingestion/parser";
import { safeAttachmentFilename } from "@/core/ingestion/sanitizer";
import { confinedPath, PathConfinementError } from "@/core/mailboxes/paths";
import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, open, unlink } from "node:fs/promises";
import { extname } from "node:path";
import "server-only";

export class AttachmentTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttachmentTooLargeError";
  }
}

export interface StoredAttachmentResult {
  readonly safeFilename: string;
  readonly storedFilename: string;
  readonly storageRelativePath: string;
  readonly detectedMimeType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".zip": "application/zip",
  ".gz": "application/gzip",
  ".tar": "application/x-tar",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".eml": "message/rfc822",
};

export function detectSafeMimeType(
  safeFilename: string,
  declaredMimeType?: string,
): string {
  const ext = extname(safeFilename).toLowerCase();
  if (ext && MIME_BY_EXTENSION[ext]) {
    return MIME_BY_EXTENSION[ext];
  }
  const declared = (declaredMimeType ?? "").trim().toLowerCase();
  if (declared && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(declared)) {
    return declared;
  }
  return "application/octet-stream";
}

export async function storeConfinedAttachment(
  content: Uint8Array,
  originalFilename: string,
  options: {
    readonly attachmentStorageRoot: string;
    readonly maxAttachmentSizeMb: number;
    readonly declaredMimeType?: string;
  },
): Promise<StoredAttachmentResult> {
  const maxBytes = options.maxAttachmentSizeMb * 1024 * 1024;
  if (content.byteLength > maxBytes) {
    throw new AttachmentTooLargeError(
      `Attachment exceeds ${options.maxAttachmentSizeMb} MB`,
    );
  }

  const safeName = safeAttachmentFilename(originalFilename);
  const storedName = `${randomUUID().replace(/-/g, "")}.bin`;
  const shard = storedName.slice(0, 2);
  const storageRelativePath = `${shard}/${storedName}`;

  await mkdir(options.attachmentStorageRoot, { recursive: true, mode: 0o700 });
  const rootStat = await lstat(options.attachmentStorageRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new PathConfinementError(
      "Configured attachment storage root must be a real directory.",
    );
  }

  const shardDir = confinedPath(options.attachmentStorageRoot, shard);
  await mkdir(shardDir, { recursive: true, mode: 0o700 });
  const shardStat = await lstat(shardDir);
  if (shardStat.isSymbolicLink() || !shardStat.isDirectory()) {
    throw new PathConfinementError("Attachment shard directory is unsafe.");
  }
  await chmod(shardDir, 0o700);

  const filePath = confinedPath(
    options.attachmentStorageRoot,
    shard,
    storedName,
  );
  const handle = await open(filePath, "wx", 0o600);
  try {
    await handle.writeFile(content);
    await handle.sync();
  } catch (error) {
    await handle.close().catch(() => undefined);
    await unlink(filePath).catch(() => undefined);
    throw error;
  }
  await handle.close();

  return {
    safeFilename: safeName,
    storedFilename: storedName,
    storageRelativePath,
    detectedMimeType: detectSafeMimeType(safeName, options.declaredMimeType),
    sizeBytes: content.byteLength,
    sha256: sha256Bytes(content),
  };
}
