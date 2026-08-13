import type { Command } from "commander";
import { getTasks, addTaskToSection } from "../../../services/storage";

export function addCommand(program: Command): void {
  program
    .command("add <task>")
    .description("add a new task")
    .action(async (task: string) => {
      await addTaskToSection("backlog", task);
    });
}