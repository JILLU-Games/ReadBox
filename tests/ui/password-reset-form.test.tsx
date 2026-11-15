import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ResetActionState = { status: "idle" | "success" | "invalid" };

const { completePasswordResetAction } = vi.hoisted(() => ({
  completePasswordResetAction: vi.fn(
    async (
      previousState: ResetActionState,
      formData: FormData,
    ): Promise<ResetActionState> => {
      void previousState;
      void formData;
      return { status: "success" };
    },
  ),
}));

vi.mock("@/app/reset-password/actions", () => ({
  completePasswordResetAction,
}));

import { PasswordResetForm } from "@/components/auth/password-reset-form";

const resetToken = "r".repeat(43);
const newPassword = "synthetic-reset-password";

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  confirmation = newPassword,
) {
  await user.type(screen.getByRole("textbox", { name: "Reset token" }), resetToken);
  await user.type(screen.getByLabelText("New password"), newPassword);
  await user.type(
    screen.getByLabelText("Confirm new password"),
    confirmation,
  );
}

describe("PasswordResetForm", () => {
  beforeEach(() => {
    completePasswordResetAction.mockReset();
    completePasswordResetAction.mockResolvedValue({ status: "success" });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders accessible reset fields and password requirements", () => {
    render(<PasswordResetForm />);

    expect(screen.getByRole("textbox", { name: "Reset token" })).toBeRequired();
    expect(screen.getByLabelText("New password")).toHaveAttribute(
      "minLength",
      "15",
    );
    expect(screen.getByLabelText("Confirm new password")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("shows mismatch feedback and does not submit mismatched passwords", async () => {
    const user = userEvent.setup();
    render(<PasswordResetForm />);
    await fillForm(user, "different-synthetic-password");

    const confirmation = screen.getByLabelText("Confirm new password");
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(confirmation).toHaveAttribute("aria-invalid", "true");

    await user.click(screen.getByRole("button", { name: "Set new password" }));
    expect(completePasswordResetAction).not.toHaveBeenCalled();
  });

  it("submits matching passwords and exposes the pending and success states", async () => {
    let resolveAction!: (state: ResetActionState) => void;
    completePasswordResetAction.mockImplementationOnce(
      async () =>
        new Promise<ResetActionState>((resolve) => {
          resolveAction = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<PasswordResetForm />);
    await fillForm(user);

    await user.click(screen.getByRole("button", { name: "Set new password" }));
    const pendingButton = await screen.findByRole("button", {
      name: "Updating password...",
    });
    expect(pendingButton).toBeDisabled();
    expect(completePasswordResetAction).toHaveBeenCalledOnce();

    const submittedFormData = completePasswordResetAction.mock.calls[0]?.[1];
    expect(submittedFormData).toBeInstanceOf(FormData);
    expect(submittedFormData?.get("password")).toBe(newPassword);
    expect(submittedFormData?.get("confirmation")).toBe(newPassword);

    resolveAction({ status: "success" });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Password reset complete. You can sign in now.",
    );
  });

  it("shows safe feedback when the server action rejects the reset", async () => {
    completePasswordResetAction.mockResolvedValueOnce({ status: "invalid" });
    const user = userEvent.setup();
    render(<PasswordResetForm />);
    await fillForm(user);

    await user.click(screen.getByRole("button", { name: "Set new password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Reset could not be completed. Check the token and password requirements.",
    );
  });
});
