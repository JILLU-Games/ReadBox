import { applySeoOverrides, legacySeoPreview } from "@/core/seo/metadata";
import { emptySeoValues } from "@/core/seo/types";
import assert from "node:assert/strict";
import test from "node:test";
import type { Metadata } from "next";

const base: Metadata = {
  title: {absolute:"ReadBox — Workspace"},
  description: "Previous page text.",
  alternates:{canonical:"https://example.test/"},
  openGraph: {type:"website",title:"ReadBox — Workspace",description:"Previous page text.",url:"https://example.test/"},
  twitter: {card:"summary_large_image",title:"ReadBox — Workspace",description:"Previous page text."},
  robots: {index:true,follow:true},
};

test("No SEO row preserves exact previous metadata reference and values", () => {
  assert.equal(applySeoOverrides(base, emptySeoValues(),"https://example.test"), base);
});

test("Independent SEO values update metadata without changing canonical/robots", () => {
  const merged = applySeoOverrides(base, {
    title:"AnyInbox | Email",description:"AnyInbox private inboxes.",imagePath:"/icons/a.png",
  },"https://example.test");
  assert.deepEqual(merged.title,{absolute:"AnyInbox | Email"});
  assert.equal(merged.description,"AnyInbox private inboxes.");
  assert.deepEqual(merged.alternates,base.alternates);
  assert.deepEqual(merged.robots,base.robots);
  assert.equal(merged.openGraph?.title,"AnyInbox | Email");
  assert.equal(merged.twitter?.title,"AnyInbox | Email");
  assert.deepEqual(merged.openGraph?.images,[{url:"https://example.test/icons/a.png"}]);
});

test("Legacy previews match existing Home Contact and Privacy fallback contracts", () => {
  const settings = { siteName:"AnyInbox",siteTagline:"One place",footerDescription:"Managed mailboxes." };
  assert.deepEqual(legacySeoPreview("home",settings),{title:"AnyInbox — One place",description:"Managed mailboxes."});
  assert.equal(legacySeoPreview("contact",settings).title,"Contact & Support — AnyInbox");
  assert.equal(legacySeoPreview("privacy",settings).title,"Privacy Policy — AnyInbox");
});
