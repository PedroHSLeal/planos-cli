import { describe, expect, test } from "bun:test";

import { tasksToMarkdown } from "../src/services/storage/to-markdown";
import { TASK_SECTION, type TaskRow } from "../src/services/storage/model";
import { formatTasks, getPrintFormat } from "../src/commands/tasks/print";

describe("task markdown output", () => {
  test("groups rows in doing, done, backlog order and ignores extras", () => {
    const tasks: TaskRow[] = [
      { id: 3, task: "backlog task", section: TASK_SECTION.backlog, extras: { notes: "hidden" } },
      { id: 2, task: "done task", section: TASK_SECTION.done, extras: { completedAt: new Date() } },
      { id: 1, task: "doing task", section: TASK_SECTION.doing, extras: { startedAt: new Date() } },
    ];

    expect(tasksToMarkdown(tasks)).toBe([
      "# DOING",
      "",
      "- [ ] doing task",
      "",
      "# DONE",
      "",
      "- [x] done task",
      "",
      "# BACKLOG",
      "",
      "- [ ] backlog task",
      "",
      "",
    ].join("\n"));
    expect(tasksToMarkdown(tasks)).not.toContain("hidden");
  });

  test("requires exactly one print format", () => {
    expect(() => getPrintFormat({})).toThrow("exactly one");
    expect(() => getPrintFormat({ markdown: true, json: true })).toThrow("exactly one");
    expect(getPrintFormat({ markdown: true })).toBe("markdown");
    expect(getPrintFormat({ json: true })).toBe("json");
  });

  test("formats rows as JSON", () => {
    const tasks: TaskRow[] = [
      { id: 1, task: "task", section: TASK_SECTION.backlog, extras: {} },
    ];

    expect(formatTasks(tasks, { json: true })).toBe(JSON.stringify(tasks, null, 2));
  });
});
