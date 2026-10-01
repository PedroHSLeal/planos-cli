import type { Command } from "commander";

import { getSyncAdapter, SYNC_ADAPTER_NAMES } from "../../../services/sync";

export default function (program: Command): void {
  program
    .command("login <adapter>")
    .description(`log in to a sync adapter (${SYNC_ADAPTER_NAMES.join(", ")})`)
    .action(async (adapter: string) => {
      await getSyncAdapter(adapter).login();
      console.log(`Logged in to ${adapter}.`);
    });
}
