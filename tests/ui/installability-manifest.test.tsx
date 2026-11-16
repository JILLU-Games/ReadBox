import manifest from "@/app/manifest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("app installability manifest", () => {
  const appManifest = manifest();

  it("declares standalone launch behavior and the authenticated workspace start URL", () => {
    expect(appManifest).toMatchObject({
      name: "ReadBox",
      short_name: "ReadBox",
      start_url: "/users",
      display: "standalone",
      background_color: "#f6f8fa",
      theme_color: "#2558bf",
    });
  });

  it.each([
    ["/icons/mailstack-192.png", 192],
    ["/icons/mailstack-512.png", 512],
  ])("provides a valid %i-pixel PNG manifest icon", (src, size) => {
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
