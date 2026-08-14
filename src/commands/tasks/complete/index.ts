import type { Command } from "commander";
import { completeTask } from "../../../services/storage/crud";

export default function (program: Command): void {
  program
    .command("complete <task>")
    .option("-s, --section <section>", "section where the task is located", "doing")
    .description("mark a task as DONE")
    .action(async (task: string, { section }) => {
      await completeTask(section, task)
    });
}
