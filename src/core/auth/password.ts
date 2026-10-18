import { ARGON2ID_PROFILE } from "@/core/auth/password-policy";
import type { HashOptions } from "argon2";
import * as argon2 from "argon2";
import { randomBytes } from "node:crypto";
import "server-only";

const hashOptions: HashOptions = {
  type: argon2.argon2id,
  ...ARGON2ID_PROFILE,
};

let dummyHashPromise: Promise<string> | undefined;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, hashOptions);
}

async function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(randomBytes(32).toString("base64url"));
  return dummyHashPromise;
}

export async function verifyPassword(
  storedHash: string | null,
  candidate: string,
): Promise<boolean> {
  if (!storedHash) {
    await argon2.verify(await getDummyHash(), candidate).catch(() => false);
    return false;
  }

  try {
    return await argon2.verify(storedHash, candidate);
  } catch {
    return false;
  }
}
