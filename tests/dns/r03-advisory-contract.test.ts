import { buildExpectedDnsRecords } from "@/core/dns/records";
import { verifyRoutingDns, type DnsLookupPort } from "@/core/dns/resolver";
import assert from "node:assert/strict";
import test from "node:test";

const domain = "r03.example.test";
const hostname = "mail.r03.example.test";
const ip = "203.0.113.42";

test("R03 DNS records are explicit advisory data, not provider mutations or signer installation", () => {
  const expected = buildExpectedDnsRecords(domain, { mailHostname: hostname, serverIp: ip });
  const mx = expected.find((record) => record.type === "MX");
  const address = expected.find((record) => record.type === "A");
  const dkim = expected.find((record) => record.host.includes("_domainkey"));
  assert.equal(mx?.value, hostname);
  assert.equal(address?.value, ip);
  assert.equal(dkim?.copyable, false);
  assert.ok(expected.some((record) => record.host.startsWith("_dmarc.")));
});

test("R03 routing verification needs correct MX plus matching public mail-host address", async () => {
  const ok: DnsLookupPort = {
    async resolve(name, type) {
      if (name === domain && type === "MX") return [hostname];
      if (name === hostname && type === "A") return [ip];
      return [];
    },
  };
  const positive = await verifyRoutingDns(domain, {
    mailHostname: hostname, expectedServerIp: ip, lookup: ok,
  });
  assert.equal(positive.verified, true);
  const negative = await verifyRoutingDns(domain, {
    mailHostname: hostname, expectedServerIp: "198.51.100.44", lookup: ok,
  });
  assert.equal(negative.verified, false);
  const failed = await verifyRoutingDns(domain, {
    mailHostname: hostname, expectedServerIp: ip,
    lookup: { async resolve() { throw new Error("offline DNS"); } },
  });
  assert.equal(failed.verified, false);
  assert.equal(failed.errorCode, "lookup_error");
});
