const FIRST_NAMES = [
  "alex",
  "avery",
  "blake",
  "casey",
  "devon",
  "ellis",
  "finley",
  "harper",
  "jordan",
  "morgan",
  "parker",
  "quinn",
  "riley",
  "rowan",
  "skyler",
  "taylor",
] as const;

const LAST_NAMES = [
  "bennett",
  "brooks",
  "carter",
  "dawson",
  "foster",
  "hayes",
  "keller",
  "mercer",
  "miller",
  "morgan",
  "reed",
  "shaw",
  "turner",
  "walker",
  "ward",
  "wright",
] as const;

const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*()-_=+";
const ALL_PASSWORD_CHARS = `${LOWER}${UPPER}${DIGITS}${SYMBOLS}`;

export type RandomIntFn = (maxExclusive: number) => number;

export function secureRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError("maxExclusive must be a positive integer");
  }
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error("Cryptographically secure random generator is unavailable");
  }
  const range = 0x1_0000_0000;
  const limit = range - (range % maxExclusive);
  const buffer = new Uint32Array(1);
  let sample = 0;
  do {
    cryptoApi.getRandomValues(buffer);
    sample = buffer[0];
  } while (sample >= limit);
  return sample % maxExclusive;
}

function sanitizeUsernameSegment(value: string | undefined): string {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 32);
}

export function generateRandomUsername(
  options: { readonly firstName?: string; readonly lastName?: string } = {},
  randomInt: RandomIntFn = secureRandomInt,
): string {
  const first =
    sanitizeUsernameSegment(options.firstName) ||
    FIRST_NAMES[randomInt(FIRST_NAMES.length)];
  const last =
    sanitizeUsernameSegment(options.lastName) ||
    LAST_NAMES[randomInt(LAST_NAMES.length)];
  const suffix = 10 + randomInt(90);
  const base = first === last ? first : `${first}.${last}`;
  return `${base}${suffix}`.slice(0, 150);
}

export function generateSecurePassword(
  length = 16,
  randomInt: RandomIntFn = secureRandomInt,
): string {
  const targetLength = Math.max(15, Math.min(64, Math.floor(length)));
  const chars: string[] = [
    LOWER[randomInt(LOWER.length)],
    UPPER[randomInt(UPPER.length)],
    DIGITS[randomInt(DIGITS.length)],
    SYMBOLS[randomInt(SYMBOLS.length)],
  ];

  while (chars.length < targetLength) {
    chars.push(ALL_PASSWORD_CHARS[randomInt(ALL_PASSWORD_CHARS.length)]);
  }

  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    const current = chars[index];
    chars[index] = chars[swapIndex];
    chars[swapIndex] = current;
  }

  return chars.join("");
}
