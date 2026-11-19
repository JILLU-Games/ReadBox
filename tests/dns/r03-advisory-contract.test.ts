import { buildCloudflareZoneFile, buildExpectedDnsRecords } from "@/core/dns/records";
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


test("MM-01 foreign mail host stays an MX target but is never an imported A/AAAA owner", () => {
  for (const address of ["203.0.113.42", "2001:db8::42"]) {
    const rows = buildExpectedDnsRecords("mailiq.shop", {
      mailHostname: "mail.anyinbox.cc", serverIp: address,
      dkim: { value: "v=DKIM1; k=rsa; p=" + "a".repeat(420), copyable: true },
    });
    assert.equal(rows.length, 5); // Preserve the global routing/verification contract.
    const zone = buildCloudflareZoneFile("mailiq.shop", rows);
    assert.match(zone, /mailiq\.shop\.\s+300\s+IN\s+MX\s+10\s+mail\.anyinbox\.cc\./);
    assert.doesNotMatch(zone, /mail\.anyinbox\.cc\.\s+300\s+IN\s+(?:A|AAAA)\s/);
    assert.match(zone, /v=spf1 a:mail\.anyinbox\.cc -all/);
    assert.match(zone, /_dmarc\.mailiq\.shop\./);
    assert.match(zone, /mail\._domainkey\.mailiq\.shop\./);
    assert.match(zone, /p=aaaa/);
  }
});

test("MM-01 in-zone mail A/AAAA owners and DKIM chunking remain in the zone export", () => {
  for (const address of ["203.0.113.42", "2001:db8::42"]) {
    const zone = buildCloudflareZoneFile("example.test",
      buildExpectedDnsRecords("example.test", {
        mailHostname: "mail.example.test", serverIp: address,
        dkim: { value: "v=DKIM1; k=rsa; p=" + "a".repeat(420), copyable: true },
      }));
    assert.match(zone, new RegExp("mail\\.example\\.test\\.\\s+300\\s+IN\\s+" +
      (address.includes(":") ? "AAAA" : "A") + "\\s+"));
    const dk = zone.split("\n").find((row) => row.startsWith("mail._domainkey.example.test."));
    assert.ok(dk);
    const chunks = [...dk.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
    assert.ok(chunks.length >= 2);
    assert.ok(chunks.every((part) => part.length <= 255));
    assert.equal(chunks.join(""), "v=DKIM1; k=rsa; p=" + "a".repeat(420));
  }
});
