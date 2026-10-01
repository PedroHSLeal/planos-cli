import type { Command } from "commander";
import { getOldestTaskByTitle, listTasks } from "../../../services/storage";
import { renderView } from "./view";

export default function (program: Command): void {
  program
    .command("delete [task]")
    .description("delete task")
    .action(async (task: string | undefined) => {
      let dbTasks: any[] = [];

      if (task) {
        let taskByTitle = getOldestTaskByTitle(task);
        if (!taskByTitle) throw new Error(`Error: task not found: '${task}'`);

        dbTasks.push(taskByTitle);
      }
      else {
        dbTasks = dbTasks.concat(listTasks());
      }

      await renderView({ tasks: dbTasks });
    });
}
