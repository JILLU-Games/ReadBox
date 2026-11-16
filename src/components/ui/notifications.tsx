"use client";

import { useTheme } from "next-themes";
import { Toaster as SonnerToaster, toast } from "sonner";

export function NotificationToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <SonnerToaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "!rounded-none !border !border-border !bg-card !text-card-foreground !shadow-none !text-xs !py-2.5 !px-3",
          title: "!text-xs !font-medium",
          description: "!text-xs !text-muted-foreground",
        },
      }}
    />
  );
}

export const notify = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
  info: (message: string) => toast(message),
};
