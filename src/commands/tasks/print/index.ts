import type { Command } from "commander";
import { getTasks } from "../../../services/storage";

export default function (program: Command): void {
  program
    .command("print", { isDefault: true })
    .description("print pending tasks")
    .action(async (options) => {
      console.log(await getTasks("raw"));
    });
}
