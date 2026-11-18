import assert from "node:assert/strict";
import test from "node:test";
import {
  DomainAutomationError, listCloudflareZones, resolveSelectedCloudflareZone,
} from "../../src/core/dns/cloudflare-auto";
import {
  bindCloudflareZone, getBoundCloudflareZone,
} from "../../src/core/domains/service";
import type { PrismaClient } from "@prisma/client";

const zoneId = "a".repeat(32);
const otherId = "b".repeat(32);
const uuid = "11111111-1111-4111-8111-111111111111";
const response = (result: unknown) => new Response(JSON.stringify({
  success: true, result,
}), { status: 200 });

function selectedMock(status = "active", name = "example.test", id = zoneId) {
  const calls: string[] = [];
  const fetchImpl = (async (url: string | URL | Request, opts?: RequestInit) => {
    calls.push(String(url));
    assert.equal(opts?.method, "GET");
    assert.equal((opts?.headers as Record<string, string>)?.Authorization, "Bearer private");
    return response({ id, name, status });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

test("DOMAIN-AUTO-02 lists only active zones with bounded pagination and no token exposure", async () => {
  const queried: string[] = [];
  const fetchImpl = (async (url: string | URL | Request) => {
    const page = Number(new URL(String(url)).searchParams.get("page"));
    queried.push(String(page));
    return response(page === 1 ? Array.from({ length: 50 }, (_, i) => ({
      id: i.toString(16).padStart(32, "0"),
      name: "zone" + i + ".test", status: "active",
    })) : [{ id: otherId, name: "disabled.test", status: "pending" },
          { id: zoneId, name: "example.test", status: "active" }]);
  }) as typeof fetch;
  const zones = await listCloudflareZones({ token: "private", fetchImpl });
  assert.deepEqual(queried, ["1", "2"]);
  assert.equal(zones.length, 51);
  assert.ok(zones.some((z) => z.id === zoneId && z.name === "example.test"));
  assert.ok(!zones.some((z) => z.id === otherId));
  assert.ok(!JSON.stringify(zones).includes("private"));
});

test("DOMAIN-AUTO-02 only accepts an explicitly selected active exact zone", async () => {
  const mock = selectedMock();
  const zone = await resolveSelectedCloudflareZone("sub.example.test", zoneId, {
    token: "private", fetchImpl: mock.fetchImpl,
  });
  assert.equal(zone.id, zoneId);
  assert.equal(zone.name, "example.test");
  assert.deepEqual(mock.calls, [
    "https://api.cloudflare.com/client/v4/zones/" + zoneId,
  ]);
  const before = mock.calls.length;
  await assert.rejects(resolveSelectedCloudflareZone("example.test", "", {
    token: "private", fetchImpl: mock.fetchImpl,
  }), (e) => e instanceof DomainAutomationError &&
    e.code === "CLOUDFLARE_ZONE_SELECTION_REQUIRED");
  assert.equal(mock.calls.length, before, "no API call on omitted or malformed ID");

  const wrong = selectedMock("active", "other.test");
  await assert.rejects(resolveSelectedCloudflareZone("example.test", zoneId, {
    token: "private", fetchImpl: wrong.fetchImpl,
  }), (e) => e instanceof DomainAutomationError &&
    e.code === "CLOUDFLARE_ZONE_MISMATCH");
  const inactive = selectedMock("pending");
  await assert.rejects(resolveSelectedCloudflareZone("example.test", zoneId, {
    token: "private", fetchImpl: inactive.fetchImpl,
  }), (e) => e instanceof DomainAutomationError &&
    e.code === "CLOUDFLARE_ZONE_NOT_ACTIVE");
  const mismatch = selectedMock("active", "example.test", otherId);
  await assert.rejects(resolveSelectedCloudflareZone("example.test", zoneId, {
    token: "private", fetchImpl: mismatch.fetchImpl,
  }), (e) => e instanceof DomainAutomationError &&
    e.code === "CLOUDFLARE_ZONE_MISMATCH");
});

test("DOMAIN-AUTO-02 metadata binding persists, is idempotent, rejects rotation and stale CAS", async () => {
  let details: Record<string, unknown> = { mxOk: true };
  let writes = 0;
  let failCas = false;
  const db = { domain: {
    findUnique: async () => ({ verificationDetails: details }),
    updateMany: async (args: {
      where: { verificationDetails: { equals: Record<string, unknown> } };
      data: { verificationDetails: Record<string, unknown> };
    }) => {
      assert.deepEqual(args.where.verificationDetails.equals, details);
      if (failCas) return { count: 0 };
      writes++;
      details = args.data.verificationDetails;
      return { count: 1 };
    },
  } } as unknown as Pick<PrismaClient, "domain">;
  const chosen = { id: zoneId, name: "example.test" };
  await bindCloudflareZone(db, uuid, chosen);
  assert.deepEqual(getBoundCloudflareZone(details), chosen);
  assert.equal(details.mxOk, true);
  await bindCloudflareZone(db, uuid, chosen);
  assert.equal(writes, 1);
  await assert.rejects(bindCloudflareZone(db, uuid, {
    id: otherId, name: "example.test",
  }), /CLOUDFLARE_ZONE_BINDING_CONFLICT/);
  details = { mxOk: false };
  failCas = true;
  await assert.rejects(bindCloudflareZone(db, uuid, chosen),
    /CLOUDFLARE_ZONE_BINDING_CONFLICT/);
  assert.equal(writes, 1);
});
