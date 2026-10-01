import { describe, expect, mock, test } from "bun:test";
import { Command } from "commander";

const insertTask = mock((_section: string, _task: string) => 1);

mock.module("../../src/services/storage", () => ({
  insertTask,
  listTasks: mock(() => []),
  getTaskById: mock(() => undefined),
  getOldestTaskByTitle: mock((_title: string) => undefined),
  updateTask: mock(() => {}),
  deleteTaskById: mock(() => {}),
}));

const syncTaskCreated = mock(async (_id: number) => {});
mock.module("../../src/services/sync", () => ({
  syncTaskCreated,
  syncTaskUpdated: mock(async () => {}),
  syncTaskDeleted: mock(async () => {}),
  setSyncAdapter: mock(() => {}),
}));

const addCommand = (await import("../../src/commands/tasks/add")).default;

describe("planos add", () => {
  test("adds a task to backlog by default", async () => {
    insertTask.mockClear();

    const program = new Command();
    addCommand(program);
    await program.parseAsync(["add", "my task"], { from: "user" });

    expect(insertTask).toHaveBeenCalledTimes(1);
    expect(insertTask).toHaveBeenCalledWith("backlog", "my task");
  });

  test("adds a task to a custom section with -s", async () => {
    insertTask.mockClear();

    const program = new Command();
    addCommand(program);
    await program.parseAsync(["add", "my task", "-s", "doing"], { from: "user" });

    expect(insertTask).toHaveBeenCalledWith("doing", "my task");
  });

  test("syncs the newly inserted task", async () => {
    syncTaskCreated.mockClear();

    const program = new Command();
    addCommand(program);
    await program.parseAsync(["add", "my task"], { from: "user" });

    expect(syncTaskCreated).toHaveBeenCalledTimes(1);
    expect(syncTaskCreated).toHaveBeenCalledWith(1);
  });
});
