import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import manifest from "@/app/manifest";
import {
  resetDevFallbackSiteSettings,
  updateSiteSettings,
} from "@/core/settings/service";

describe("app installability manifest", () => {
  afterEach(() => {
    resetDevFallbackSiteSettings();
  });

  it("declares standalone launch behavior and the authenticated workspace start URL", async () => {
    const appManifest = await manifest();
    expect(appManifest).toMatchObject({
      name: "ReadBox",
      short_name: "ReadBox",
      start_url: "/users",
      display: "standalone",
      background_color: "#f6f8fa",
      theme_color: "#2558bf",
    });
  });

  it("reflects dynamic site settings branding asynchronously", async () => {
    await updateSiteSettings(
      {
        siteName: "Acme MailOps",
        siteTagline: "Custom mail workspace",
      },
      { prisma: null },
    );

    const appManifest = await manifest();
    expect(appManifest.name).toBe("Acme MailOps");
    expect(appManifest.short_name).toBe("Acme MailOps");
    expect(appManifest.description).toBe("Custom mail workspace");
  });

  it.each([
    ["/icons/readbox-192.png", 192],
    ["/icons/readbox-512.png", 512],
  ])("provides a valid %i-pixel PNG manifest icon", async (src, size) => {
    const appManifest = await manifest();
    const icon = appManifest.icons?.find((candidate) => candidate.src === src);
    expect(icon).toMatchObject({
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "any",
    });

    const png = readFileSync(resolve(process.cwd(), "public", src.slice(1)));
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  });
});
