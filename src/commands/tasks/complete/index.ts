import type { Command } from "commander";
import { getOldestTaskByTitle, listTasks, TASK_SECTION, type TaskRow } from "../../../services/storage";
import { renderView } from "./view";

export default function (program: Command): void {
  program
    .command("complete [task]")
    .option("-s, --section <section>", "section where the task is located", "doing")
    .description("mark a task as DONE")
    .action(async (task: string | undefined, options) => {
      let dbTasks: TaskRow[] = [];

      if (task) {
        let taskByTitle = getOldestTaskByTitle(task);
        if (!taskByTitle) throw new Error(`Error: task not found: '${task}'`);

        dbTasks.push(taskByTitle);
      }
      else {
        dbTasks = dbTasks.concat(listTasks());
      }

      await renderView({ tasks: dbTasks.filter(t => t.section !== TASK_SECTION.done) });
    });
}
