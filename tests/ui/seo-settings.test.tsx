import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SeoSettingsConsole } from "@/components/vcon/seo-settings-console";
import { emptySeoPages } from "@/core/seo/types";

vi.mock("server-only", () => ({}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const fallbacks = {
  home: {title:"AnyInbox — Existing",description:"Existing homepage description."},
  contact: {title:"Contact & Support — AnyInbox",description:"Contact fallback."},
  privacy: {title:"Privacy Policy — AnyInbox",description:"Privacy fallback."},
};

describe("SEO-01 sibling admin settings panel", () => {
  it("previews existing defaults then saves independent per-page values", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async (form: FormData) => ({
      ok:true as const,
      pageKey: form.get("pageKey") as "home" | "contact" | "privacy",
      settings: {
        title:String(form.get("title")),
        description:String(form.get("description")),
        imagePath:String(form.get("imagePath")),
      },
    }));
    render(<SeoSettingsConsole initial={{databaseConnected:true,pages:emptySeoPages()}}
      publicOrigin="https://anyinbox.cc" fallbacks={fallbacks} onSave={onSave}/>);
    expect(screen.getByText("AnyInbox — Existing")).toBeInTheDocument();
    await user.type(screen.getByLabelText("SEO title"),"AnyInbox | Inbox");
    await user.type(screen.getByLabelText("Meta description"),"Secure incoming email.");
    await user.click(screen.getByRole("button",{name:"Save SEO"}));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const data = onSave.mock.calls[0][0];
    expect(data.get("pageKey")).toBe("home");
    expect(data.get("title")).toBe("AnyInbox | Inbox");
    await user.selectOptions(screen.getByLabelText("Public page"),"privacy");
    expect(screen.getByText("Privacy Policy — AnyInbox")).toBeInTheDocument();
  });

  it("disables write on SEO DB failure without changing branding panel", () => {
    render(<SeoSettingsConsole initial={{databaseConnected:false,pages:emptySeoPages()}}
      publicOrigin="https://anyinbox.cc" fallbacks={fallbacks} onSave={vi.fn()}/>);
    expect(screen.getByRole("button",{name:"Save SEO"})).toBeDisabled();
    expect(screen.getByText(/SEO settings database is unavailable/)).toBeInTheDocument();
  });
});
