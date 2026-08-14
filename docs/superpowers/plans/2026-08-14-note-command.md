# Note Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `note <task>` so users can edit and persist a task's plain-text notes through the existing Vim editor, selecting the oldest duplicate title.

**Architecture:** Keep duplicate selection in SQLite storage with an explicit oldest-by-ID lookup. Resolve the task before starting the TUI, then update the resolved row by ID from the editor confirmation callback, merging existing extras and replacing only `notes`.

**Tech Stack:** Bun, TypeScript, Bun SQLite, Commander, OpenTUI Solid, Bun test runner.

## Global Constraints

- `note` receives the task title as its single positional argument.
- Duplicate titles select the row with the smallest database `id`.
- Missing tasks fail before `renderView` starts.
- Confirmation stores the Vim editor's `plainText`, including an empty string.
- Existing extras are preserved while `extras.notes` is replaced.
- No Vim keymap changes are required.

---

## File Map

- Modify `src/services/storage/crud.ts`: add oldest-title lookup and default-storage wrapper.
- Modify `src/services/storage/index.ts`: export the new lookup.
- Modify `src/commands/tasks/note/index.ts`: create the note command and testable command flow.
- Modify `index.ts`: register the note command.
- Modify `tests/storage.test.ts`: verify oldest duplicate selection and note persistence behavior.
- Create `tests/note.test.ts`: verify command preflight, editor confirmation, and duplicate targeting with injected collaborators.

### Task 1: Add oldest-task lookup and note persistence coverage

**Files:**
- Modify: `tests/storage.test.ts`
- Modify: `src/services/storage/crud.ts`
- Modify: `src/services/storage/index.ts`

**Interfaces:**
- Produces `getOldestTaskByTitle(task: string): Promise<TaskRow | undefined>` from `src/services/storage`.

- [ ] **Step 1: Write the failing storage test for oldest duplicate selection**

Add this test to `tests/storage.test.ts` and import `getOldestTaskByTitle` only if testing the default wrapper; prefer the isolated storage instance for the query itself:

```ts
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
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `bun test tests/storage.test.ts -t "finds the oldest task"`

Expected: FAIL because `getOldestTaskByTitle` is not yet available on the storage object.

- [ ] **Step 3: Implement the storage lookup**

In `src/services/storage/crud.ts`, add this method inside `createTaskStorage` after `getTasks`:

```ts
async getOldestTaskByTitle(task: string): Promise<TaskRow | undefined> {
  const row = database
    .query("SELECT id, task, section, extras FROM Tasks WHERE task = ? ORDER BY id ASC LIMIT 1")
    .get(task) as DatabaseTaskRow | null;
  return row ? toTaskRow(row) : undefined;
},
```

Add the module-level wrapper:

```ts
export async function getOldestTaskByTitle(task: string) {
  return getDefaultStorage().getOldestTaskByTitle(task);
}
```

Export it from `src/services/storage/index.ts` alongside `getTasks` and the other CRUD functions.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `bun test tests/storage.test.ts -t "finds the oldest task"`

Expected: PASS.

- [ ] **Step 5: Add tests for note replacement and preservation**

Add this test to `tests/storage.test.ts`:

```ts
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
});
```

Add an empty replacement assertion in the same test after the first assertion:

```ts
await storage.updateTask(id, { extras: { ...task!.extras, notes: "" } });
expect((await storage.getOldestTaskByTitle("with notes"))?.extras.notes).toBe("");
```

- [ ] **Step 6: Run all storage tests**

Run: `bun test tests/storage.test.ts`

Expected: PASS with all existing and new SQLite storage tests passing.

- [ ] **Step 7: Commit the storage slice**

```bash
git add tests/storage.test.ts src/services/storage/crud.ts src/services/storage/index.ts
git commit -m "feat: find oldest task for notes"
```

### Task 2: Implement the note command with injectable collaborators

**Files:**
- Create: `src/commands/tasks/note/index.ts`
- Create: `tests/note.test.ts`

**Interfaces:**
- Consumes `getOldestTaskByTitle`, `updateTask`, and `TaskRow` from storage.
- Consumes `renderView` whose callback receives `plainText: string`.
- Produces `noteCommand(program: Command): void` for Commander registration.
- Produces a testable `runNote(task, dependencies)` command flow with injected lookup, update, and renderer functions.

- [ ] **Step 1: Write failing command tests**

Create `tests/note.test.ts` with this test setup and cases:

```ts
import { describe, expect, test } from "bun:test";
import { TASK_SECTION, type TaskRow } from "../src/services/storage/model";
import { runNote } from "../src/commands/tasks/note";

const task: TaskRow = {
  id: 4,
  task: "write docs",
  section: TASK_SECTION.doing,
  extras: { notes: "before", custom: "keep" },
};

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
```

- [ ] **Step 2: Run command tests and verify they fail**

Run: `bun test tests/note.test.ts`

Expected: FAIL because the note command module and `runNote` do not yet exist.

- [ ] **Step 3: Implement the command flow**

Create `src/commands/tasks/note/index.ts` with these exact collaborators and flow:

```ts
import type { Command } from "commander";

import { renderView } from "../../../tui";
import { getOldestTaskByTitle, updateTask } from "../../../services/storage";
import type { Extras, TaskRow, TaskUpdate } from "../../../services/storage/model";

type NoteDependencies = {
  findTask: (task: string) => Promise<TaskRow | undefined>;
  saveTask: (id: number, changes: TaskUpdate) => Promise<void>;
  render: (onConfirm: (plainText: string) => Promise<void>) => Promise<unknown>;
};

export async function runNote(task: string, dependencies: NoteDependencies): Promise<void> {
  const existingTask = await dependencies.findTask(task);
  if (!existingTask) throw new Error(`Error: task not found: '${task}'`);

  await dependencies.render(async (plainText: string) => {
    const extras: Extras = { ...existingTask.extras, notes: plainText };
    await dependencies.saveTask(existingTask.id, { extras });
  });
}

export default function noteCommand(program: Command): void {
  program
    .command("note <task>")
    .description("edit notes for a task")
    .action(async (task: string) => {
      await runNote(task, {
        findTask: getOldestTaskByTitle,
        saveTask: updateTask,
        render: renderView,
      });
    });
}
```

- [ ] **Step 4: Run command tests and verify they pass**

Run: `bun test tests/note.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the command slice**

```bash
git add src/commands/tasks/note/index.ts tests/note.test.ts
git commit -m "feat: add note command"
```

### Task 3: Register the command and verify the complete feature

**Files:**
- Modify: `index.ts`

- [ ] **Step 1: Register the command**

Add this import to `index.ts`:

```ts
import noteCommand from "./src/commands/tasks/note";
```

Register it after the existing task commands:

```ts
noteCommand(program);
```

- [ ] **Step 2: Run the complete test suite**

Run: `bun test`

Expected: all storage, print, and note tests pass.

- [ ] **Step 3: Run the TypeScript check**

Run: `bunx tsc --noEmit`

Expected: no new errors from the note command or storage changes. Any pre-existing unrelated TUI errors should be reported separately.

- [ ] **Step 4: Verify CLI registration**

Run: `bun index.ts note --help`

Expected: help output includes `note <task>` and the description `edit notes for a task`.

- [ ] **Step 5: Commit command registration**

```bash
git add index.ts
git commit -m "feat: register note command"
```

## Self-Review

- Spec coverage: the lookup, oldest duplicate rule, preflight failure, Vim confirmation, note replacement, extras preservation, empty text, tests, and command registration are covered by Tasks 1-3.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps are present.
- Type consistency: `runNote` consumes `TaskUpdate`, passes `Extras`, and uses the storage helper signatures defined in Task 1.
