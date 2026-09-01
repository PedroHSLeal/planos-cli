import { describe, expect, test } from "bun:test";

import { TASK_SECTION, type TaskRow } from "../../src/services/storage/model";
import { tasksToMarkdown } from "../../src/services/storage/to-markdown";

function task(id: number, name: string, section: TaskRow["section"]): TaskRow {
  return { id, task: name, section, extras: {} };
}

describe("tasksToMarkdown", () => {
  test("renders headers in order DOING, DONE, BACKLOG", () => {
    const markdown = tasksToMarkdown([]);
    expect(markdown).toContain("# DOING");
    expect(markdown).toContain("# DONE");
    expect(markdown).toContain("# BACKLOG");
    expect(markdown.indexOf("# DOING")).toBeLessThan(markdown.indexOf("# DONE"));
    expect(markdown.indexOf("# DONE")).toBeLessThan(markdown.indexOf("# BACKLOG"));
  });

  test("renders done tasks with checked boxes, others unchecked", () => {
    const markdown = tasksToMarkdown([
      task(1, "done thing", TASK_SECTION.done),
      task(2, "doing thing", TASK_SECTION.doing),
      task(3, "backlog thing", TASK_SECTION.backlog),
    ]);
    expect(markdown).toContain("- [x] done thing");
    expect(markdown).toContain("- [ ] doing thing");
    expect(markdown).toContain("- [ ] backlog thing");
  });

  test("groups tasks under their own sections", () => {
    const markdown = tasksToMarkdown([
      task(1, "b1", TASK_SECTION.backlog),
      task(2, "d1", TASK_SECTION.doing),
    ]);
    const doingPart = markdown.split("# DOING")[1]!.split("# DONE")[0]!;
    const backlogPart = markdown.split("# BACKLOG")[1]!;
    expect(doingPart).toContain("- [ ] d1");
    expect(doingPart).not.toContain("b1");
    expect(backlogPart).toContain("- [ ] b1");
    expect(backlogPart).not.toContain("d1");
  });
});
