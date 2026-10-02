import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";

import { openDatabase } from "../../src/services/storage/database";
import * as repository from "../../src/services/storage/repository";
import { TASK_SECTION } from "../../src/services/storage/model";
import { getSyncLink, saveSyncLink } from "../../src/services/storage/sync-links";
import type { TaskSyncAdapter } from "../../src/services/sync/adapter";
import { createGoogleTasksAdapter, GOOGLE_TASKS_PROVIDER } from "../../src/services/sync/adapters/google-tasks/adapter";
import { GoogleTasksApiError, type GoogleTask, type GoogleTasksClient } from "../../src/services/sync/adapters/google-tasks/client";
import { syncAll } from "../../src/services/sync/engine";
import { cleanupTempDir, makeTempDir, tempDbPath } from "../helpers/tmp";

// In-memory stand-in for the Google Tasks API, keyed by remote id.
function createFakeClient() {
  const tasks = new Map<string, GoogleTask>();
  const calls: string[] = [];
  let nextId = 1;
  const notFound = () => new GoogleTasksApiError(404, "not found");

  const client: GoogleTasksClient = {
    async listTasks() {
      calls.push("list");
      return [...tasks.values()].map(task => ({ ...task }));
    },
    async getTask(_list, id) {
      const task = tasks.get(id);
      if (!task) throw notFound();
      return { ...task };
    },
    async insertTask(_list, task) {
      calls.push("insert");
      const id = `g${nextId++}`;
      tasks.set(id, { ...task, id });
      return { ...task, id };
    },
    async patchTask(_list, id, patch) {
      calls.push("patch");
      const task = tasks.get(id);
      if (!task) throw notFound();
      Object.assign(task, patch);
      return { ...task };
    },
    async deleteTask(_list, id) {
      calls.push("delete");
      if (!tasks.delete(id)) throw notFound();
    },
  };

  return { client, tasks, calls };
}

let db: Database;
let tempDir: string;
let remote: ReturnType<typeof createFakeClient>;
let adapter: TaskSyncAdapter;

beforeEach(() => {
  tempDir = makeTempDir();
  db = openDatabase(tempDbPath(tempDir));
  remote = createFakeClient();
  adapter = createGoogleTasksAdapter({ client: remote.client, taskListId: "list", login: async () => {}, database: db });
});

afterEach(() => {
  db.close();
  cleanupTempDir(tempDir);
});

const remoteIdOf = (taskId: number) => getSyncLink(taskId, GOOGLE_TASKS_PROVIDER, db)!.remoteId;
const titles = () => repository.listTasks(db).map(task => task.task).sort();

describe("syncAll", () => {
  test("pushes unsynced local tasks", async () => {
    const id = repository.insertTask("doing", "local task", { notes: "n" }, db);

    const report = await syncAll(adapter, db);

    expect(report.pushed).toEqual({ created: 1, updated: 0, deleted: 0 });
    expect(report.errors).toEqual([]);
    expect(remote.tasks.get(remoteIdOf(id))).toMatchObject({ title: "local task", notes: JSON.stringify({ notes: "n" }) });
  });

  test("pulls unsynced remote tasks", async () => {
    remote.tasks.set("r1", { id: "r1", title: "open", notes: "typed in the app", status: "needsAction" });
    remote.tasks.set("r2", { id: "r2", title: "finished", status: "completed", completed: "2026-01-02T03:04:05.000Z" });

    const report = await syncAll(adapter, db);

    expect(report.pulled.created).toBe(2);
    const [finished, open] = repository.listTasks(db).sort((a, b) => a.task.localeCompare(b.task));
    expect(open).toMatchObject({ section: TASK_SECTION.backlog, extras: { notes: "typed in the app" } });
    expect(finished).toMatchObject({ section: TASK_SECTION.done, extras: { completedAt: new Date("2026-01-02T03:04:05.000Z") } });
    // Plain-text notes are normalized to planos JSON so the next sync is a no-op.
    expect(remote.tasks.get("r1")?.notes).toBe(JSON.stringify({ notes: "typed in the app" }));
  });

  test("a second sync with no changes does nothing", async () => {
    repository.insertTask("backlog", "local", {}, db);
    remote.tasks.set("r1", { id: "r1", title: "remote", notes: "plain", status: "completed" });
    await syncAll(adapter, db);
    remote.calls.length = 0;

    const report = await syncAll(adapter, db);

    expect(report.pushed).toEqual({ created: 0, updated: 0, deleted: 0 });
    expect(report.pulled).toEqual({ created: 0, updated: 0, deleted: 0 });
    expect(remote.calls).toEqual(["list"]);
  });

  test("pushes local edits", async () => {
    const id = repository.insertTask("backlog", "task", {}, db);
    await syncAll(adapter, db);
    repository.updateTask(id, { task: "renamed" }, db);

    const report = await syncAll(adapter, db);

    expect(report.pushed.updated).toBe(1);
    expect(remote.tasks.get(remoteIdOf(id))?.title).toBe("renamed");
  });

  test("pulls remote edits and keeps the local doing section", async () => {
    const id = repository.insertTask("doing", "task", {}, db);
    await syncAll(adapter, db);
    remote.tasks.get(remoteIdOf(id))!.title = "renamed remotely";

    const report = await syncAll(adapter, db);

    expect(report.pulled.updated).toBe(1);
    expect(repository.getTaskById(id, db)).toMatchObject({ task: "renamed remotely", section: TASK_SECTION.doing });
  });

  test("pulls a remote completion into the done section", async () => {
    const id = repository.insertTask("doing", "task", {}, db);
    await syncAll(adapter, db);
    Object.assign(remote.tasks.get(remoteIdOf(id))!, { status: "completed", completed: "2026-02-03T04:05:06.000Z" });

    await syncAll(adapter, db);

    expect(repository.getTaskById(id, db)).toMatchObject({
      section: TASK_SECTION.done,
      extras: { completedAt: new Date("2026-02-03T04:05:06.000Z") },
    });
  });

  test("local wins when both sides changed", async () => {
    const id = repository.insertTask("backlog", "task", {}, db);
    await syncAll(adapter, db);
    repository.updateTask(id, { task: "local edit" }, db);
    remote.tasks.get(remoteIdOf(id))!.title = "remote edit";

    await syncAll(adapter, db);

    expect(repository.getTaskById(id, db)?.task).toBe("local edit");
    expect(remote.tasks.get(remoteIdOf(id))?.title).toBe("local edit");
  });

  test("propagates local deletions", async () => {
    const id = repository.insertTask("backlog", "task", {}, db);
    await syncAll(adapter, db);
    const remoteId = remoteIdOf(id);
    repository.deleteTaskById(id, db);

    const report = await syncAll(adapter, db);

    expect(report.pushed.deleted).toBe(1);
    expect(remote.tasks.has(remoteId)).toBe(false);
    expect(getSyncLink(id, GOOGLE_TASKS_PROVIDER, db)).toBeUndefined();
  });

  test("propagates remote deletions", async () => {
    const id = repository.insertTask("backlog", "task", {}, db);
    await syncAll(adapter, db);
    remote.tasks.delete(remoteIdOf(id));

    const report = await syncAll(adapter, db);

    expect(report.pulled.deleted).toBe(1);
    expect(repository.getTaskById(id, db)).toBeUndefined();
    expect(getSyncLink(id, GOOGLE_TASKS_PROVIDER, db)).toBeUndefined();
  });

  test("restores a remotely deleted task that changed locally", async () => {
    const id = repository.insertTask("backlog", "task", {}, db);
    await syncAll(adapter, db);
    remote.tasks.delete(remoteIdOf(id));
    repository.updateTask(id, { task: "edited" }, db);

    await syncAll(adapter, db);

    expect(remote.tasks.get(remoteIdOf(id))?.title).toBe("edited");
  });

  test("restores a locally deleted task that changed remotely", async () => {
    const id = repository.insertTask("backlog", "task", {}, db);
    await syncAll(adapter, db);
    const remoteId = remoteIdOf(id);
    remote.tasks.get(remoteId)!.title = "edited remotely";
    repository.deleteTaskById(id, db);

    const report = await syncAll(adapter, db);

    expect(report.pulled.created).toBe(1);
    expect(titles()).toEqual(["edited remotely"]);
    expect(remote.tasks.has(remoteId)).toBe(true);
  });

  test("links without a fingerprint (synced before `planos sync`) push local state", async () => {
    const id = repository.insertTask("backlog", "task", {}, db);
    remote.tasks.set("old", { id: "old", title: "stale", notes: "{}", status: "needsAction" });
    saveSyncLink({ taskId: id, provider: GOOGLE_TASKS_PROVIDER, remoteListId: "list", remoteId: "old" }, db);

    await syncAll(adapter, db);

    expect(remote.tasks.get("old")?.title).toBe("task");
    expect(remote.tasks.size).toBe(1);
  });

  test("ignores links into another remote list", async () => {
    const id = repository.insertTask("backlog", "task", {}, db);
    saveSyncLink({ taskId: id, provider: GOOGLE_TASKS_PROVIDER, remoteListId: "other", remoteId: "x", fingerprint: "f" }, db);

    const report = await syncAll(adapter, db);

    expect(report.pushed.created).toBe(1);
    expect(repository.getTaskById(id, db)).toBeDefined();
    expect(getSyncLink(id, GOOGLE_TASKS_PROVIDER, db)?.remoteListId).toBe("list");
  });

  test("collects per-task failures and keeps syncing the rest", async () => {
    repository.insertTask("backlog", "first", {}, db);
    repository.insertTask("backlog", "second", {}, db);
    const insert = remote.client.insertTask;
    remote.client.insertTask = async (list, task) => {
      if (task.title === "first") throw new Error("boom");
      return insert(list, task);
    };

    const report = await syncAll(adapter, db);

    expect(report.pushed.created).toBe(1);
    expect(report.errors).toEqual(["'first': boom"]);
  });
});

describe("SyncLinks migration", () => {
  test("adds the fingerprint column to databases created before it existed", () => {
    const path = tempDbPath(tempDir).replace("tasks", "legacy");
    const legacy = new Database(path);
    legacy.run("CREATE TABLE SyncLinks (taskId INTEGER NOT NULL, provider TEXT NOT NULL, remoteListId TEXT NOT NULL, remoteId TEXT NOT NULL, PRIMARY KEY (taskId, provider))");
    legacy.run("INSERT INTO SyncLinks VALUES (1, 'google-tasks', 'list', 'g1')");
    legacy.close();

    const migrated = openDatabase(path);
    try {
      expect(getSyncLink(1, GOOGLE_TASKS_PROVIDER, migrated)).toEqual({
        taskId: 1, provider: GOOGLE_TASKS_PROVIDER, remoteListId: "list", remoteId: "g1", fingerprint: null,
      });
    } finally {
      migrated.close();
    }
  });
});
