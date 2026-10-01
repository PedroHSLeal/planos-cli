import type { Command } from "commander";
import { insertTask } from "../../../services/storage";
import { syncTaskCreated } from "../../../services/sync";

export default function (program: Command): void {
  program
    .command("add <task>")
    .option("-s, --section <section>", "in which stage this task is (backlog, doing, done)", 'backlog')
    .description("add a new task")
    .action(async (task: string, { section }) => {
      const id = insertTask(section, task);
      await syncTaskCreated(id);
    });
}
