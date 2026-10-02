import type { Command } from "commander";

import { getSyncAdapter, syncAll, SYNC_ADAPTER_NAMES, type SyncReport } from "../../../services/sync";

export default function (program: Command): void {
  program
    .command("sync <adapter>")
    .description(`two-way sync of local tasks with a sync adapter (${SYNC_ADAPTER_NAMES.join(", ")})`)
    .action(async (adapter: string) => {
      const report = await syncAll(getSyncAdapter(adapter));

      console.log(`Synced with ${adapter}: ${formatCounts("pushed", report.pushed)}; ${formatCounts("pulled", report.pulled)}.`);
      for (const error of report.errors) console.error(`planos: ${adapter} sync failed for ${error}`);
      if (report.errors.length > 0) process.exitCode = 1;
    });
}

function formatCounts(direction: string, { created, updated, deleted }: SyncReport["pushed"]): string {
  return `${direction} ${created} created, ${updated} updated, ${deleted} deleted`;
}
