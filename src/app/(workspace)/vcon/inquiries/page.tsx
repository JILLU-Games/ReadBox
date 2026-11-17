import {
  InquiriesConsole,
  type InquiriesConsoleBundle,
} from "@/components/vcon/inquiries-console";
import { env } from "@/config/env";
import { requireAdminUser } from "@/core/auth/route-guards";
import {
  listContactSubmissions,
  SERVICE_LABELS,
  type PersistedContactSubmissionItem,
} from "@/core/contact/service";
import { getPrismaClient } from "@/core/database/client";

export const dynamic = "force-dynamic";

const DEMO_FALLBACK_INQUIRIES: readonly PersistedContactSubmissionItem[] = [
  {
    requestId: "demo9f4b2c81e0a347129c01a8b2e3d4f501",
    fullName: "Elena Rostova",
    workEmail: "elena.rostova@nordicops.io",
    company: "NordicOps Infrastructure",
    phone: "+46 8 501 224 10",
    serviceType: "business",
    serviceLabel: SERVICE_LABELS.business,
    teamSize: "21-50",
    message:
      "We want to onboard three custom domains with dedicated read-only QA and billing inboxes for our engineering release pipeline.",
    submittedAt: "2026-11-16T08:15:00.000Z",
  },
  {
    requestId: "demo7a1e3d90c2b448108f32b7c1d9e0a102",
    fullName: "Marcus Vance",
    workEmail: "m.vance@fintechshield.org",
    company: "FintechShield",
    phone: "+1 (415) 890-4312",
    serviceType: "team",
    serviceLabel: SERVICE_LABELS.team,
    teamSize: "6-20",
    message:
      "Looking to expand our team mailbox quota from 5 to 25 mailboxes for automated compliance verification workflows.",
    submittedAt: "2026-11-15T16:40:00.000Z",
  },
];

export default async function VconInquiriesPage({
  searchParams,
}: {
  readonly searchParams?: Promise<{
    readonly q?: string;
    readonly service?: string;
  }>;
}) {
  await requireAdminUser();
  const params = (await searchParams) ?? {};
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const serviceFilter =
    typeof params.service === "string" && params.service in SERVICE_LABELS
      ? params.service
      : "";

  const demoMode =
    env.nodeEnv === "development" && env.devAuthMode === "demo";
  const databaseConfigured = Boolean(env.databaseUrl);
  let databaseConnected = false;
  let allItems: readonly PersistedContactSubmissionItem[] = [];

  if (databaseConfigured) {
    try {
      const prisma = getPrismaClient();
      await prisma.$queryRaw`SELECT 1`;
      databaseConnected = true;
      allItems = await listContactSubmissions({ prisma, limit: 150 });
    } catch {
      databaseConnected = false;
      if (demoMode) {
        allItems = await listContactSubmissions({ prisma: null, limit: 150 });
      }
    }
  } else if (demoMode) {
    allItems = await listContactSubmissions({ prisma: null, limit: 150 });
  }

  if (demoMode && !databaseConnected) {
    const existingIds = new Set(allItems.map((item) => item.requestId));
    const merged = [...allItems];
    for (const sample of DEMO_FALLBACK_INQUIRIES) {
      if (!existingIds.has(sample.requestId)) {
        merged.push(sample);
      }
    }
    allItems = merged;
  }

  const topicCounts = {
    total: allItems.length,
    personal: allItems.filter((item) => item.serviceType === "personal").length,
    team: allItems.filter((item) => item.serviceType === "team").length,
    business: allItems.filter((item) => item.serviceType === "business").length,
    support: allItems.filter(
      (item) =>
        item.serviceType === "support" ||
        item.serviceType === "other" ||
        !["personal", "team", "business"].includes(item.serviceType),
    ).length,
  };

  const normalizedQuery = query.toLowerCase();
  const filteredItems = allItems.filter((item) => {
    if (serviceFilter && item.serviceType !== serviceFilter) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return (
      item.fullName.toLowerCase().includes(normalizedQuery) ||
      item.workEmail.toLowerCase().includes(normalizedQuery) ||
      item.company.toLowerCase().includes(normalizedQuery) ||
      item.phone.toLowerCase().includes(normalizedQuery) ||
      item.requestId.toLowerCase().includes(normalizedQuery) ||
      item.message.toLowerCase().includes(normalizedQuery)
    );
  });

  const bundle: InquiriesConsoleBundle = {
    databaseConfigured,
    databaseConnected,
    demoMode,
    query,
    serviceFilter,
    totalCount: filteredItems.length,
    items: filteredItems,
    topicCounts,
  };

  return <InquiriesConsole bundle={bundle} />;
}
