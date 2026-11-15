import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ServiceWorkerRegistration } from "@/components/providers/service-worker-registration";

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "serviceWorker");
  vi.unstubAllEnvs();
});

describe("ServiceWorkerRegistration", () => {
  it("registers the public worker in production when supported", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const register = vi.fn().mockResolvedValue({});
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    render(<ServiceWorkerRegistration />);

    await waitFor(() => expect(register).toHaveBeenCalledWith("/sw.js"));
  });

  it("does not register the worker outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const register = vi.fn().mockResolvedValue({});
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    render(<ServiceWorkerRegistration />);

    expect(register).not.toHaveBeenCalled();
  });

  it("does nothing when the browser does not support service workers", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => render(<ServiceWorkerRegistration />)).not.toThrow();
  });
});
