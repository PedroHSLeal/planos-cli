import { describe, expect, test } from "bun:test";

import { TASK_SECTION, type TaskRow } from "../../src/services/storage/model";
import { fromGoogleTask, googleTaskFingerprint, toGoogleTask } from "../../src/services/sync/adapters/google-tasks/mapper";

const base: TaskRow = { id: 1, task: "write docs", section: TASK_SECTION.backlog, extras: {} };

describe("toGoogleTask", () => {
  test("maps an open task with stringified extras in notes", () => {
    const startedAt = new Date("2026-01-02T03:04:05.000Z");
    const task = { ...base, section: TASK_SECTION.doing, extras: { notes: "hi", startedAt, custom: [1, 2] } };

    expect(toGoogleTask(task)).toEqual({
      title: "write docs",
      notes: JSON.stringify({ notes: "hi", startedAt, custom: [1, 2] }),
      status: "needsAction",
      completed: null,
    });
    expect(JSON.parse(toGoogleTask(task).notes!)).toEqual({
      notes: "hi",
      startedAt: "2026-01-02T03:04:05.000Z",
      custom: [1, 2],
    });
  });

  test("maps empty extras to an empty JSON object", () => {
    expect(toGoogleTask(base).notes).toBe("{}");
  });

  test("marks a task with completedAt as completed", () => {
    const completedAt = new Date("2026-05-06T07:08:09.000Z");
    const mapped = toGoogleTask({ ...base, extras: { completedAt } });

    expect(mapped.status).toBe("completed");
    expect(mapped.completed).toBe("2026-05-06T07:08:09.000Z");
  });

  test("marks a task in the done section as completed", () => {
    const mapped = toGoogleTask({ ...base, section: TASK_SECTION.done });

    expect(mapped.status).toBe("completed");
    expect(typeof mapped.completed).toBe("string");
  });
});

describe("fromGoogleTask", () => {
  test("round-trips a planos task", () => {
    const startedAt = new Date("2026-01-02T03:04:05.000Z");
    const task = { ...base, section: TASK_SECTION.doing, extras: { notes: "hi", startedAt } };
    const remote = { ...toGoogleTask(task), id: "g1" };

    expect(fromGoogleTask(remote)).toEqual({
      remoteId: "g1",
      fingerprint: googleTaskFingerprint(remote),
      task: "write docs",
      section: TASK_SECTION.doing,
      extras: { notes: "hi", startedAt },
    });
  });

  test("keeps non-JSON notes as plain notes", () => {
    const mapped = fromGoogleTask({ id: "g1", title: "t", notes: "buy milk", status: "needsAction" });

    expect(mapped.section).toBe(TASK_SECTION.backlog);
    expect(mapped.extras).toEqual({ notes: "buy milk" });
  });

  test("stamps completedAt from the Google completion time", () => {
    const mapped = fromGoogleTask({ id: "g1", title: "t", status: "completed", completed: "2026-05-06T07:08:09.000Z" });

    expect(mapped.section).toBe(TASK_SECTION.done);
    expect(mapped.extras).toEqual({ completedAt: new Date("2026-05-06T07:08:09.000Z") });
  });

  test("drops completedAt when the task was reopened in Google", () => {
    const notes = JSON.stringify({ completedAt: new Date("2026-05-06T07:08:09.000Z") });
    const mapped = fromGoogleTask({ id: "g1", title: "t", notes, status: "needsAction" });

    expect(mapped.section).toBe(TASK_SECTION.backlog);
    expect(mapped.extras).toEqual({});
  });
});

describe("googleTaskFingerprint", () => {
  test("ignores the completion timestamp", () => {
    const task = { ...base, section: TASK_SECTION.done };
    expect(googleTaskFingerprint({ ...toGoogleTask(task), completed: "2020-01-01T00:00:00.000Z" }))
      .toBe(googleTaskFingerprint(toGoogleTask(task)));
  });
});
