import { getPublicBrandPresentation, isAnyInboxOrigin } from "@/core/seo/brand";
import { buildPublicSiteStructuredData, serializeJsonLdForHtml } from "@/core/seo/structured-data";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import assert from "node:assert/strict";
import test from "node:test";

test("AnyInbox identity is isolated to its verified HTTPS public origin", () => {
  assert.equal(isAnyInboxOrigin("https://anyinbox.cc"), true);
  assert.equal(isAnyInboxOrigin("https://www.anyinbox.cc"), true);
  for (const url of ["http://anyinbox.cc", "https://anyinbox.cc.evil.test",
    "https://readbox.example", "javascript:alert(1)"]) {
    assert.equal(isAnyInboxOrigin(url), false);
  }
  const branded = getPublicBrandPresentation("Any Inbox", "https://anyinbox.cc");
  assert.equal(branded.displayName, "AnyInbox");
  assert.equal(branded.heroTitle, "Your Email. One Simple Workspace.");
  assert.equal(branded.faqItems.length, 5);
  const generic = getPublicBrandPresentation("ReadBox", "https://other.example");
  assert.equal(generic.displayName, "ReadBox");
  assert.equal(generic.heroTitle, "Self-service custom-domain mailboxes and private team workspaces.");
  assert.notEqual(generic.faqItems, branded.faqItems);
});

test("JSON-LD FAQ exactly matches the visible brand facts and is script-safe", () => {
  const brand = getPublicBrandPresentation("Any Inbox", "https://anyinbox.cc");
  const data = buildPublicSiteStructuredData({
    baseUrl: "https://anyinbox.cc",
    siteName: brand.displayName,
    siteTagline: "Custom domains and inbox management.",
    faqItems: brand.faqItems,
  });
  const graph = JSON.parse(JSON.stringify(data))["@graph"] as Array<Record<string, unknown>>;
  const org = graph.find((item) => item["@type"] === "Organization");
  assert.equal(org?.name, "AnyInbox");
  assert.equal(org?.url, "https://anyinbox.cc/");
  const faq = graph.find((item) => item["@type"] === "FAQPage");
  const questions = faq?.mainEntity as Array<{
    name: string;
    acceptedAnswer: { text: string };
  }>;
  assert.deepEqual(questions.map((item) => item.name), brand.faqItems.map((item) => item.question));
  assert.deepEqual(questions.map((item) => item.acceptedAnswer.text),
    brand.faqItems.map((item) => item.answer));

  const payload = { title: "</script><script>alert(1)</script>", amp: "&", line: "\u2028" };
  const safe = serializeJsonLdForHtml(payload);
  assert.equal(safe.includes("<"), false);
  assert.equal(safe.includes(">"), false);
  assert.equal(safe.includes("&"), false);
  assert.match(safe, /\\u003c/);
  assert.deepEqual(JSON.parse(safe), payload);
});

test("robots retains private API protection and permits only explicitly public brand assets", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
  const rule = rules[0];
  assert.equal(rule.userAgent, "*");
  for (const privateRoute of ["/users/", "/vcon/", "/api/"]) {
    assert.ok(rule.disallow?.includes(privateRoute), privateRoute);
  }
  assert.ok(rule.allow?.includes("/api/media/site-settings/"));
  assert.ok(rule.allow?.includes("/about"));
  assert.equal(rule.disallow?.includes("/sign-in"), false,
    "Allow crawler to see sign-in noindex metadata rather than blocking the page in robots");
  assert.equal(rule.allow?.includes("/api/"), false);
});

test("sitemap contains only approved canonical public paths and no fabricated modification date", () => {
  const urls = sitemap();
  const result = urls.map((item) => new URL(item.url).pathname);
  assert.deepEqual(result, ["/", "/contact", "/privacy", "/about"]);
  for (const item of urls) {
    assert.equal(item.lastModified, undefined);
    assert.ok(item.url.startsWith("https://"));
    assert.equal(item.url.includes("/users/"), false);
  }
});

test("source-level contracts preserve auth forms and conditional icon fallback", async () => {
  const { readFile } = await import("node:fs/promises");
  const manifest = await readFile("src/app/manifest.ts", "utf8");
  assert.match(manifest, /brand\.isAnyInbox && customFaviconUrl/);
  assert.match(manifest, /icons\.length = 0/);
  assert.match(manifest, /start_url:\s*"\/users"/);
  for (const page of ["sign-in", "sign-up"]) {
    const source = await readFile("src/app/" + page + "/page.tsx", "utf8");
    assert.match(source, /robots: \{ index: false, follow: false \}/);
    assert.match(source, /referrer: "same-origin"/);
  }
});
