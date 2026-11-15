import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

function themeTokens(selector: string) {
  const block = css.match(new RegExp(`${selector}\\s*\\{([^}]+)\\}`))?.[1];
  if (!block) throw new Error(`Missing theme block: ${selector}`);

  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[\da-fA-F]{6});/g)].map((match) => [
      match[1],
      match[2],
    ]),
  ) as Record<string, string>;
}

function luminance(color: string) {
  const channels = color
    .slice(1)
    .match(/../g)
    ?.map((channel) => parseInt(channel, 16) / 255);
  if (!channels) throw new Error(`Invalid color: ${color}`);

  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

describe("theme muted-text contrast", () => {
  it.each([
    ["light", themeTokens(":root")],
    ["dark", themeTokens(".dark")],
  ])("meets WCAG AA for small muted text in the %s theme", (_theme, tokens) => {
    for (const surface of ["background", "card", "muted"]) {
      expect(
        contrastRatio(tokens["muted-foreground"], tokens[surface]),
        `${_theme} muted-foreground on ${surface}`,
      ).toBeGreaterThanOrEqual(4.5);
    }

    expect(
      contrastRatio(tokens["sidebar-muted"], tokens.sidebar),
      `${_theme} sidebar-muted on sidebar`,
    ).toBeGreaterThanOrEqual(4.5);
  });
});
