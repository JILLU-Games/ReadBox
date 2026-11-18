import { confinedPath, PathConfinementError } from "@/core/mailboxes/paths";
import { chmod, lstat, mkdir, open, rm, rmdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import lockfile from "proper-lockfile";
import "server-only";

export interface MaildirDeliveryIdentity {
  readonly uid?: number;
  readonly gid?: number;
}

/**
 * Verify the process UID/GID matches the delivery identity. No recursive chown
 * or silent permissions widening is permitted for existing mailbox data.
 */
export function resolveMaildirDeliveryIdentity(
  environment: { readonly MAILDIR_UID?: string; readonly MAILDIR_GID?: string } = {
    MAILDIR_UID: process.env.MAILDIR_UID,
    MAILDIR_GID: process.env.MAILDIR_GID,
  },
  processUid: number | undefined = process.getuid?.(),
  processGid: number | undefined = process.getgid?.(),
): MaildirDeliveryIdentity {
  function numericIdentity(value: string | undefined, key: string) {
    if (value === undefined || value === "") return undefined;
    const parsed = Number(value);
    if (!/^[1-9][0-9]{0,9}$/.test(value) || !Number.isSafeInteger(parsed)) {
      throw new ProvisioningError("filesystem", key + " must be a positive UID/GID.");
    }
    return parsed;
  }

  const uid = numericIdentity(environment.MAILDIR_UID, "MAILDIR_UID") ?? processUid;
  const gid = numericIdentity(environment.MAILDIR_GID, "MAILDIR_GID") ?? processGid;
  if (
    (uid !== undefined && processUid !== undefined && uid !== processUid) ||
    (gid !== undefined && processGid !== undefined && gid !== processGid)
  ) {
    throw new ProvisioningError(
      "filesystem",
      "Maildir delivery UID/GID differs from the application process identity.",
    );
  }
  return { uid, gid };
}

function assertMaildirOwnership(
  owner: { readonly uid: number; readonly gid: number },
  expected: MaildirDeliveryIdentity,
) {
  if (
    (expected.uid !== undefined && owner.uid !== expected.uid) ||
    (expected.gid !== undefined && owner.gid !== expected.gid)
  ) {
    throw new PathConfinementError(
      "Existing Maildir ownership conflicts with the configured delivery identity.",
    );
  }
}

export type ProvisioningStage =
  | "validation"
  | "lock"
  | "lock_filesystem"
  | "filesystem"
  | "database"
  | "status"
  | "purge";

export class ProvisioningError extends Error {
  readonly stage: ProvisioningStage;

  constructor(stage: ProvisioningStage, message: string) {
    super(message);
    this.name = "ProvisioningError";
    this.stage = stage;
  }
}

export interface ProvisionLockOptions {
  readonly timeoutMs?: number;
  readonly retries?: number;
}

export async function withProvisionLock<T>(
  lockRoot: string,
  lockKey: string,
  fn: () => Promise<T>,
  options: ProvisionLockOptions = {},
): Promise<T> {
  const safeKey = lockKey.replace(/[^a-z0-9._-]/gi, "_");
  let lockTargetPath: string;
  let lockDirPath: string;

  try {
    await mkdir(lockRoot, { recursive: true, mode: 0o700 });
    const rootStat = await lstat(lockRoot);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
      throw new PathConfinementError("Provisioning lock root is unsafe.");
    }
    await chmod(lockRoot, 0o700);
    lockTargetPath = confinedPath(lockRoot, `${safeKey}.locktarget`);
    lockDirPath = confinedPath(lockRoot, `${safeKey}.lock`);

    const handle = await open(lockTargetPath, "a", 0o600);
    await handle.close();
  } catch (error) {
    if (error instanceof PathConfinementError) {
      throw new ProvisioningError("lock_filesystem", error.message);
    }
    throw new ProvisioningError(
      "lock_filesystem",
      "Unable to prepare a safe mailbox provisioning lock.",
    );
  }

  let release: (() => Promise<void>) | undefined;
  try {
    release = await lockfile.lock(lockTargetPath, {
      lockfilePath: lockDirPath,
      stale: Math.max(5_000, options.timeoutMs ?? 15_000),
      retries:
        options.retries !== undefined
          ? {
              retries: options.retries,
              minTimeout: 50,
              maxTimeout: 150,
            }
          : {
              retries: 25,
              minTimeout: 100,
              maxTimeout: 600,
            },
    });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "ELOCKED") {
      throw new ProvisioningError(
        "lock",
        "Mailbox provisioning is already in progress for this address; try again.",
      );
    }
    throw new ProvisioningError(
      "lock_filesystem",
      "Unable to acquire a safe mailbox provisioning lock.",
    );
  }

  try {
    return await fn();
  } finally {
    try {
      await release();
    } catch {
      // Ignore release errors after critical section completes
    }
  }
}

async function ensureSingleDirectory(
  targetPath: string,
  mode: number,
  createdPaths: string[],
  identity: MaildirDeliveryIdentity,
): Promise<void> {
  try {
    await mkdir(targetPath, { mode });
    createdPaths.push(targetPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "EEXIST") {
      throw error;
    }
    const stat = await lstat(targetPath);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new PathConfinementError(`Unsafe mailbox path: ${targetPath}`);
    }
  }
  assertMaildirOwnership(await lstat(targetPath), identity);
  await chmod(targetPath, mode);
}

export async function createMaildirTree(input: {
  readonly mailStorageRoot: string;
  readonly domainName: string;
  readonly localPart: string;
}): Promise<{ readonly maildirPath: string; readonly createdPaths: string[] }> {
  const createdPaths: string[] = [];
  try {
    const identity = resolveMaildirDeliveryIdentity();
    await mkdir(input.mailStorageRoot, { recursive: true, mode: 0o750 });
    const rootStat = await lstat(input.mailStorageRoot);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
      throw new PathConfinementError(
        "Configured mail storage root must be a real directory.",
      );
    }
    assertMaildirOwnership(rootStat, identity);

    const domainRoot = confinedPath(input.mailStorageRoot, input.domainName);
    const mailboxRoot = confinedPath(
      input.mailStorageRoot,
      input.domainName,
      input.localPart,
    );
    const maildirPath = confinedPath(
      input.mailStorageRoot,
      input.domainName,
      input.localPart,
      "Maildir",
    );

    await ensureSingleDirectory(domainRoot, 0o750, createdPaths, identity);
    await ensureSingleDirectory(mailboxRoot, 0o700, createdPaths, identity);
    await ensureSingleDirectory(maildirPath, 0o700, createdPaths, identity);
    for (const child of ["new", "cur", "tmp"] as const) {
      await ensureSingleDirectory(join(maildirPath, child), 0o700, createdPaths, identity);
    }

    return { maildirPath, createdPaths };
  } catch (error) {
    await rollbackCreatedMaildirPaths(createdPaths);
    if (error instanceof ProvisioningError) throw error;
    if (error instanceof PathConfinementError) {
      throw new ProvisioningError("filesystem", error.message);
    }
    throw new ProvisioningError(
      "filesystem",
      "Unable to create the mailbox filesystem safely.",
    );
  }
}

export async function rollbackCreatedMaildirPaths(
  createdPaths: readonly string[],
): Promise<number> {
  let failures = 0;
  for (let index = createdPaths.length - 1; index >= 0; index -= 1) {
    const pathToRemove = createdPaths[index];
    try {
      await rmdir(pathToRemove);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        continue;
      }
      failures += 1;
    }
  }
  return failures;
}

export async function removeConfinedMailboxDirectory(
  mailStorageRoot: string,
  domainName: string,
  localPart: string,
): Promise<boolean> {
  try {
    const mailboxRoot = confinedPath(mailStorageRoot, domainName, localPart);
    const stat = await lstat(mailboxRoot);
    if (stat.isSymbolicLink()) {
      return false;
    }
    await rm(mailboxRoot, { recursive: true, force: true });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return true;
    }
    return false;
  }
}

export async function removeConfinedStoredAttachment(
  attachmentStorageRoot: string,
  storageRelativePath: string,
): Promise<boolean> {
  const trimmed = storageRelativePath.trim();
  if (!trimmed) return true;
  const segments = trimmed.split("/").filter(Boolean);
  if (segments.length === 0) return true;

  try {
    const resolved = confinedPath(attachmentStorageRoot, ...segments);
    const parent = dirname(resolved);
    const parentStat = await lstat(parent);
    if (parentStat.isSymbolicLink()) {
      return false;
    }
    await unlink(resolved);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return true;
    }
    return false;
  }
}
