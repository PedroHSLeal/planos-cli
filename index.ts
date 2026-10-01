import { Command } from "commander";
import addCommand from "./src/commands/tasks/add";
import deleteCommand from "./src/commands/tasks/delete";
import completeCommand from "./src/commands/tasks/complete";
import printCommand from "./src/commands/tasks/print";
import exportCommand from "./src/commands/tasks/export";
import noteCommand from "./src/commands/tasks/note";
import startCommand from "./src/commands/tasks/start";
import loginCommand from "./src/commands/tasks/login";

const program = new Command();

program
  .name("planos")
  .description("a tiny todo manager")
  .option("--source <source>", "the source of where the program should operate", "tasks")
  .version("1.0.0");

addCommand(program);
deleteCommand(program);
completeCommand(program);
printCommand(program);
exportCommand(program);
noteCommand(program);
startCommand(program);
loginCommand(program);

program.parseAsync(process.argv);
