import type { Command } from "commander";
import { getOldestTaskByTitle, listTasks } from "../../../services/storage";
import { renderView } from "./view";

export default function (program: Command): void {
  program
    .command("start [task]")
    .option("-s, --section <section>", "section where the task is located", "backlog")
    .description("start a task registered")
    .action(async (task: string) => {
      let dbTasks: any[] = [];

      if (task) {
        let taskByTitle = await getOldestTaskByTitle(task);
        if (!taskByTitle) throw new Error(`Error: task not found: '${task}'`);

        dbTasks.push(taskByTitle);
      }
      else {
        dbTasks = dbTasks.concat(await listTasks());
      }

      await renderView({ tasks: dbTasks });
    });
}
