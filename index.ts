import { Command } from "commander";
import { addCommand } from "./src/commands/tasks/add";
import completeCommand from "./src/commands/tasks/complete";
import listCommand from "./src/commands/tasks/print";
import noteCommand from "./src/commands/tasks/note";
import startCommand from "./src/commands/tasks/start";

const program = new Command();

program
  .name("planos")
  .description("a tiny todo manager")
  .version("1.0.0");

addCommand(program);
completeCommand(program);
listCommand(program);
noteCommand(program);
startCommand(program);

program.parseAsync(process.argv);
