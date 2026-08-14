import type { Command } from "commander";

import { getTasks } from "../../../services/storage";
import type { TaskRow } from "../../../services/storage/model";
import { tasksToMarkdown } from "../../../services/storage/to-markdown";

export type PrintOptions = {
  markdown?: boolean;
  json?: boolean;
};

export function getPrintFormat(options: PrintOptions): "markdown" | "json" {
  if (Boolean(options.markdown) === Boolean(options.json)) {
    throw new Error("print requires exactly one of --markdown or --json");
  }

  return options.markdown ? "markdown" : "json";
}

export function formatTasks(tasks: TaskRow[], options: PrintOptions): string {
  return getPrintFormat(options) === "markdown"
    ? tasksToMarkdown(tasks)
    : JSON.stringify(tasks);
}

export default function (program: Command): void {
  program
    .command("print", { isDefault: true })
    .option("--markdown", "print tasks as markdown")
    .option("--json", "print tasks as JSON")
    .description("print tasks")
    .action(async (options: PrintOptions) => {
      console.log(formatTasks(await getTasks(), options));
    });
}
