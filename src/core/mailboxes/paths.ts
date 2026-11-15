import { validateDomain, validateLocalPart } from "@/core/mailboxes/validators";
import { lstatSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export class PathConfinementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathConfinementError";
  }
}

function assertInsideRoot(base: string, candidate: string, message: string) {
  const rel = relative(base, candidate);
  if (
    rel === "" ||
    (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))
  ) {
    return;
  }
  throw new PathConfinementError(message);
}

function tryRealpath(targetPath: string): string | null {
  try {
    return realpathSync(targetPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return null;
    }
    throw new PathConfinementError(
      "Unable to inspect confined storage path safely.",
    );
  }
}

/**
 * Resolves a path strictly confined under `root`.
 * Rejects path traversal, null bytes, non-relative segments, and any symlink along the path.
 */
export function confinedPath(root: string, ...parts: readonly string[]): string {
  if (!root || !root.trim()) {
    throw new PathConfinementError("Storage root path must be configured.");
  }

  for (const part of parts) {
    if (
      !part ||
      part.includes("\0") ||
      part === "." ||
      part === ".." ||
      part.includes("/") ||
      part.includes("\\") ||
      isAbsolute(part)
    ) {
      throw new PathConfinementError(
        "Unsafe path segment is not allowed in confined storage paths.",
      );
    }
  }

  const rootResolved = resolve(root);
  const rootReal = tryRealpath(rootResolved);
  if (rootReal !== null) {
    try {
      const rootStat = lstatSync(rootResolved);
      if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
        throw new PathConfinementError(
          "Storage root must be a real directory, not a symbolic link.",
        );
      }
    } catch (error) {
      if (error instanceof PathConfinementError) throw error;
      if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
        throw new PathConfinementError("Storage root is inaccessible.");
      }
    }
  }

  const effectiveRoot = rootReal ?? rootResolved;
  const unresolvedTarget = resolve(rootResolved, ...parts);
  assertInsideRoot(
    rootResolved,
    unresolvedTarget,
    "Resolved path is outside the configured storage root.",
  );

  const relSegments = relative(rootResolved, unresolvedTarget)
    .split(sep)
    .filter(Boolean);

  let current = rootResolved;
  for (const segment of relSegments) {
    current = join(current, segment);
    try {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink()) {
        throw new PathConfinementError(
          "Symbolic links are not allowed in confined storage paths.",
        );
      }
    } catch (error) {
      if (error instanceof PathConfinementError) throw error;
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        continue;
      }
      throw new PathConfinementError(
        "Unable to verify confined storage path safety.",
      );
    }
  }

  const targetReal = tryRealpath(unresolvedTarget);
  if (targetReal !== null) {
    assertInsideRoot(
      effectiveRoot,
      targetReal,
      "Resolved path is outside the configured storage root.",
    );
    return targetReal;
  }

  return unresolvedTarget;
}

export interface MailboxPathBundle {
  readonly domainName: string;
  readonly localPart: string;
  readonly mailboxRoot: string;
  readonly maildirPath: string;
  readonly relativePath: string;
}

export function buildMailboxPaths(
  localPart: string,
  domainName: string,
  mailStorageRoot: string,
  options: { readonly allowReserved?: boolean } = {},
): MailboxPathBundle {
  const normalizedLocal = validateLocalPart(localPart, options);
  const normalizedDomain = validateDomain(domainName);
  const mailboxRoot = confinedPath(
    mailStorageRoot,
    normalizedDomain,
    normalizedLocal,
  );
  const maildirPath = confinedPath(
    mailStorageRoot,
    normalizedDomain,
    normalizedLocal,
    "Maildir",
  );
  return {
    domainName: normalizedDomain,
    localPart: normalizedLocal,
    mailboxRoot,
    maildirPath,
    relativePath: `${normalizedDomain}/${normalizedLocal}/Maildir/`,
  };
}
