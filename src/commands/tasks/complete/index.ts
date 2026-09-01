import type { Command } from "commander";
import { getOldestTaskByTitle, listTasks } from "../../../services/storage";
import { renderView } from "./view";

export default function (program: Command): void {
  program
    .command("complete [task]")
    .option("-s, --section <section>", "section where the task is located", "doing")
    .description("mark a task as DONE")
    .action(async (task: string | undefined, options) => {
      console.log(program.optsWithGlobals())
      
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
