import { AppShell } from "@/components/layout/app-shell";
import { requireWorkspaceUser } from "@/core/auth/route-guards";
import type { ReactNode } from "react";

export default async function WorkspaceLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireWorkspaceUser();

  return <AppShell>{children}</AppShell>;
}
