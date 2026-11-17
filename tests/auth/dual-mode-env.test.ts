import { parseEnvironment } from "@/config/env-schema";
import {
  DatabaseConfigurationError,
  DatabaseUnavailableError,
  resolvePrismaClient,
} from "@/core/database/client";
import {
  authorizeDevDemoCredentials,
  clearDevDemoSessions,
  DEV_DEMO_ACCOUNTS,
  getActiveDevDemoSession,
  getDevBypassUser,
  getDevDemoUserById,
  registerDevDemoSession,
  revokeDevDemoSession,
} from "@/core/auth/dev-demo-auth";
import { createOpaqueToken } from "@/core/auth/opaque-token";
import {
  extractClientIp,
  isHttpsProxyRequest,
  resolveAuthRequestUrl,
} from "@/core/auth/proxy-request";
import { getAuthCookiePolicy } from "@/core/auth/runtime-policy";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

const VALID_SECRET = "s".repeat(32);
const VALID_DB_URL = "postgresql://readbox:secret@127.0.0.1:5432/readbox_prod";

afterEach(() => {
  clearDevDemoSessions();
});

test("getAuthCookiePolicy uses SameSite=None; Secure; Partitioned for HTTPS dev iframes and strict Lax in prod/HTTP", () => {
  const localHttp = getAuthCookiePolicy({
    nodeEnv: "development",
    isHttpsRequest: false,
  });
  assert.equal(localHttp.sameSite, "lax");
  assert.equal(localHttp.secure, false);
  assert.equal(localHttp.partitioned, false);
  assert.equal(localHttp.sessionCookieName, "authjs.session-token");

  const devHttpsIframe = getAuthCookiePolicy({
    nodeEnv: "development",
    isHttpsRequest: true,
  });
  assert.equal(devHttpsIframe.sameSite, "none");
  assert.equal(devHttpsIframe.secure, true);
  assert.equal(devHttpsIframe.partitioned, true);
  assert.equal(devHttpsIframe.sessionCookieName, "authjs.session-token");

  const prodHttps = getAuthCookiePolicy({
    nodeEnv: "production",
    isHttpsRequest: true,
  });
  assert.equal(prodHttps.sameSite, "lax");
  assert.equal(prodHttps.secure, true);
  assert.equal(prodHttps.partitioned, false);
  assert.equal(prodHttps.sessionCookieName, "__Secure-authjs.session-token");
});

test("isHttpsProxyRequest detects HTTPS preview traffic even without x-forwarded-proto", () => {
  assert.equal(
    isHttpsProxyRequest(
      new Headers({ host: "localhost:3000" }),
      "http://localhost:3000/api/auth/csrf",
      "development",
    ),
    false,
  );
  assert.equal(
    isHttpsProxyRequest(
      new Headers({
        host: "127.0.0.1:3000",
        referer: "https://ais-dev-example.asia-southeast1.run.app/sign-in",
      }),
      "http://127.0.0.1:3000/api/auth/csrf",
      "development",
    ),
    true,
  );
  assert.equal(
    isHttpsProxyRequest(
      new Headers({
        host: "127.0.0.1:3000",
        cookie: "__SECURE-aistudio_auth_flow_may_set_cookies=true",
      }),
      "http://127.0.0.1:3000/api/auth/csrf",
      "development",
    ),
    true,
  );
  assert.equal(
    isHttpsProxyRequest(
      new Headers({ host: "ais-dev-example.asia-southeast1.run.app" }),
      "http://0.0.0.0:3000/api/auth/csrf",
      "development",
    ),
    true,
  );
  assert.equal(
    isHttpsProxyRequest(
      new Headers({ forwarded: "for=1.2.3.4;proto=https" }),
      "http://0.0.0.0:3000/api/auth/csrf",
      "production",
    ),
    true,
  );
});

test("resolveAuthRequestUrl normalizes wildcard dev origin behind reverse proxies when trusted", () => {
  const headers = new Headers({
    host: "0.0.0.0:3000",
    "x-forwarded-host": "ais-dev-example.asia-southeast1.run.app",
    "x-forwarded-proto": "https",
  });

  assert.equal(
    resolveAuthRequestUrl("http://0.0.0.0:3000/api/auth/providers", headers, {
      trustForwardedHeaders: true,
    }),
    "https://ais-dev-example.asia-southeast1.run.app/api/auth/providers",
  );

  assert.equal(
    resolveAuthRequestUrl("http://0.0.0.0:3000/api/auth/providers", headers, {
      trustForwardedHeaders: false,
    }),
    "http://0.0.0.0:3000/api/auth/providers",
  );

  const unsafeHeaders = new Headers({
    "x-forwarded-host": "evil.example/@attacker",
    "x-forwarded-proto": "https",
  });
  assert.equal(
    resolveAuthRequestUrl(
      "http://0.0.0.0:3000/api/auth/csrf",
      unsafeHeaders,
      { trustForwardedHeaders: true },
    ),
    "https://0.0.0.0:3000/api/auth/csrf",
  );
});

test("parseEnvironment supports development modes and defaults safely to off", () => {
  const defaults = parseEnvironment({});
  assert.equal(defaults.nodeEnv, "development");
  assert.equal(defaults.authEnabled, false);
  assert.equal(defaults.devAuthMode, "off");
  assert.equal(defaults.devAuthRole, "admin");

  const bypassEnv = parseEnvironment({
    NODE_ENV: "development",
    DEV_AUTH_MODE: "bypass",
    DEV_AUTH_ROLE: "user",
  });
  assert.equal(bypassEnv.devAuthMode, "bypass");
  assert.equal(bypassEnv.devAuthRole, "user");

  const demoEnv = parseEnvironment({
    NODE_ENV: "development",
    DEV_AUTH_MODE: "demo",
  });
  assert.equal(demoEnv.devAuthMode, "demo");
});

test("parseEnvironment clamps dev auth modes to off and requires DB/secret in production", () => {
  const clampedBypass = parseEnvironment({
    NODE_ENV: "production",
    DEV_AUTH_MODE: "bypass",
  });
  assert.equal(clampedBypass.devAuthMode, "off");

  const clampedDemo = parseEnvironment({
    NODE_ENV: "production",
    DEV_AUTH_MODE: "demo",
  });
  assert.equal(clampedDemo.devAuthMode, "off");

  assert.throws(
    () =>
      parseEnvironment({
        NODE_ENV: "production",
        AUTH_ENABLED: "true",
        AUTH_SECRET: VALID_SECRET,
      }),
    /DATABASE_URL/,
  );

  const prodValid = parseEnvironment({
    NODE_ENV: "production",
    AUTH_ENABLED: "true",
    AUTH_SECRET: VALID_SECRET,
    DATABASE_URL: VALID_DB_URL,
    AUTH_TRUST_HOST: "true",
  });
  assert.equal(prodValid.nodeEnv, "production");
  assert.equal(prodValid.authEnabled, true);
  assert.equal(prodValid.authTrustHost, true);
  assert.equal(prodValid.devAuthMode, "off");
});

test("dev demo auth works only in development and tracks session lifecycle", () => {
  const adminAccount = DEV_DEMO_ACCOUNTS.find((a) => a.isAdministrator)!;
  const userAccount = DEV_DEMO_ACCOUNTS.find((a) => !a.isAdministrator)!;

  assert.equal(
    authorizeDevDemoCredentials("production", {
      username: adminAccount.username,
      password: adminAccount.password,
    }),
    null,
  );
  assert.equal(
    authorizeDevDemoCredentials("test", {
      username: adminAccount.username,
      password: adminAccount.password,
    }),
    null,
  );

  const signedInAdmin = authorizeDevDemoCredentials("development", {
    username: adminAccount.username.toUpperCase(),
    password: adminAccount.password,
  });
  assert.equal(signedInAdmin?.id, adminAccount.id);
  assert.equal(signedInAdmin?.isAdministrator, true);

  const signedInUser = authorizeDevDemoCredentials("development", {
    username: userAccount.username,
    password: userAccount.password,
  });
  assert.equal(signedInUser?.isAdministrator, false);

  assert.equal(
    authorizeDevDemoCredentials("development", {
      username: adminAccount.username,
      password: "wrong-password",
    }),
    null,
  );

  const sid = createOpaqueToken();
  assert.equal(registerDevDemoSession("production", adminAccount.id, sid), false);
  assert.equal(registerDevDemoSession("development", adminAccount.id, sid), true);
  assert.equal(
    getActiveDevDemoSession("development", adminAccount.id, sid)?.username,
    adminAccount.username,
  );
  assert.equal(
    getActiveDevDemoSession("production", adminAccount.id, sid),
    null,
  );

  revokeDevDemoSession(sid);
  assert.equal(
    getActiveDevDemoSession("development", adminAccount.id, sid),
    null,
  );

  assert.equal(getDevDemoUserById("production", adminAccount.id), null);
  assert.equal(
    getDevDemoUserById("development", adminAccount.id)?.isAdministrator,
    true,
  );
  assert.equal(getDevBypassUser("admin").isAdministrator, true);
  assert.equal(getDevBypassUser("user").isAdministrator, false);
});

test("extractClientIp honors TRUST_PROXY_HEADERS and rejects invalid forwarding headers", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.45, 10.0.0.2",
    "x-real-ip": "198.51.100.8",
  });

  assert.equal(extractClientIp(headers, { trustProxyHeaders: false }), null);
  assert.equal(
    extractClientIp(headers, { trustProxyHeaders: true }),
    "203.0.113.45",
  );
  assert.equal(
    extractClientIp(
      new Headers({ "x-forwarded-for": "[2001:DB8::1]:4432" }),
      { trustProxyHeaders: true },
    ),
    "2001:db8::1",
  );
  assert.equal(
    extractClientIp(
      new Headers({
        "x-forwarded-for": "not-an-ip",
        "x-real-ip": "198.51.100.8:8080",
      }),
      { trustProxyHeaders: true },
    ),
    "198.51.100.8",
  );
});

test("parseEnvironment provides safe defaults and validates lockout settings", () => {
  const defaults = parseEnvironment({});
  assert.equal(defaults.trustProxyHeaders, false);
  assert.equal(defaults.loginFailureLimit, 5);
  assert.equal(defaults.loginFailureWindowSeconds, 900);
  assert.equal(defaults.loginLockoutSeconds, 900);

  const custom = parseEnvironment({
    TRUST_PROXY_HEADERS: "true",
    LOGIN_FAILURE_LIMIT: "10",
    LOGIN_FAILURE_WINDOW_SECONDS: "600",
    LOGIN_LOCKOUT_SECONDS: "1200",
  });
  assert.equal(custom.trustProxyHeaders, true);
  assert.equal(custom.loginFailureLimit, 10);
  assert.equal(custom.loginFailureWindowSeconds, 600);
  assert.equal(custom.loginLockoutSeconds, 1200);

  assert.throws(() => parseEnvironment({ LOGIN_FAILURE_LIMIT: "0" }));
});

test("Phase 4 EH-07 & EH-01: validates USE_X_ACCEL_REDIRECT and resolvePrismaClient fails closed in production", () => {
  const defaults = parseEnvironment({});
  assert.equal(defaults.useXAccelRedirect, false);

  const enabled = parseEnvironment({ USE_X_ACCEL_REDIRECT: "true" });
  assert.equal(enabled.useXAccelRedirect, true);
  assert.throws(() => parseEnvironment({ USE_X_ACCEL_REDIRECT: "yes" }));

  assert.throws(
    () =>
      resolvePrismaClient(
        { nodeEnv: "production", databaseUrl: undefined },
        { useGlobalCache: false },
      ),
    DatabaseConfigurationError,
  );

  assert.throws(
    () =>
      resolvePrismaClient(
        { nodeEnv: "production", databaseUrl: VALID_DB_URL },
        {
          useGlobalCache: false,
          buildClient: () => {
            throw new Error("ECONNREFUSED");
          },
        },
      ),
    DatabaseUnavailableError,
  );

  // Non-production retains safe local mock fallback
  const devMock = resolvePrismaClient(
    { nodeEnv: "development", databaseUrl: undefined },
    { useGlobalCache: false },
  );
  assert.ok(devMock);
});
