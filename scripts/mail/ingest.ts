import "dotenv/config";
import { env } from "@/config/env";
import { parseWorkerArgs, runIngestionWorkerLoop } from "@/workers/ingestion";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(
      "Usage: npm run mail:ingest -- [--once | --watch] [--interval <seconds>] [--mailbox <localPart>] [--dry-run]",
    );
    return;
  }

  const options = parseWorkerArgs(args, env.ingestionIntervalSeconds);
  const controller = new AbortController();

  const stop = () => {
    controller.abort();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  const summary = await runIngestionWorkerLoop(options, controller.signal);
  console.log(
    JSON.stringify({
      status: summary.status,
      scanned: summary.scanned,
      created: summary.created,
      duplicates: summary.duplicates,
      oversized: summary.oversized,
      skippedMissing: summary.skippedMissing,
      errors: summary.errors,
      dryRun: summary.dryRun,
    }),
  );

  if (summary.errors > 0 || summary.status === "lock_busy") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
