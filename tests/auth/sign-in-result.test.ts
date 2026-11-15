import {
  getCredentialsSignInErrorMessage,
  isSuccessfulCredentialsSignIn,
} from "@/core/auth/sign-in-result";
import type { SignInResponse } from "next-auth/react";
import assert from "node:assert/strict";
import { test } from "node:test";

test("HTTP 200 Credentials errors do not count as successful sign-in", () => {
  const result: SignInResponse = {
    error: "CredentialsSignin",
    code: "credentials",
    status: 200,
    ok: true,
    url: null,
  };

  assert.equal(isSuccessfulCredentialsSignIn(result), false);
});

test("successful Credentials responses are eligible for redirect", () => {
  const result: SignInResponse = {
    error: undefined,
    code: undefined,
    status: 200,
    ok: true,
    url: "http://127.0.0.1:3000/users",
  };

  assert.equal(isSuccessfulCredentialsSignIn(result), true);
});

test("getCredentialsSignInErrorMessage explains CSRF, configuration, empty, and invalid credentials", () => {
  assert.match(getCredentialsSignInErrorMessage(undefined), /no response|did not receive a response/i);
  assert.match(
    getCredentialsSignInErrorMessage({
      error: "MissingCSRF",
      code: undefined,
      status: 200,
      ok: true,
      url: null,
    }),
    /cookie/i,
  );
  assert.match(
    getCredentialsSignInErrorMessage({
      error: "Configuration",
      code: undefined,
      status: 200,
      ok: true,
      url: null,
    }),
    /configured/i,
  );
  assert.match(
    getCredentialsSignInErrorMessage({
      error: "CredentialsSignin",
      code: "credentials",
      status: 200,
      ok: true,
      url: null,
    }),
    /username and password/i,
  );
});
