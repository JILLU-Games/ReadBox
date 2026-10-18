"use client";

import { useTheme } from "next-themes";
import { Toaster as SonnerToaster, toast } from "sonner";

export function NotificationToaster() {
  const { resolvedTheme } = useTheme();
  return <SonnerToaster theme={resolvedTheme === "dark" ? "dark" : "light"} position="top-right" richColors />;
}

export const notify = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
  info: (message: string) => toast(message),
};
