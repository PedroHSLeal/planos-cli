import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";

import { TASK_SECTION } from "../../src/services/storage/model";
import { openDatabase } from "../../src/services/storage/database";
import * as repository from "../../src/services/storage/repository";
import { cleanupTempDir, makeTempDir, tempDbPath } from "../helpers/tmp";

let db: Database;
let tempDir: string;

beforeEach(() => {
  tempDir = makeTempDir();
  db = openDatabase(tempDbPath(tempDir));
});

afterEach(() => {
  db.close();
  cleanupTempDir(tempDir);
});

describe("insertTask / listTasks", () => {
  test("inserts and lists a task", () => {
    const id = repository.insertTask("backlog", "my task", {}, db);
    expect(id).toBeGreaterThan(0);
    const tasks = repository.listTasks(db);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toEqual({ id, task: "my task", section: TASK_SECTION.backlog, extras: {} });
  });

  test("maps section names to values: done=0, doing=1, backlog=2", () => {
    repository.insertTask("done", "d", {}, db);
    repository.insertTask("doing", "o", {}, db);
    repository.insertTask("backlog", "b", {}, db);
    const sections = repository.listTasks(db).map((t) => t.section);
    expect(sections).toContain(TASK_SECTION.done);
    expect(sections).toContain(TASK_SECTION.doing);
    expect(sections).toContain(TASK_SECTION.backlog);
  });

  test("lists tasks newest first", () => {
    repository.insertTask("backlog", "first", {}, db);
    repository.insertTask("backlog", "second", {}, db);
    repository.insertTask("backlog", "third", {}, db);
    expect(repository.listTasks(db).map((t) => t.task)).toEqual(["third", "second", "first"]);
  });

  test("serializes extras on write and deserializes on read", () => {
    repository.insertTask("doing", "with extras", { notes: "note text" }, db);
    expect(repository.listTasks(db)[0]?.extras).toEqual({ notes: "note text" });
  });

  test("rejects unknown section", () => {
    expect(() => {
      // @ts-expect-error invalid section on purpose
      repository.insertTask("bogus", "x", {}, db);
    }).toThrow();
  });

  test("DB CHECK constraint rejects out-of-range section", () => {
    expect(() => db.run("INSERT INTO Tasks (task, section, extras) VALUES ('bad', 3, '{}')")).toThrow();
  });
});

describe("getTaskById", () => {
  test("finds a task by id", () => {
    const id = repository.insertTask("doing", "find me", {}, db);
    expect(repository.getTaskById(id, db)?.task).toBe("find me");
  });

  test("returns undefined for a missing id", () => {
    expect(repository.getTaskById(9999, db)).toBeUndefined();
  });
});

describe("getOldestTaskByTitle", () => {
  test("returns the oldest task among duplicate titles", () => {
    const first = repository.insertTask("backlog", "dup", {}, db);
    repository.insertTask("doing", "dup", {}, db);
    expect(repository.getOldestTaskByTitle("dup", db)?.id).toBe(first);
  });

  test("returns undefined for a missing title", () => {
    expect(repository.getOldestTaskByTitle("nope", db)).toBeUndefined();
  });
});

describe("updateTask", () => {
  test("updates only the task text on a partial update", () => {
    const id = repository.insertTask("backlog", "original", {}, db);
    repository.updateTask(id, { task: "renamed" }, db);
    const updated = repository.getTaskById(id, db)!;
    expect(updated.task).toBe("renamed");
    expect(updated.section).toBe(TASK_SECTION.backlog);
  });

  test("updates section and extras together", () => {
    const id = repository.insertTask("backlog", "task", {}, db);
    repository.updateTask(id, { section: TASK_SECTION.doing, extras: { notes: "n" } }, db);
    const updated = repository.getTaskById(id, db)!;
    expect(updated.section).toBe(TASK_SECTION.doing);
    expect(updated.extras).toEqual({ notes: "n" });
  });

  test("throws when the update has no fields", () => {
    const id = repository.insertTask("backlog", "task", {}, db);
    expect(() => repository.updateTask(id, {}, db)).toThrow("Task update requires at least one field");
  });

  test("throws when the task id does not exist", () => {
    expect(() => repository.updateTask(9999, { task: "x" }, db)).toThrow("task not found");
  });
});

describe("deleteTaskById", () => {
  test("deletes a task", () => {
    const id = repository.insertTask("backlog", "gone", {}, db);
    repository.deleteTaskById(id, db);
    expect(repository.getTaskById(id, db)).toBeUndefined();
  });

  test("throws when deleting a missing id", () => {
    expect(() => repository.deleteTaskById(9999, db)).toThrow("task not found");
  });
});
