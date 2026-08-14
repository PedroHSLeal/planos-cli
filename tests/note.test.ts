import { describe, expect, test } from "bun:test";

import { runNote } from "../src/commands/tasks/note";
import { TASK_SECTION, type TaskRow } from "../src/services/storage/model";

const task: TaskRow = {
  id: 4,
  task: "write docs",
  section: TASK_SECTION.doing,
  extras: { notes: "before", custom: "keep" },
};

describe("note command", () => {
  test("fails before opening the editor when the task is missing", async () => {
    let rendered = false;

    await expect(runNote("missing", {
      findTask: async () => undefined,
      saveTask: async () => {},
      render: async () => { rendered = true; },
    })).rejects.toThrow("task not found: 'missing'");

    expect(rendered).toBe(false);
  });

  test("replaces notes on the resolved task after editor confirmation", async () => {
    let saved: { id: number; extras: TaskRow["extras"] } | undefined;

    await runNote("write docs", {
      findTask: async () => task,
      saveTask: async (id, changes) => { saved = { id, extras: changes.extras! }; },
      render: async onConfirm => { await onConfirm("after"); },
    });

    expect(saved).toEqual({
      id: 4,
      extras: { notes: "after", custom: "keep" },
    });
  });

  test("allows empty editor content to replace notes", async () => {
    let notes: unknown;

    await runNote("write docs", {
      findTask: async () => task,
      saveTask: async (_id, changes) => { notes = changes.extras?.notes; },
      render: async onConfirm => { await onConfirm(""); },
    });

    expect(notes).toBe("");
  });
});
