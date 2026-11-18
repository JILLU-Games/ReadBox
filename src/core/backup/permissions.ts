import { requireAdminUser } from "@/core/auth/route-guards";
import "server-only";

export async function requireBackupAdmin() {
  return requireAdminUser();
}
