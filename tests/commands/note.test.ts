import { describe, expect, mock, test } from "bun:test";
import { Command } from "commander";

import * as model from "../../src/services/storage/model";
import * as toMarkdown from "../../src/services/storage/to-markdown";

import { TASK_SECTION, type TaskRow } from "../../src/services/storage/model";

const sampleTask: TaskRow = { id: 1, task: "sample", section: TASK_SECTION.doing, extras: {} };

let oldestTask: TaskRow | undefined;
let allTasks: TaskRow[] = [];

mock.module("../../src/services/storage", () => ({
  ...model,
  ...toMarkdown,
  insertTask: mock(() => 1),
  listTasks: mock(() => allTasks),
  getTaskById: mock(() => undefined),
  getOldestTaskByTitle: mock((_title: string) => oldestTask),
  updateTask: mock(() => {}),
  deleteTaskById: mock(() => {}),
}));

const renderView = mock(async (_props: Record<string, unknown>) => {});
mock.module("../../src/commands/tasks/note/view", () => ({ renderView }));

const noteCommand = (await import("../../src/commands/tasks/note")).default;

describe("planos note", () => {
  test("opens the editor step when a task name is given", async () => {
    oldestTask = sampleTask;
    renderView.mockClear();

    const program = new Command();
    noteCommand(program);
    await program.parseAsync(["note", "sample"], { from: "user" });

    expect(renderView).toHaveBeenCalledTimes(1);
    expect(renderView).toHaveBeenCalledWith({ step: "editor", tasks: [sampleTask] });
  });

  test("opens the select step when no task name is given", async () => {
    allTasks = [sampleTask, { ...sampleTask, id: 2, task: "second" }];
    renderView.mockClear();

    const program = new Command();
    noteCommand(program);
    await program.parseAsync(["note"], { from: "user" });

    expect(renderView).toHaveBeenCalledWith({ step: "select", tasks: allTasks });
  });

  test("throws when the named task does not exist", async () => {
    oldestTask = undefined;

    const program = new Command();
    noteCommand(program);
    await expect(
      program.parseAsync(["note", "missing"], { from: "user" }),
    ).rejects.toThrow("task not found");
  });
});
