import type { Command } from "commander";

import { renderView } from "../../../tui";
import { getOldestTaskByTitle, updateTask } from "../../../services/storage";
import type { Extras, TaskRow, TaskUpdate } from "../../../services/storage/model";

type NoteDependencies = {
  findTask: (task: string) => Promise<TaskRow | undefined>;
  saveTask: (id: number, changes: TaskUpdate) => Promise<void>;
  render: (onConfirm: (plainText: string) => Promise<void>) => Promise<unknown>;
};

export async function runNote(task: string, dependencies: NoteDependencies): Promise<void> {
  const existingTask = await dependencies.findTask(task);
  if (!existingTask) throw new Error(`Error: task not found: '${task}'`);

  await dependencies.render(async (plainText: string) => {
    const extras: Extras = { ...existingTask.extras, notes: plainText };
    await dependencies.saveTask(existingTask.id, { extras });
  });
}

export default function noteCommand(program: Command): void {
  program
    .command("note <task>")
    .description("edit notes for a task")
    .action(async (task: string) => {
      await runNote(task, {
        findTask: getOldestTaskByTitle,
        saveTask: updateTask,
        render: renderView,
      });
    });
}
