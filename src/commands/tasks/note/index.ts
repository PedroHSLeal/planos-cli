import type { Command } from "commander";

import { getOldestTaskByTitle, listTasks } from "../../../services/storage";
import { renderView } from "./view";

export default function (program: Command): void {
  program
    .command("note [task]")
    .description("edit notes for a task")
    .action(async (task: string | undefined) => {
      let initialStep = task ? "editor" : "select";
      let dbTasks: any[] = [];

      if (task) {
        let taskByTitle = getOldestTaskByTitle(task);
        if (!taskByTitle) throw new Error(`Error: task not found: '${task}'`);

        dbTasks.push(taskByTitle);
      }
      else {
        dbTasks = dbTasks.concat(listTasks());
      }

      await renderView({ step: initialStep, tasks: dbTasks });
    });
}
