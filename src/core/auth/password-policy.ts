export const ARGON2ID_PROFILE = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} as const;

export const MIN_PASSWORD_LENGTH = 15;
export const MAX_PASSWORD_LENGTH = 128;
export const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const LOGIN_FAILURE_LIMIT = 5;
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;

export function passwordConfirmationMatches(
  password: unknown,
  confirmation: unknown,
): boolean {
  return (
    typeof password === "string" &&
    typeof confirmation === "string" &&
    password === confirmation
  );
}
