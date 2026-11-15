import { ARGON2ID_PROFILE } from "@/core/auth/password-policy";
import { hash, verify, type Options } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import "server-only";

const hashOptions: Options = {
  algorithm: 2,
  memoryCost: ARGON2ID_PROFILE.memoryCost,
  timeCost: ARGON2ID_PROFILE.timeCost,
  parallelism: ARGON2ID_PROFILE.parallelism,
  outputLen: ARGON2ID_PROFILE.hashLength,
};

let dummyHashPromise: Promise<string> | undefined;

export function hashPassword(password: string): Promise<string> {
  return hash(password, hashOptions);
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
    await verify(await getDummyHash(), candidate).catch(() => false);
    return false;
  }

  try {
    return await verify(storedHash, candidate);
  } catch {
    return false;
  }
}
