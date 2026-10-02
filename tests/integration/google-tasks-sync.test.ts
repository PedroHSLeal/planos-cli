import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";

import { openDatabase } from "../../src/services/storage/database";
import * as repository from "../../src/services/storage/repository";
import { getSyncLink } from "../../src/services/storage/sync-links";
import { createGoogleTasksAdapterFromConfig, GOOGLE_TASKS_PROVIDER } from "../../src/services/sync/adapters/google-tasks/adapter";
import { setSyncAdapter, syncTaskCreated, syncTaskDeleted, syncTaskUpdated } from "../../src/services/sync/hooks";
import { installFakeFetch, jsonResponse, type RecordedRequest } from "../helpers/fake-fetch";
import { cleanupTempDir, makeTempDir, tempDbPath } from "../helpers/tmp";

let db: Database;
let tempDir: string;
let respond: (request: RecordedRequest) => Response;
let requests: RecordedRequest[];
let restoreFetch: () => void;

beforeEach(() => {
  tempDir = makeTempDir();
  db = openDatabase(tempDbPath(tempDir));
  respond = ({ method }) => (method === "DELETE" ? new Response(null, { status: 204 }) : jsonResponse({ id: "g1" }));

  const fake = installFakeFetch(request => respond(request));
  requests = fake.requests;
  restoreFetch = fake.restore;
  setSyncAdapter(createGoogleTasksAdapterFromConfig({ taskListId: "list", accessToken: "tok" }, db));
});

afterEach(() => {
  restoreFetch();
  setSyncAdapter(undefined);
  db.close();
  cleanupTempDir(tempDir);
});

describe("Google Tasks sync", () => {
  test("create inserts the task remotely and stores the link", async () => {
    const id = repository.insertTask("backlog", "write docs", { notes: "n" }, db);

    await syncTaskCreated(id, db);

    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe("POST");
    expect(JSON.parse(requests[0]!.body!)).toEqual({
      title: "write docs",
      notes: JSON.stringify({ notes: "n" }),
      status: "needsAction",
      completed: null,
    });
    expect(getSyncLink(id, GOOGLE_TASKS_PROVIDER, db)).toEqual({
      taskId: id,
      provider: GOOGLE_TASKS_PROVIDER,
      remoteListId: "list",
      remoteId: "g1",
      fingerprint: null,
    });
  });

  test("update patches the linked remote task", async () => {
    const id = repository.insertTask("doing", "write docs", {}, db);
    await syncTaskCreated(id, db);
    const completedAt = new Date("2026-03-04T05:06:07.000Z");
    repository.updateTask(id, { extras: { completedAt } }, db);

    await syncTaskUpdated(id, db);

    expect(requests[1]?.method).toBe("PATCH");
    expect(requests[1]?.url).toEndWith("/lists/list/tasks/g1");
    expect(JSON.parse(requests[1]!.body!)).toMatchObject({
      status: "completed",
      completed: "2026-03-04T05:06:07.000Z",
      notes: JSON.stringify({ completedAt }),
    });
  });

  test("update of an unlinked task inserts it", async () => {
    const id = repository.insertTask("backlog", "old task", {}, db);

    await syncTaskUpdated(id, db);

    expect(requests[0]?.method).toBe("POST");
    expect(getSyncLink(id, GOOGLE_TASKS_PROVIDER, db)?.remoteId).toBe("g1");
  });

  test("update recreates a task deleted in Google Tasks", async () => {
    const id = repository.insertTask("backlog", "task", {}, db);
    await syncTaskCreated(id, db);
    respond = ({ method }) => (method === "PATCH" ? new Response("not found", { status: 404 }) : jsonResponse({ id: "g2" }));

    await syncTaskUpdated(id, db);

    expect(requests.map(r => r.method)).toEqual(["POST", "PATCH", "POST"]);
    expect(getSyncLink(id, GOOGLE_TASKS_PROVIDER, db)?.remoteId).toBe("g2");
  });

  test("delete removes the remote task and the link", async () => {
    const id = repository.insertTask("backlog", "task", {}, db);
    await syncTaskCreated(id, db);

    await syncTaskDeleted(id);

    expect(requests[1]?.method).toBe("DELETE");
    expect(getSyncLink(id, GOOGLE_TASKS_PROVIDER, db)).toBeUndefined();
  });

  test("API failures are reported, not thrown", async () => {
    respond = () => new Response("boom", { status: 500 });
    const errorSpy = mock((..._args: unknown[]) => {});
    const originalError = console.error;
    console.error = errorSpy;

    try {
      const id = repository.insertTask("backlog", "task", {}, db);
      await syncTaskCreated(id, db);
    } finally {
      console.error = originalError;
    }

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain("google-tasks sync failed (create)");
  });

  test("does nothing when sync is disabled", async () => {
    setSyncAdapter(null);
    const id = repository.insertTask("backlog", "task", {}, db);

    await syncTaskCreated(id, db);

    expect(requests).toHaveLength(0);
  });
});
