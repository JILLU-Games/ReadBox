"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : "unknown error";
      console.warn(JSON.stringify({ level: "warn", event: "service_worker_registration_failed", detail }));
    });
  }, []);

  return null;
}
