# planos Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full test pyramid (unit → integration → command → E2E) covering every CLI command and the storage layer, with a minimal testability refactor so tests never touch the real `~/.config/planos/tasks.sqlite`.

**Architecture:** Repository functions gain an optional trailing `Database` parameter (defaulting to the existing singleton) so integration tests inject a temp SQLite DB. `PLANOS_HOME` env var overrides the config path so E2E-spawned CLI processes use a temp dir. Command tests mock the storage module and `renderView` (the TUI seam). E2E tests spawn the real CLI via `Bun.spawn`.

**Tech Stack:** Bun runtime + `bun test` (built-in, zero new deps), TypeScript strict, commander v15, `bun:sqlite`.

**Spec:** `docs/superpowers/specs/2026-09-01-test-suite-design.md`

## Global Constraints

- No new dependencies — `bun test` only
- TypeScript strict mode ON, plus `noUncheckedIndexedAccess` and `verbatimModuleSyntax` (use `import type` / inline `type` for types; array indexing yields `T | undefined`)
- Never open or write the real `~/.config/planos/tasks.sqlite` in tests
- TUI rendering (`@opentui/*`) must not be exercised by tests; `renderView` is always mocked
- Conventional commit messages (`test:`, `refactor:`), matching repo history
- Every task ends with: full `bun test` run passing + `bunx tsc` typecheck passing
- One spec deviation (documented): `toTaskRow`'s invalid-section guard is unreachable because the `Tasks` table has a CHECK constraint — the integration tests cover the CHECK constraint rejection instead (see Task 4)

---

### Task 1: Test infra + unit tests for `extras`

**Files:**
- Modify: `package.json` (scripts block)
- Create: `tests/unit/extras.test.ts`

**Interfaces:**
- Consumes: `serializeExtras`/`deserializeExtras` from `src/services/storage/extras.ts` (existing, unchanged)
- Produces: `"test": "bun test"` npm script used by all later tasks; test file location pattern `tests/unit/*.test.ts`

- [ ] **Step 1: Add the test script to package.json**

Change the `scripts` block of `package.json` to:

```json
  "scripts": {
    "start": "bun index.ts",
    "dev": "bun --watch index.ts",
    "test": "bun test"
  },
```

- [ ] **Step 2: Write the unit tests**

Create `tests/unit/extras.test.ts` with exactly:

```ts
import { describe, expect, test } from "bun:test";

import { deserializeExtras, serializeExtras } from "../../src/services/storage/extras";

describe("serializeExtras / deserializeExtras", () => {
  test("round-trips an extras object", () => {
    const extras = { notes: "hello" };
    expect(deserializeExtras(serializeExtras(extras))).toEqual(extras);
  });

  test("round-trips empty extras", () => {
    expect(deserializeExtras(serializeExtras({}))).toEqual({});
  });

  test("revives startedAt and completedAt strings into Dates", () => {
    const iso = "2026-09-01T10:00:00.000Z";
    const extras = deserializeExtras(JSON.stringify({ startedAt: iso, completedAt: iso }));
    expect(extras.startedAt).toBeInstanceOf(Date);
    expect(extras.completedAt).toBeInstanceOf(Date);
    expect((extras.startedAt as Date).toISOString()).toBe(iso);
  });

  test("leaves unknown string fields as strings", () => {
    const extras = deserializeExtras(JSON.stringify({ custom: "x" }));
    expect(typeof extras.custom).toBe("string");
  });

  test("throws on invalid JSON", () => {
    expect(() => deserializeExtras("not json")).toThrow("Invalid task extras JSON");
  });

  test("throws on array", () => {
    expect(() => deserializeExtras("[1,2]")).toThrow("expected an object");
  });

  test("throws on scalar", () => {
    expect(() => deserializeExtras("42")).toThrow("expected an object");
  });

  test("throws on null", () => {
    expect(() => deserializeExtras("null")).toThrow("expected an object");
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `bun test tests/unit/extras.test.ts`
Expected: all 8 tests PASS. (The implementation already exists — if any test fails, the source has a bug: fix `src/services/storage/extras.ts` minimally, do not change the test.)

- [ ] **Step 4: Typecheck + full suite**

Run: `bunx tsc` then `bun test`
Expected: tsc exits 0; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json tests/unit/extras.test.ts
git commit -m "test: add test script and extras unit tests"
```

---

### Task 2: Unit tests for `to-markdown`

**Files:**
- Create: `tests/unit/to-markdown.test.ts`

**Interfaces:**
- Consumes: `tasksToMarkdown` from `src/services/storage/to-markdown.ts`; `TASK_SECTION`, `TaskRow` from `src/services/storage/model.ts` (existing, unchanged)
- Produces: none (tests only)

- [ ] **Step 1: Write the unit tests**

Create `tests/unit/to-markdown.test.ts` with exactly:

```ts
import { describe, expect, test } from "bun:test";

import { TASK_SECTION, type TaskRow } from "../../src/services/storage/model";
import { tasksToMarkdown } from "../../src/services/storage/to-markdown";

function task(id: number, name: string, section: TaskRow["section"]): TaskRow {
  return { id, task: name, section, extras: {} };
}

describe("tasksToMarkdown", () => {
  test("renders headers in order DOING, DONE, BACKLOG", () => {
    const markdown = tasksToMarkdown([]);
    expect(markdown).toContain("# DOING");
    expect(markdown).toContain("# DONE");
    expect(markdown).toContain("# BACKLOG");
    expect(markdown.indexOf("# DOING")).toBeLessThan(markdown.indexOf("# DONE"));
    expect(markdown.indexOf("# DONE")).toBeLessThan(markdown.indexOf("# BACKLOG"));
  });

  test("renders done tasks with checked boxes, others unchecked", () => {
    const markdown = tasksToMarkdown([
      task(1, "done thing", TASK_SECTION.done),
      task(2, "doing thing", TASK_SECTION.doing),
      task(3, "backlog thing", TASK_SECTION.backlog),
    ]);
    expect(markdown).toContain("- [x] done thing");
    expect(markdown).toContain("- [ ] doing thing");
    expect(markdown).toContain("- [ ] backlog thing");
  });

  test("groups tasks under their own sections", () => {
    const markdown = tasksToMarkdown([
      task(1, "b1", TASK_SECTION.backlog),
      task(2, "d1", TASK_SECTION.doing),
    ]);
    const doingPart = markdown.split("# DOING")[1]!.split("# DONE")[0]!;
    const backlogPart = markdown.split("# BACKLOG")[1]!;
    expect(doingPart).toContain("- [ ] d1");
    expect(doingPart).not.toContain("b1");
    expect(backlogPart).toContain("- [ ] b1");
    expect(backlogPart).not.toContain("d1");
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `bun test tests/unit/to-markdown.test.ts`
Expected: all 3 tests PASS (implementation already exists).

- [ ] **Step 3: Typecheck + full suite**

Run: `bunx tsc` then `bun test`
Expected: tsc exits 0; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/to-markdown.test.ts
git commit -m "test: add to-markdown unit tests"
```

---

### Task 3: Testability refactor (DI + PLANOS_HOME)

**Files:**
- Modify: `src/services/storage/model.ts:30` (BASE_PATH line)
- Modify: `src/services/storage/repository.ts` (all function signatures)
- Modify: `src/services/storage/database.ts` (mkdir of dirname)

**Interfaces:**
- Consumes: existing `openDatabase(path?)` from `database.ts`
- Produces: repository functions with optional trailing `database: Database` param:
  - `listTasks(database = getDatabase()): TaskRow[]`
  - `getTaskById(id: number, database = getDatabase()): TaskRow | undefined`
  - `getOldestTaskByTitle(title: string, database = getDatabase()): TaskRow | undefined`
  - `insertTask(section: KnownSection, task: string, extras: Extras = {}, database = getDatabase()): number`
  - `updateTask(id: number, changes: TaskUpdate, database = getDatabase()): void`
  - `deleteTaskById(id: number, database = getDatabase()): void`
  - Task 4's integration tests pass `db` as last argument everywhere.
- Also produces: `PLANOS_HOME` env override of `BASE_PATH` (used by Task 5 E2E tests).

No call-site changes are needed anywhere — all existing callers omit the trailing param.

- [ ] **Step 1: Change BASE_PATH in model.ts**

In `src/services/storage/model.ts`, replace line 30:

```ts
export const BASE_PATH = join(homedir(), ".config", "planos");
```

with:

```ts
export const BASE_PATH = process.env.PLANOS_HOME ?? join(homedir(), ".config", "planos");
```

Leave `DATABASE_PATH` unchanged (derived from `BASE_PATH`).

- [ ] **Step 2: Change openDatabase in database.ts**

Replace the full content of `src/services/storage/database.ts` with:

```ts
import { mkdirSync } from "node:fs";
import { Database } from "bun:sqlite";
import { dirname } from "node:path";

import { DATABASE_PATH } from "./model";

export function initializeDatabase(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS Tasks (
      id INTEGER PRIMARY KEY,
      task TEXT NOT NULL,
      section INTEGER NOT NULL CHECK (section IN (0, 1, 2)),
      extras TEXT NOT NULL DEFAULT '{}'
    )
  `);
}

export function openDatabase(path = DATABASE_PATH): Database {
  mkdirSync(dirname(path), { recursive: true });
  const database = new Database(path);
  database.run("PRAGMA busy_timeout = 5000");
  initializeDatabase(database);
  return database;
}
```

Note: production behavior is identical because `dirname(DATABASE_PATH)` === `BASE_PATH`. This stops tests that pass a temp path from mkdir-ing the real config dir.

- [ ] **Step 3: Add DI params in repository.ts**

Replace the full content of `src/services/storage/repository.ts` with:

```ts
import { type Database } from "bun:sqlite";

import { openDatabase } from "./database";
import { deserializeExtras, serializeExtras } from "./extras";
import {
  type Extras,
  type KnownSection,
  type TaskRow,
  type TaskSection,
  type TaskUpdate,
  TASK_SECTION,
} from "./model";

type DatabaseTaskRow = {
  id: number;
  task: string;
  section: number;
  extras: string;
};

const sectionValues: Record<KnownSection, TaskSection> = {
  done: TASK_SECTION.done,
  doing: TASK_SECTION.doing,
  backlog: TASK_SECTION.backlog,
};

let database: Database | undefined;

function getDatabase(): Database {
  return database ??= openDatabase();
}

function toTaskRow(row: DatabaseTaskRow): TaskRow {
  if (![TASK_SECTION.done, TASK_SECTION.doing, TASK_SECTION.backlog].includes(row.section as TaskSection)) {
    throw new Error(`Invalid task section value: ${row.section}`);
  }

  return {
    id: row.id,
    task: row.task,
    section: row.section as TaskSection,
    extras: deserializeExtras(row.extras),
  };
}

export function listTasks(database = getDatabase()): TaskRow[] {
  const rows = database
    .query("SELECT id, task, section, extras FROM Tasks ORDER BY id DESC")
    .all() as DatabaseTaskRow[];
  return rows.map(toTaskRow);
}

export function getTaskById(id: number, database = getDatabase()): TaskRow | undefined {
  const row = database
    .query("SELECT id, task, section, extras FROM Tasks WHERE id = ? LIMIT 1")
    .get(id) as DatabaseTaskRow | null;
  return row ? toTaskRow(row) : undefined;
}

export function getOldestTaskByTitle(title: string, database = getDatabase()): TaskRow | undefined {
  const row = database
    .query("SELECT id, task, section, extras FROM Tasks WHERE task = ? ORDER BY id ASC LIMIT 1")
    .get(title) as DatabaseTaskRow | null;
  return row ? toTaskRow(row) : undefined;
}

export function insertTask(section: KnownSection, task: string, extras: Extras = {}, database = getDatabase()): number {
  const result = database
    .query("INSERT INTO Tasks (task, section, extras) VALUES (?, ?, ?)")
    .run(task, sectionValues[section], serializeExtras(extras));
  return Number(result.lastInsertRowid);
}

export function updateTask(id: number, changes: TaskUpdate, database = getDatabase()): void {
  const entries: [string, string | number][] = [];
  if (changes.task !== undefined) entries.push(["task", changes.task]);
  if (changes.section !== undefined) entries.push(["section", changes.section]);
  if (changes.extras !== undefined) entries.push(["extras", serializeExtras(changes.extras)]);
  if (entries.length === 0) throw new Error("Task update requires at least one field");

  const result = database
    .query(`UPDATE Tasks SET ${entries.map(([column]) => `${column} = ?`).join(", ")} WHERE id = ?`)
    .run(...entries.map(([, value]) => value), id);
  if (result.changes === 0) throw new Error(`Error: task not found: '${id}'`);
}

export function deleteTaskById(id: number, database = getDatabase()): void {
  const result = database.query("DELETE FROM Tasks WHERE id = ?").run(id);
  if (result.changes === 0) throw new Error(`Error: task not found: '${id}'`);
}
```

- [ ] **Step 4: Verify no regression**

Run: `bunx tsc` then `bun test`
Expected: tsc exits 0; all existing unit tests still pass.

- [ ] **Step 5: Smoke-test the CLI against a temp home**

Run (PowerShell):

```powershell
$h = Join-Path ([IO.Path]::GetTempPath()) ("planos-smoke-" + [guid]::NewGuid().ToString("N"))
$env:PLANOS_HOME = $h
bun index.ts add "smoke task"
bun index.ts print
$env:PLANOS_HOME = ""
Remove-Item -Recurse -Force $h
```

Expected: `print` shows `- [ ] smoke task` under BACKLOG; the real `~/.config/planos` is untouched. Then run `bun index.ts print` WITHOUT the env var (default home) to confirm the existing default path still works — this is read-only, it must not crash.

- [ ] **Step 6: Commit**

```bash
git add src/services/storage/model.ts src/services/storage/repository.ts src/services/storage/database.ts
git commit -m "refactor: allow database injection and PLANOS_HOME override"
```

---

### Task 4: Temp helpers + repository integration tests

**Files:**
- Create: `tests/helpers/tmp.ts`
- Create: `tests/integration/repository.test.ts`

**Interfaces:**
- Consumes: DI repository functions from Task 3; `openDatabase` from `database.ts`; `TASK_SECTION` from `model.ts`
- Produces: `makeTempDir(): string`, `cleanupTempDir(path: string): void`, `tempDbPath(dir: string): string` in `tests/helpers/tmp.ts` — Task 5 (E2E) reuses `makeTempDir`/`cleanupTempDir`

- [ ] **Step 1: Write the temp helpers**

Create `tests/helpers/tmp.ts` with exactly:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "planos-test-"));
}

export function cleanupTempDir(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

export function tempDbPath(dir: string): string {
  return join(dir, "tasks.sqlite");
}
```

- [ ] **Step 2: Write the integration tests**

Create `tests/integration/repository.test.ts` with exactly:

```ts
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
```

Note: the spec's "toTaskRow throws on invalid section" item is covered here by the CHECK-constraint test instead — the schema makes such a row impossible to create, so the guard is defense-in-depth that cannot be exercised through the public API.

- [ ] **Step 3: Run the tests**

Run: `bun test tests/integration/repository.test.ts`
Expected: all 13 tests PASS.

- [ ] **Step 4: Typecheck + full suite**

Run: `bunx tsc` then `bun test`
Expected: tsc exits 0; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/helpers/tmp.ts tests/integration/repository.test.ts
git commit -m "test: add repository integration tests against temp database"
```

---

### Task 5: Command test — `add`

**Files:**
- Create: `tests/commands/add.test.ts`

**Interfaces:**
- Consumes: `mock.module` from `bun:test`; the command factory default export from `src/commands/tasks/add/index.ts`
- Produces: the mock-module pattern for `../../src/services/storage` used identically by Tasks 6-9:

```ts
mock.module("../../src/services/storage", () => ({
  insertTask: mock(() => 1),
  listTasks: mock(() => allTasks),
  getTaskById: mock(() => undefined),
  getOldestTaskByTitle: mock((title: string) => oldestTask),
  updateTask: mock(() => {}),
  deleteTaskById: mock(() => {}),
}));
const commandModule = (await import("../../src/commands/tasks/<name>")).default;
```

with `oldestTask`/`allTasks` as mutable `let` bindings captured by the mock closures (avoids relying on `mockImplementation`).

- [ ] **Step 1: Write the command test**

Create `tests/commands/add.test.ts` with exactly:

```ts
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
});
```

Note: the mock is defined at top level and passed into the `mock.module` factory, so the same binding the command uses is the one we assert on. The command module is imported dynamically AFTER `mock.module` so it receives the mocked bindings.

- [ ] **Step 2: Run the test**

Run: `bun test tests/commands/add.test.ts`
Expected: 2 tests PASS. If `insertTask` mock is not called, the mock path resolution is wrong — verify `tests/commands` resolves `../../src/services/storage` to `src/services/storage/index.ts`.

- [ ] **Step 3: Typecheck + full suite**

Run: `bunx tsc` then `bun test`
Expected: tsc exits 0; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/commands/add.test.ts
git commit -m "test: add command test for add"
```

---

### Task 6: Command test — `print`

**Files:**
- Create: `tests/commands/print.test.ts`

**Interfaces:**
- Consumes: the mock-module pattern from Task 5; real `tasksToMarkdown` (NOT mocked — pure function) via print's direct import
- Produces: the console.log capture pattern (`logged: string[]` + swap in `beforeEach`/`afterEach`) reused by no other task, but kept here only

- [ ] **Step 1: Write the command test**

Create `tests/commands/print.test.ts` with exactly:

```ts
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Command } from "commander";

import { TASK_SECTION, type TaskRow } from "../../src/services/storage/model";

const allTasks: TaskRow[] = [
  { id: 2, task: "second", section: TASK_SECTION.doing, extras: {} },
  { id: 1, task: "first", section: TASK_SECTION.done, extras: {} },
];

mock.module("../../src/services/storage", () => ({
  insertTask: mock(() => 1),
  listTasks: mock(() => allTasks),
  getTaskById: mock(() => undefined),
  getOldestTaskByTitle: mock((_title: string) => undefined),
  updateTask: mock(() => {}),
  deleteTaskById: mock(() => {}),
}));

const printCommand = (await import("../../src/commands/tasks/print")).default;

const originalLog = console.log;
const logged: string[] = [];

beforeEach(() => {
  logged.length = 0;
  console.log = ((...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  }) as typeof console.log;
});

afterEach(() => {
  console.log = originalLog;
});

describe("planos print", () => {
  test("prints markdown by default", async () => {
    const program = new Command();
    printCommand(program);
    await program.parseAsync(["print"], { from: "user" });

    expect(logged[0]).toContain("# DOING");
    expect(logged[0]).toContain("- [ ] second");
    expect(logged[0]).toContain("- [x] first");
  });

  test("prints JSON with --json", async () => {
    const program = new Command();
    printCommand(program);
    await program.parseAsync(["print", "--json"], { from: "user" });

    expect(JSON.parse(logged[0]!)).toEqual(allTasks);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `bun test tests/commands/print.test.ts`
Expected: 2 tests PASS.

- [ ] **Step 3: Typecheck + full suite**

Run: `bunx tsc` then `bun test`
Expected: tsc exits 0; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/commands/print.test.ts
git commit -m "test: add command test for print"
```

---

### Task 7: Command test — `complete` (first renderView mock)

**Files:**
- Create: `tests/commands/complete.test.ts`

**Interfaces:**
- Consumes: mock-module pattern from Task 5; `renderView` from `src/commands/tasks/complete/view.tsx` (mocked — this is the TUI seam)
- Produces: the view-mock pattern reused by Tasks 8-9:

```ts
const renderView = mock(async (_props: Record<string, unknown>) => {});
mock.module("../../src/commands/tasks/<name>/view", () => ({ renderView }));
```

- [ ] **Step 1: Write the command test**

Create `tests/commands/complete.test.ts` with exactly:

```ts
import { describe, expect, mock, test } from "bun:test";
import { Command } from "commander";

import { TASK_SECTION, type TaskRow } from "../../src/services/storage/model";

const sampleTask: TaskRow = { id: 1, task: "sample", section: TASK_SECTION.doing, extras: {} };

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
mock.module("../../src/commands/tasks/complete/view", () => ({ renderView }));

const completeCommand = (await import("../../src/commands/tasks/complete")).default;

describe("planos complete", () => {
  test("looks up the oldest task by title and renders it", async () => {
    oldestTask = sampleTask;
    renderView.mockClear();

    const program = new Command();
    completeCommand(program);
    await program.parseAsync(["complete", "sample"], { from: "user" });

    expect(renderView).toHaveBeenCalledTimes(1);
    expect(renderView).toHaveBeenCalledWith({ tasks: [sampleTask] });
  });

  test("throws when the named task does not exist", async () => {
    oldestTask = undefined;

    const program = new Command();
    completeCommand(program);
    await expect(
      program.parseAsync(["complete", "missing"], { from: "user" }),
    ).rejects.toThrow("task not found");
  });

  test("renders all tasks when no task name is given", async () => {
    allTasks = [sampleTask, { ...sampleTask, id: 2, task: "second" }];
    renderView.mockClear();

    const program = new Command();
    completeCommand(program);
    await program.parseAsync(["complete"], { from: "user" });

    expect(renderView).toHaveBeenCalledWith({ tasks: allTasks });
  });
});
```

- [ ] **Step 2: Run the test**

Run: `bun test tests/commands/complete.test.ts`
Expected: 3 tests PASS. If the import of `complete` hangs or errors on `@opentui`, the view mock path is wrong — it must be `"../../src/commands/tasks/complete/view"` so that `complete/index.ts`'s `"./view"` import resolves to the mocked module.

- [ ] **Step 3: Typecheck + full suite**

Run: `bunx tsc` then `bun test`
Expected: tsc exits 0; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/commands/complete.test.ts
git commit -m "test: add command test for complete"
```

---

### Task 8: Command test — `note`

**Files:**
- Create: `tests/commands/note.test.ts`

**Interfaces:**
- Consumes: mock-module + view-mock patterns from Tasks 5 and 7
- Produces: none

- [ ] **Step 1: Write the command test**

Create `tests/commands/note.test.ts` with exactly:

```ts
import { describe, expect, mock, test } from "bun:test";
import { Command } from "commander";

import { TASK_SECTION, type TaskRow } from "../../src/services/storage/model";

const sampleTask: TaskRow = { id: 1, task: "sample", section: TASK_SECTION.doing, extras: {} };

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
```

- [ ] **Step 2: Run the test**

Run: `bun test tests/commands/note.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 3: Typecheck + full suite**

Run: `bunx tsc` then `bun test`
Expected: tsc exits 0; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/commands/note.test.ts
git commit -m "test: add command test for note"
```

---

### Task 9: Command test — `start`

**Files:**
- Create: `tests/commands/start.test.ts`

**Interfaces:**
- Consumes: mock-module + view-mock patterns from Tasks 5 and 7
- Produces: none

- [ ] **Step 1: Write the command test**

Create `tests/commands/start.test.ts` with exactly:

```ts
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
```

- [ ] **Step 2: Run the test**

Run: `bun test tests/commands/start.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 3: Typecheck + full suite**

Run: `bunx tsc` then `bun test`
Expected: tsc exits 0; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/commands/start.test.ts
git commit -m "test: add command test for start"
```

---

### Task 10: E2E tests — real CLI via subprocess

**Files:**
- Create: `tests/e2e/cli.test.ts`

**Interfaces:**
- Consumes: `makeTempDir`/`cleanupTempDir` from Task 4's `tests/helpers/tmp.ts`; `PLANOS_HOME` override from Task 3
- Produces: none

- [ ] **Step 1: Write the E2E tests**

Create `tests/e2e/cli.test.ts` with exactly:

```ts
import { afterEach, beforeEach, expect, test } from "bun:test";
import { join } from "node:path";

import { cleanupTempDir, makeTempDir } from "../helpers/tmp";

const repoRoot = join(import.meta.dir, "..", "..");

let home: string;

beforeEach(() => {
  home = makeTempDir();
});

afterEach(() => {
  cleanupTempDir(home);
});

async function runCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn({
    cmd: [process.execPath, "index.ts", ...args],
    cwd: repoRoot,
    env: { ...process.env, PLANOS_HOME: home },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

test("add then print --json round-trips tasks across sections", async () => {
  expect((await runCli(["add", "backlog task one"])).exitCode).toBe(0);
  expect((await runCli(["add", "doing task", "-s", "doing"])).exitCode).toBe(0);
  expect((await runCli(["add", "done task", "-s", "done"])).exitCode).toBe(0);

  const result = await runCli(["print", "--json"]);
  expect(result.exitCode).toBe(0);

  const tasks = JSON.parse(result.stdout) as Array<{ task: string; section: number }>;
  expect(tasks).toHaveLength(3);
  const byTitle = Object.fromEntries(tasks.map((t): [string, number] => [t.task, t.section]));
  expect(byTitle["backlog task one"]).toBe(2);
  expect(byTitle["doing task"]).toBe(1);
  expect(byTitle["done task"]).toBe(0);
});

test("add then print renders markdown by default", async () => {
  expect((await runCli(["add", "e2e markdown task"])).exitCode).toBe(0);
  const result = await runCli(["print"]);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("- [ ] e2e markdown task");
  expect(result.stdout).toContain("# BACKLOG");
});

test("completing a nonexistent task exits non-zero with an error", async () => {
  const result = await runCli(["complete", "does not exist"]);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr + result.stdout).toContain("task not found");
});
```

Notes for the implementer:
- `process.execPath` is the absolute path to the running bun executable — avoids PATH lookup problems on Windows.
- TUI commands (`note`, `start`, `complete` without an arg) are intentionally NOT covered — they require a real terminal (per spec).
- If `print` output ends with extra newline(s), `JSON.parse` still works; `toContain` is likewise newline-tolerant.

- [ ] **Step 2: Run the tests**

Run: `bun test tests/e2e/cli.test.ts`
Expected: 3 tests PASS. Each spawns real subprocesses; on failure check `result.stderr` first.

- [ ] **Step 3: Full suite + typecheck (final gate)**

Run: `bunx tsc` then `bun test`
Expected: tsc exits 0; the ENTIRE suite passes — unit (11) + integration (13) + commands (2+2+3+3+3) + e2e (3) = 40 tests, 0 failures.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/cli.test.ts
git commit -m "test: add e2e CLI tests against temp home"
```

---

## Self-Review Notes (already applied)

- Spec coverage: extras unit tests (Task 1), to-markdown (Task 2), DI + PLANOS_HOME refactor (Task 3), repository CRUD incl. constraints and error paths (Task 4), add/print/complete/note/start command tests with renderView seam (Tasks 5-9), E2E round-trip + error exit (Task 10). The one spec deviation (`toTaskRow` invalid-section guard → CHECK-constraint test) is documented in Task 4 and the spec was amended.
- All test code satisfies strict TS (`noUncheckedIndexedAccess` handled via `?.`/`!`, `verbatimModuleSyntax` via `import type`).
- No placeholders; every step has exact code or commands with expected outcomes.
