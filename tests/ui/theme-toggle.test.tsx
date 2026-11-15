import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const themeState = vi.hoisted(() => ({
  resolvedTheme: "light",
  setTheme: vi.fn(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => themeState,
}));

import { ThemeToggle } from "@/components/layout/theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    themeState.resolvedTheme = "light";
    themeState.setTheme.mockClear();
  });

  afterEach(() => cleanup());

  it("switches from light to dark with Enter", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const toggle = screen.getByRole("button", { name: "Toggle color theme" });
    toggle.focus();
    await user.keyboard("{Enter}");

    expect(themeState.setTheme).toHaveBeenCalledWith("dark");
  });

  it("switches from dark to light with Space", async () => {
    const user = userEvent.setup();
    themeState.resolvedTheme = "dark";
    render(<ThemeToggle />);

    const toggle = screen.getByRole("button", { name: "Toggle color theme" });
    toggle.focus();
    await user.keyboard(" ");

    expect(themeState.setTheme).toHaveBeenCalledWith("light");
  });
});
