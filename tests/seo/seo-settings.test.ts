import { seoPageInputSchema } from "@/core/seo/validation";
import { getSeoSettingsSnapshot, updateSeoPageSettings, type SeoDatabase } from "@/core/seo/service";
import { emptySeoValues } from "@/core/seo/types";
import assert from "node:assert/strict";
import test from "node:test";

function mockDatabase() {
  const values = new Map<string, { pageKey: string; title: string; description: string; imagePath: string; updatedAt: Date }>();
  let audits = 0;
  let auditFailure = false;
  const database = {
    siteSeoSettings: {
      async findMany() { return [...values.values()]; },
      async upsert({ where, create, update }: {
        where: {pageKey: "home"|"contact"|"privacy"};
        create: {pageKey:"home"|"contact"|"privacy"; title:string; description:string; imagePath:string};
        update: {title:string; description:string; imagePath:string};
      }) {
        const row = { pageKey: where.pageKey, ...((values.has(where.pageKey) ? update : create)),
          updatedAt: new Date("2026-11-20T08:00:00Z") };
        values.set(where.pageKey, row);
        return row;
      },
    },
    auditLog: {
      async create() {
        if (auditFailure) throw new Error("audit unavailable");
        audits++;
        return { id: BigInt(audits) };
      },
    },
    async $transaction<T>(callback: (db: SeoDatabase) => Promise<T>) {
      const saved = new Map(values);
      try { return await callback(database as SeoDatabase); }
      catch (error) {
        values.clear();
        for (const [key, row] of saved) values.set(key, row);
        throw error;
      }
    },
  };
  return { database: database as SeoDatabase, values, get audits() {return audits;},
    failAudit() {auditFailure = true;} };
}

test("SEO validation rejects private paths, markup, scripts, control characters and offsite images", () => {
  for (const value of ["javascript:alert(1)", "//evil.com/a.png", "/../private.png",
    "/api/private/a.png", "/api/media/site-settings/x.svg", "https://other.example/a.png"]) {
    assert.equal(seoPageInputSchema.safeParse({
      pageKey:"home", title:"Safe", description:"Safe", imagePath:value,
    }).success, false, value);
  }
  for (const value of ["<script>", "bad\nline", "a".repeat(121)]) {
    assert.equal(seoPageInputSchema.safeParse({
      pageKey:"home", title:value, description:"Safe", imagePath:"",
    }).success, false, value);
  }
  assert.equal(seoPageInputSchema.safeParse({
    pageKey:"/users", title:"T", description:"D", imagePath:"",
  }).success, false);
});

test("SEO setting persists per public page; empty initial row uses fallback", async () => {
  const mock = mockDatabase();
  const before = await getSeoSettingsSnapshot({database:mock.database});
  assert.deepEqual(before.pages.home, emptySeoValues());
  assert.equal(before.databaseConnected, true);
  const saved = await updateSeoPageSettings({
    pageKey:"home", title:"AnyInbox | Email", description:"Manage email.",
    imagePath:"/icons/brand.png",
  }, {database:mock.database});
  assert.equal(saved.ok, true);
  assert.equal(mock.audits, 1);
  const after = await getSeoSettingsSnapshot({database:mock.database});
  assert.equal(after.pages.home.title, "AnyInbox | Email");
  assert.deepEqual(after.pages.contact, emptySeoValues());
});

test("SEO invalid input, unavailable database and audit failure fail closed", async () => {
  const mock = mockDatabase();
  const invalid = await updateSeoPageSettings({
    pageKey:"home",title:"<bad>",description:"",imagePath:"",
  },{database:mock.database});
  assert.equal(invalid.ok, false);
  assert.equal(mock.values.size, 0);
  const offline = await updateSeoPageSettings({
    pageKey:"home",title:"Safe",description:"",imagePath:"",
  },{database:null});
  assert.equal(offline.ok, false);
  mock.failAudit();
  const audit = await updateSeoPageSettings({
    pageKey:"home",title:"Safe",description:"",imagePath:"",
  },{database:mock.database});
  assert.equal(audit.ok, false);
  assert.equal(mock.values.size, 0);
  const missing = await getSeoSettingsSnapshot({database:{
    ...mock.database, siteSeoSettings: {
      ...mock.database.siteSeoSettings,
      async findMany(){throw new Error("table missing");},
    },
  }});
  assert.equal(missing.databaseConnected, false);
  assert.deepEqual(missing.pages.home, emptySeoValues());
});
