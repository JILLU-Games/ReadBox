import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { activate, reset } = vi.hoisted(() => ({
  activate: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("@/app/initial-setup/actions", () => ({
  createFirstAdminAction: activate,
}));
vi.mock("@/app/reset-password/actions", () => ({
  completePasswordResetAction: reset,
}));

import { FirstAdminForm } from "@/components/setup/first-admin-form";

describe("QIS01 FirstAdminForm", () => {
  beforeEach(() => {
    activate.mockReset();
    reset.mockReset();
    activate.mockResolvedValue({ status: "created", resetToken: "q".repeat(43) });
    reset.mockResolvedValue({ status: "success" });
  });
  afterEach(() => cleanup());

  it("requires owner code and account identity without any default administrator password", () => {
    render(<FirstAdminForm />);
    expect(screen.getByLabelText("One-time VPS setup code")).toBeRequired();
    expect(screen.getByLabelText("Admin username")).toBeRequired();
    expect(screen.getByLabelText("Admin email")).toBeRequired();
    expect(screen.queryByText(/default password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/generate reset token/i)).not.toBeInTheDocument();
  });

  it("creates only the first administrator and then uses the pre-existing one-use reset action", async () => {
    const user = userEvent.setup();
    render(<FirstAdminForm />);
    await user.type(screen.getByLabelText("One-time VPS setup code"), "q".repeat(43));
    await user.type(screen.getByLabelText("Admin username"), "new-admin");
    await user.type(screen.getByLabelText("Admin email"), "admin@example.test");
    await user.click(screen.getByRole("button", { name: "Continue securely" }));
    expect(await screen.findByText(/administrator created/i)).toBeInTheDocument();
    expect(activate).toHaveBeenCalledOnce();
    await user.type(screen.getByLabelText("New administrator password"), "QIS-01-Synthetic-Strong-Pass456!");
    await user.type(screen.getByLabelText("Confirm new password"), "QIS-01-Synthetic-Strong-Pass456!");
    await user.click(screen.getByRole("button", { name: "Activate administrator" }));
    expect(await screen.findByText("Administrator password activated.")).toBeInTheDocument();
    expect(reset).toHaveBeenCalledOnce();
    expect(reset.mock.calls[0]?.[1]).toBeInstanceOf(FormData);
    expect(reset.mock.calls[0]?.[1]?.get("token")).toBe("q".repeat(43));
    expect(screen.getByRole("link", { name: /administrator login/i })).toHaveAttribute("href", "/vcon/login");
  });
});
