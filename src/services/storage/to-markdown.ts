import { TASK_SECTION, type TaskRow, type TaskSection } from "./model";

const sections: Array<[TaskSection, string]> = [
  [TASK_SECTION.done, "# DONE"],
  [TASK_SECTION.doing, "# DOING"],
  [TASK_SECTION.backlog, "# BACKLOG"],
];

export function tasksToMarkdown(tasks: TaskRow[]): string {
  const parts: string[] = [];

  for (const [section, header] of sections) {
    const rows = tasks.filter(task => task.section === section);
    parts.push(header, "", ...rows.map(task => `${section === TASK_SECTION.done ? "- [x]" : "- [ ]"} ${task.task}`), "");
  }

  return `${parts.join("\n")}\n`;
}
