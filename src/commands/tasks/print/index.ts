import type { Command } from "commander";

import { listTasks } from "../../../services/storage";
import { tasksToMarkdown } from "../../../services/storage/to-markdown";

export type PrintOptions = {
  markdown?: boolean;
  json?: boolean;
};

export default function (program: Command): void {
  program
    .command("print", { isDefault: true })
    .option("--markdown", "print tasks as markdown", true)
    .option("--json", "print tasks as JSON", false)
    .description("print tasks")
    .action(async (options: PrintOptions) => {
      const tasks = listTasks();
      if (options.json) console.log(JSON.stringify(tasks, null, 2));
      else console.log(tasksToMarkdown(tasks));
    });
}
