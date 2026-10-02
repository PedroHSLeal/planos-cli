import type { Command } from "commander";
import { insertTask } from "../../../services/storage";

export default function (program: Command): void {
  program
    .command("add <task>")
    .option("-s, --section <section>", "in which stage this task is (backlog, doing, done)", "backlog")
    .description("insert a new task")
    .action(async (task: string, { section }) => {
      insertTask(section, task);
    });
}
