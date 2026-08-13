import type { Command } from "commander";
import { startTask } from "../../../services/storage";

export default function (program: Command): void {
  program
    .command("start <task>")
    .description("start a task registered in 'backlog'")
    .action(async (task: string) => {
      await startTask(task);
    });
}