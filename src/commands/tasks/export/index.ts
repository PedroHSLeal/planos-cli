import type { Command } from "commander";

import { writeFile } from "node:fs/promises";

import { listTasks } from "../../../services/storage";

export default function (program: Command): void {
  program
    .command("export")
    .description("export tasks database as JSON format")
    .action(async () => {
      const jsonTasks = JSON.stringify(listTasks(), null, 2);
      await writeFile(`${process.cwd()}\\tasks.json`, jsonTasks, { encoding: "utf8" })
      console.log(jsonTasks);
    });
}
