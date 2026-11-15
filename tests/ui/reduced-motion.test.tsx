import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
const reducedMotionDeclarations = css.match(
  /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{\s*\*,\s*\*::before,\s*\*::after\s*\{([^}]*)\}\s*\}/,
)?.[1];

describe("reduced-motion preference", () => {
  it("reduces scrolling, animation, and transition motion for all elements", () => {
    expect(reducedMotionDeclarations).toBeDefined();

    const declarations = Object.fromEntries(
      [...reducedMotionDeclarations!.matchAll(/([\w-]+):\s*([^;]+);/g)].map(
        (match) => [match[1], match[2].trim()],
      ),
    );

    expect(declarations).toEqual({
      "scroll-behavior": "auto !important",
      "animation-duration": "0.01ms !important",
      "animation-iteration-count": "1 !important",
      "transition-duration": "0.01ms !important",
    });
  });
});
