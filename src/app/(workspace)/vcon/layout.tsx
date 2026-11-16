import { requireAdminUser } from "@/core/auth/route-guards";
import type { ReactNode } from "react";

export default async function AdminVconLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireAdminUser();
  return children;
}
