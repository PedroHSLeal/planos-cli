import { describe, expect, mock, test } from "bun:test";
import { Command } from "commander";

import { TASK_SECTION, type TaskRow } from "../../src/services/storage/model";

const sampleTask: TaskRow = { id: 1, task: "sample", section: TASK_SECTION.backlog, extras: {} };

let oldestTask: TaskRow | undefined;
let allTasks: TaskRow[] = [];

mock.module("../../src/services/storage", () => ({
  insertTask: mock(() => 1),
  listTasks: mock(() => allTasks),
  getTaskById: mock(() => undefined),
  getOldestTaskByTitle: mock((_title: string) => oldestTask),
  updateTask: mock(() => {}),
  deleteTaskById: mock(() => {}),
}));

const renderView = mock(async (_props: { tasks: TaskRow[] }) => {});
mock.module("../../src/commands/tasks/start/view", () => ({ renderView }));

const startCommand = (await import("../../src/commands/tasks/start")).default;

describe("planos start", () => {
  test("looks up the oldest task by title and renders it", async () => {
    oldestTask = sampleTask;
    renderView.mockClear();

    const program = new Command();
    startCommand(program);
    await program.parseAsync(["start", "sample"], { from: "user" });

    expect(renderView).toHaveBeenCalledTimes(1);
    expect(renderView).toHaveBeenCalledWith({ tasks: [sampleTask] });
  });

  test("throws when the named task does not exist", async () => {
    oldestTask = undefined;

    const program = new Command();
    startCommand(program);
    await expect(
      program.parseAsync(["start", "missing"], { from: "user" }),
    ).rejects.toThrow("task not found");
  });

  test("renders all tasks when no task name is given", async () => {
    allTasks = [sampleTask, { ...sampleTask, id: 2, task: "second" }];
    renderView.mockClear();

    const program = new Command();
    startCommand(program);
    await program.parseAsync(["start"], { from: "user" });

    expect(renderView).toHaveBeenCalledWith({ tasks: allTasks });
  });
});
