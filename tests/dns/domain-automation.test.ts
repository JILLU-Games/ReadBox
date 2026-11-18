import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import {
  DomainAutomationError, findCloudflareZone, publishManagedDomainDns,
  type ZoneContext,
} from "../../src/core/dns/cloudflare-auto";
import { validateAgentPayload } from "../../src/core/backup/validation";

const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const record = "v=DKIM1; k=rsa; p=" +
  publicKey.export({ type: "pkcs1", format: "der" }).toString("base64");
const id = "a".repeat(32);

function ok(result: unknown, count?: number) {
  return new Response(JSON.stringify({
    success: true, result, ...(count === undefined ? {} : {
      result_info: { total_count: count },
    }),
  }), { status: 200 });
}

type R = { type: string; name: string; content: string; priority?: number; proxied?: boolean };
function dnsMock(initial: readonly R[] = []) {
  const store = [...initial];
  const calls: Array<{ method: string; url: string; body?: R }> = [];
  const fetchImpl = (async (url: string | URL | Request, options?: RequestInit) => {
    const u = new URL(String(url));
    const method = options?.method ?? "GET";
    const body = options?.body ? JSON.parse(options.body as string) as R : undefined;
    calls.push({ method, url: u.toString(), body });
    if (u.pathname.endsWith("/dns_records") && method === "POST") {
      if (body) store.push(body);
      return ok({ id: "created" });
    }
    if (u.pathname.endsWith("/dns_records") && method === "GET") {
      return ok(store.filter((r) => r.name === u.searchParams.get("name")));
    }
    throw new Error("Unexpected API path");
  }) as typeof fetch;
  const zone: ZoneContext = {
    token: "test-token", name: "example.test", id, fetchImpl,
  };
  return { zone, store, calls };
}
const config = {
  mailHostname: "mail.example.test",
  serverIp: "203.0.113.30",
  dkimRecord: record,
};

test("DOMAIN-AUTO-01 discovers per-domain active managed Cloudflare zone", async () => {
  const queried: string[] = [];
  const fetchImpl = (async (url: string | URL | Request) => {
    const name = new URL(String(url)).searchParams.get("name")!;
    queried.push(name);
    return ok(name === "example.test" ?
      [{ id, name, status: "active" }] : []);
  }) as typeof fetch;
  const zone = await findCloudflareZone("sub.example.test", {
    token: "fixture", fetchImpl,
  });
  assert.equal(zone.name, "example.test");
  assert.deepEqual(queried, ["sub.example.test", "example.test"]);
});

test("DOMAIN-AUTO-01 refuses wrong or inactive zone and missing token", async () => {
  await assert.rejects(findCloudflareZone("example.test", { token: "" }),
    (e) => e instanceof DomainAutomationError &&
      e.code === "CLOUDFLARE_DNS_NOT_CONFIGURED");
  await assert.rejects(findCloudflareZone("example.test", {
    token: "fixture", fetchImpl: (async () =>
      ok([{ id, name: "example.test", status: "pending" }])) as typeof fetch,
  }), (e) => e instanceof DomainAutomationError &&
    e.code === "CLOUDFLARE_ZONE_NOT_ACTIVE");
  const mock = dnsMock();
  await assert.rejects(publishManagedDomainDns("outsider.test", mock.zone, config),
    (e) => e instanceof DomainAutomationError &&
      e.code === "CLOUDFLARE_ZONE_MISMATCH");
  assert.equal(mock.calls.length, 0);
});

test("DOMAIN-AUTO-01 preflights all records then creates 5 exact records", async () => {
  const mock = dnsMock();
  const result = await publishManagedDomainDns("example.test", mock.zone, config);
  assert.equal(result.created, 5);
  assert.equal(result.existing, 0);
  assert.equal(mock.store.length, 5);
  const creates = mock.calls.filter((c) => c.method === "POST");
  assert.equal(creates.length, 5);
  assert.equal(creates.find((c) => c.body?.type === "A")?.body?.proxied, false);
  assert.equal(creates.find((c) => c.body?.type === "MX")?.body?.priority, 10);
  assert.equal(creates.find((c) => c.body?.name ===
    "mail._domainkey.example.test")?.body?.content, record);
  assert.ok(mock.calls.slice(0, 4).every((c) => c.method === "GET"));
  const again = await publishManagedDomainDns("example.test", mock.zone, config);
  assert.equal(again.created, 0);
  assert.equal(again.existing, 5);
  assert.equal(mock.calls.filter((c) => c.method === "POST").length, 5);
});

test("DOMAIN-AUTO-01 unrelated TXT at apex is preserved", async () => {
  const original: R = { type: "TXT", name: "example.test", content: "google-site-verification=abc" };
  const mock = dnsMock([original]);
  await publishManagedDomainDns("example.test", mock.zone, config);
  assert.deepEqual(mock.store[0], original);
});

test("DOMAIN-AUTO-01 rejects conflicting SPF before ANY DNS create", async () => {
  const mock = dnsMock([{
    type: "TXT", name: "example.test", content: "v=spf1 include:elsewhere.test -all",
  }]);
  await assert.rejects(publishManagedDomainDns("example.test", mock.zone, config),
    (e) => e instanceof DomainAutomationError &&
      e.code === "CLOUDFLARE_DNS_RECORD_CONFLICT");
  assert.equal(mock.calls.filter((c) => c.method === "POST").length, 0);
});

test("DOMAIN-AUTO-01 rejects conflicting DKIM and proxied mail A", async () => {
  for (const item of [
    { type: "TXT", name: "mail._domainkey.example.test", content: "v=DKIM1; p=other" },
    { type: "A", name: "mail.example.test", content: config.serverIp, proxied: true },
  ]) {
    const mock = dnsMock([item]);
    await assert.rejects(publishManagedDomainDns("example.test", mock.zone, config),
      (e) => e instanceof DomainAutomationError &&
        e.code === "CLOUDFLARE_DNS_RECORD_CONFLICT");
    assert.equal(mock.calls.filter((c) => c.method === "POST").length, 0);
  }
});

test("DOMAIN-AUTO-01 central mail host outside current zone is NEVER modified", async () => {
  const mock = dnsMock();
  const result = await publishManagedDomainDns("example.test", mock.zone, {
    ...config, mailHostname: "mail.anyinbox.cc",
  });
  assert.equal(result.created, 4);
  assert.equal(mock.store.filter((r) => r.type === "A").length, 0);
  assert.ok(mock.store.some((r) => r.type === "MX" && r.content === "mail.anyinbox.cc"));
});

test("DOMAIN-AUTO-01 HMAC broker input is exact and domain constrained", () => {
  assert.equal(validateAgentPayload("dkim.escrow", { domain: "example.test" }), true);
  assert.equal(validateAgentPayload("dkim.escrow", {
    domain: "example.test", command: "restore",
  }), false);
  assert.equal(validateAgentPayload("dkim.escrow", { domain: "../etc/passwd" }), false);
  assert.equal(validateAgentPayload("dkim.escrow", { domain: "EXAMPLE.test" }), false);
  assert.equal(validateAgentPayload("dkim.escrow", { domain: "example.test;" }), false);
});
