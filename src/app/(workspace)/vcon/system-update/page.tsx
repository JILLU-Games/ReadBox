import { SystemUpdateConsole } from "@/components/vcon/system-update-console";
import { env } from "@/config/env";
import { requireAdminUser } from "@/core/auth/route-guards";
import {
  getCurrentSystemVersion,
  readUpdateStatus,
  runUpdatePreflight,
} from "@/core/updates/service";

export const dynamic = "force-dynamic";

export default async function AdminSystemUpdatePage() {
  await requireAdminUser();

  const [currentVersion, initialPreflight, initialStatus] = await Promise.all([
    getCurrentSystemVersion(),
    runUpdatePreflight(),
    readUpdateStatus(),
  ]);

  return (
    <SystemUpdateConsole
      currentVersion={currentVersion}
      githubRepo={env.updateGithubRepo}
      runtimeDir={env.updateRuntimeDir}
      initialPreflight={initialPreflight}
      initialStatus={initialStatus}
    />
  );
}
