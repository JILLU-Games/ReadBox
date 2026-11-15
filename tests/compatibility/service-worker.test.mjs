import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const serviceWorkerSource = readFileSync(
  resolve(workspaceRoot, "public/sw.js"),
  "utf8",
);
const origin = "https://readbox.example";
const offlineResponse = { offline: true };

function createHarness(fetchImpl = async () => ({ ok: false })) {
  const listeners = new Map();
  const entries = new Map([["/offline.html", offlineResponse]]);
  const putCalls = [];
  const openCalls = [];
  const matchCalls = [];
  const deletedCaches = [];
  const cache = {
    async add(url) {
      entries.set(url, offlineResponse);
    },
    async match(request) {
      const key = typeof request === "string" ? request : request.url;
      return entries.get(key);
    },
    async put(request, response) {
      putCalls.push(request.url);
      entries.set(request.url, response);
    },
  };
  const caches = {
    async open(name) {
      openCalls.push(name);
      return cache;
    },
    async match(request) {
      matchCalls.push(request);
      return cache.match(request);
    },
    async keys() {
      return ["mailstack-public-static-v1", "unrelated-cache"];
    },
    async delete(name) {
      deletedCaches.push(name);
      return true;
    },
  };
  const self = {
    location: { origin },
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
  };

  runInNewContext(serviceWorkerSource, { self, caches, URL, fetch: fetchImpl });

  return { listeners, entries, putCalls, openCalls, matchCalls, deletedCaches };
}

function request(url, { method = "GET", mode = "cors" } = {}) {
  return { method, mode, url: new URL(url, origin).href };
}

function dispatchFetch(harness, requestValue) {
  let responsePromise;
  harness.listeners.get("fetch")({
    request: requestValue,
    respondWith(value) {
      responsePromise = Promise.resolve(value);
    },
  });
  return { intercepted: responsePromise !== undefined, responsePromise };
}

test("installation caches only the generic offline fallback and activation removes prior app caches", async () => {
  const harness = createHarness();
  const installWaits = [];
  harness.listeners.get("install")({
    waitUntil: (promise) => installWaits.push(promise),
  });
  await Promise.all(installWaits);

  assert.deepEqual(harness.openCalls, ["mailstack-public-static-v2"]);
  assert.deepEqual([...harness.entries.keys()], ["/offline.html"]);

  const activationWaits = [];
  harness.listeners.get("activate")({
    waitUntil: (promise) => activationWaits.push(promise),
  });
  await Promise.all(activationWaits);
  assert.deepEqual(harness.deletedCaches, ["mailstack-public-static-v1"]);
});

test("only immutable same-origin Next static assets are cached", async () => {
  const response = {
    ok: true,
    headers: {
      get(name) {
        return name === "content-type"
          ? "text/javascript"
          : "public, max-age=31536000, immutable";
      },
      has: () => false,
    },
    clone() {
      return this;
    },
  };
  const harness = createHarness(async () => response);
  const assetRequest = request("/_next/static/chunks/app.js");
  const result = dispatchFetch(harness, assetRequest);

  assert.equal(result.intercepted, true);
  assert.equal(await result.responsePromise, response);
  assert.deepEqual(harness.putCalls, [assetRequest.url]);
});

test("cross-origin and non-GET requests bypass the service worker", () => {
  const harness = createHarness();

  assert.equal(
    dispatchFetch(harness, request("https://cdn.example/_next/static/app.js"))
      .intercepted,
    false,
  );
  assert.equal(
    dispatchFetch(harness, request("/_next/static/app.js", { method: "POST" }))
      .intercepted,
    false,
  );
  assert.deepEqual(harness.putCalls, []);
});

test("API requests and authenticated page navigations are never cached", async () => {
  const harness = createHarness(async () => {
    throw new Error("offline");
  });
  const apiRequest = request("/api/auth/session");
  const apiResult = dispatchFetch(harness, apiRequest);
  assert.equal(apiResult.intercepted, false);
  assert.deepEqual(harness.putCalls, []);

  const navigation = request("/users", { mode: "navigate" });
  const navigationResult = dispatchFetch(harness, navigation);
  assert.equal(navigationResult.intercepted, true);
  assert.equal(await navigationResult.responsePromise, offlineResponse);
  assert.deepEqual(harness.putCalls, []);
  assert.deepEqual(harness.matchCalls, ["/offline.html"]);
});

test("non-immutable static responses are returned but not cached", async () => {
  const response = {
    ok: true,
    headers: {
      get: (name) => (name === "content-type" ? "text/css" : "no-cache"),
      has: () => false,
    },
    clone() {
      return this;
    },
  };
  const harness = createHarness(async () => response);
  const result = dispatchFetch(harness, request("/_next/static/css/app.css"));

  assert.equal(result.intercepted, true);
  assert.equal(await result.responsePromise, response);
  assert.deepEqual(harness.putCalls, []);
});

test("immutable static responses that set cookies are not cached", async () => {
  const response = {
    ok: true,
    headers: {
      get: (name) =>
        name === "content-type"
          ? "text/javascript"
          : "public, max-age=31536000, immutable",
      has: (name) => name === "set-cookie",
    },
    clone() {
      return this;
    },
  };
  const harness = createHarness(async () => response);
  const result = dispatchFetch(harness, request("/_next/static/chunks/app.js"));

  assert.equal(await result.responsePromise, response);
  assert.deepEqual(harness.putCalls, []);
});
