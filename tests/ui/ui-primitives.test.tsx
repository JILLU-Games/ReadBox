import {
  AlertBanner,
  Checkbox,
  CopyButton,
  Label,
} from "@/components/ui";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const notifyMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/components/ui/notifications", () => ({
  NotificationToaster: () => null,
  notify: notifyMocks,
}));

describe("Phase-01 Global UI Primitives", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    notifyMocks.success.mockClear();
    notifyMocks.error.mockClear();
  });

  it("renders compact text-xs Label with 0rem consistency", () => {
    render(<Label htmlFor="mailbox-field">Mailbox address</Label>);
    const label = screen.getByText("Mailbox address");
    expect(label).toHaveClass("text-xs", "font-medium", "text-foreground");
  });

  it("renders AlertBanner variants with proper ARIA roles and rounded-none", () => {
    render(
      <>
        <AlertBanner variant="error" title="Save failed">
          Validation error
        </AlertBanner>
        <AlertBanner variant="success">Saved changes</AlertBanner>
      </>,
    );

    const alert = screen.getByRole("alert");
    const status = screen.getByRole("status");
    expect(alert).toHaveClass("rounded-none", "bg-destructive-bg");
    expect(alert).toHaveTextContent("Save failed");
    expect(status).toHaveClass("rounded-none", "bg-success-bg");
  });

  it("renders Checkbox with rounded-none and toggles selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox aria-label="Select item" onChange={onChange} />);

    const box = screen.getByRole("checkbox", { name: "Select item" });
    expect(box).toHaveClass("rounded-none", "border-border");
    await user.click(box);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("copies value via CopyButton and notifies once", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(
      <CopyButton value="support@example.com" successMessage="Copied address">
        support@example.com
      </CopyButton>,
    );

    await user.click(
      screen.getByRole("button", { name: "Copy support@example.com" }),
    );
    expect(writeText).toHaveBeenCalledWith("support@example.com");
    expect(notifyMocks.success).toHaveBeenCalledWith("Copied address");
  });
});
