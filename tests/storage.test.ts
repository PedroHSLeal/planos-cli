import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";

import { initializeDatabase } from "../src/services/storage/database";
import { deserializeExtras, serializeExtras } from "../src/services/storage/extras";
import { createTaskStorage } from "../src/services/storage/crud";
import { TASK_SECTION } from "../src/services/storage/model";

function createTestStorage() {
  const database = new Database(":memory:");
  initializeDatabase(database);
  return createTaskStorage(database);
}

describe("SQLite task storage", () => {
  test("initializes the Tasks table with the required columns", () => {
    const database = new Database(":memory:");
    initializeDatabase(database);

    const tables = database
      .query("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    const columns = database.query("PRAGMA table_info(Tasks)").all() as { name: string }[];

    expect(tables.map(table => table.name)).toEqual(["Tasks"]);
    expect(columns.map(column => column.name)).toEqual(["id", "task", "section", "extras"]);
  });

  test("serializes dates and revives known date extras", () => {
    const startedAt = new Date("2026-08-13T12:00:00.000Z");
    const serialized = serializeExtras({ startedAt, notes: "note" });
    const extras = deserializeExtras(serialized);

    expect(JSON.parse(serialized).startedAt).toBe("2026-08-13T12:00:00.000Z");
    expect(extras.startedAt).toEqual(startedAt);
    expect(extras.notes).toBe("note");
  });

  test("reads an empty database", async () => {
    const storage = createTestStorage();

    expect(await storage.getTasks()).toEqual([]);
  });

  test("finds the oldest task when titles are duplicated", async () => {
    const storage = createTestStorage();
    const oldestId = await storage.addTaskToSection("backlog", "same title", { notes: "old" });
    await storage.addTaskToSection("backlog", "same title", { notes: "new" });

    expect(await storage.getOldestTaskByTitle("same title")).toEqual({
      id: oldestId,
      task: "same title",
      section: TASK_SECTION.backlog,
      extras: { notes: "old" },
    });
  });

  test("inserts rows with integer sections and descending IDs", async () => {
    const storage = createTestStorage();

    const firstId = await storage.addTaskToSection("backlog", "first");
    const secondId = await storage.addTaskToSection("doing", "second", { notes: "hello" });

    expect(secondId).toBeGreaterThan(firstId);
    expect(await storage.getTasks()).toEqual([
      { id: secondId, task: "second", section: TASK_SECTION.doing, extras: { notes: "hello" } },
      { id: firstId, task: "first", section: TASK_SECTION.backlog, extras: {} },
    ]);
  });

  test("mutates only the first matching duplicate task", async () => {
    const storage = createTestStorage();

    const firstId = await storage.addTaskToSection("backlog", "duplicate");
    const secondId = await storage.addTaskToSection("backlog", "duplicate");

    await storage.startTask("duplicate");
    await storage.deleteTask("duplicate");

    expect(await storage.getTasks()).toEqual([
      { id: secondId, task: "duplicate", section: TASK_SECTION.backlog, extras: {} },
    ]);
    expect(firstId).not.toBe(secondId);
  });

  test("starts and completes a task while recording Date extras", async () => {
    const storage = createTestStorage();
    const id = await storage.addTaskToSection("backlog", "workflow");

    await storage.startTask("workflow");
    let [started] = await storage.getTasks();
    expect(started?.id).toBe(id);
    expect(started?.section).toBe(TASK_SECTION.doing);
    expect(started?.extras.startedAt).toBeInstanceOf(Date);

    await storage.completeTask("doing", "workflow");
    [started] = await storage.getTasks();
    expect(started?.section).toBe(TASK_SECTION.done);
    expect(started?.extras.startedAt).toBeInstanceOf(Date);
    expect(started?.extras.completedAt).toBeInstanceOf(Date);
  });

  test("updates a task by internal ID", async () => {
    const storage = createTestStorage();
    const id = await storage.addTaskToSection("backlog", "before");

    await storage.updateTask(id, {
      task: "after",
      section: TASK_SECTION.doing,
      extras: { notes: "updated" },
    });

    expect(await storage.getTasks()).toEqual([
      { id, task: "after", section: TASK_SECTION.doing, extras: { notes: "updated" } },
    ]);
  });

  test("replaces notes by ID while preserving other extras", async () => {
    const storage = createTestStorage();
    const id = await storage.addTaskToSection("doing", "with notes", {
      notes: "before",
      startedAt: new Date("2026-08-14T10:00:00.000Z"),
      custom: "keep",
    });
    const task = await storage.getOldestTaskByTitle("with notes");

    await storage.updateTask(id, {
      extras: {
        ...task!.extras,
        notes: "after",
      },
    });

    expect((await storage.getOldestTaskByTitle("with notes"))?.extras).toEqual({
      notes: "after",
      startedAt: new Date("2026-08-14T10:00:00.000Z"),
      custom: "keep",
    });

    await storage.updateTask(id, { extras: { ...task!.extras, notes: "" } });
    expect((await storage.getOldestTaskByTitle("with notes"))?.extras.notes).toBe("");
  });

  test("reports missing task and ID errors", async () => {
    const storage = createTestStorage();

    expect(storage.startTask("missing")).rejects.toThrow("task not found");
    expect(storage.deleteTask("missing")).rejects.toThrow("task not found");
    expect(storage.updateTask(99, { task: "missing" })).rejects.toThrow("task not found");
  });
});
