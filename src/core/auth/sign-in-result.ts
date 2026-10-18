import type { SignInResponse } from "next-auth/react";

export function isSuccessfulCredentialsSignIn(
  result: SignInResponse | null | undefined,
): boolean {
  return (
    result?.ok === true &&
    !result.error &&
    typeof result.url === "string" &&
    result.url.length > 0
  );
}
