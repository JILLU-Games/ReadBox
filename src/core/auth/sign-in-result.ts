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

export function getCredentialsSignInErrorMessage(
  result: SignInResponse | null | undefined,
): string {
  if (!result) {
    return "Sign-in did not receive a response from the server. Refresh the page and try again.";
  }

  if (result.error === "MissingCSRF") {
    return "Your browser blocked the sign-in security cookie. Allow cookies for this preview or open sign-in in a new tab.";
  }

  if (result.error === "Configuration") {
    return "Authentication is not configured correctly on the server.";
  }

  return "Sign-in failed. Check your username and password and try again.";
}
