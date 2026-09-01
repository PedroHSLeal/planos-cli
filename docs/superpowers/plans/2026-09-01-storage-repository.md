# Storage Repository Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `src/services/storage/crud.ts` with a concise `repository.ts` containing the full CRUD set over a lazily-opened shared database, deleting all dead domain functions and factory/singleton boilerplate.

**Architecture:** Plain synchronous functions in `repository.ts` share one lazily-initialized `bun:sqlite` Database. `index.ts` re-exports the repository API. Callers rename `getTasks` → `listTasks` and `addTaskToSection` → `insertTask`. No factory, no async wrappers.

**Tech Stack:** TypeScript 7 (strict, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`), Bun runtime, `bun:sqlite`.

**Spec:** `docs/superpowers/specs/2026-09-01-storage-repository-design.md`

## Global Constraints

- Project has NO test framework — verify with `bunx tsc --noEmit` and CLI/smoke runs, not unit tests.
- All repository functions are synchronous (bun:sqlite is sync; callers' existing `await` still works).
- Import types with `import { type X }` / `import type` (verbatimModuleSyntax is on).
- Import path for callers stays `../../../services/storage` (only names change).
- `database.ts`, `extras.ts`, `model.ts`, `to-markdown.ts` are NOT modified.
- Error messages preserved verbatim: `Error: task not found: '<id>'`, `Task update requires at least one field`, `Invalid task section value: <n>`.
- Do not run `git push` or modify git config. Commit only the files each task lists.

---

### Task 1: Create `repository.ts`

**Files:**
- Create: `src/services/storage/repository.ts`
- No other files touched. `crud.ts` keeps compiling alongside until Task 2.

**Interfaces:**
- Consumes: `openDatabase(): Database` from `./database`; `serializeExtras(extras: Extras): string`, `deserializeExtras(value: string): Extras` from `./extras`; types/consts `Extras`, `KnownSection`, `TaskRow`, `TaskSection`, `TaskUpdate`, `TASK_SECTION` from `./model`.
- Produces (used by Task 2's `index.ts` and by callers): `listTasks(): TaskRow[]`, `getTaskById(id: number): TaskRow | undefined`, `getOldestTaskByTitle(title: string): TaskRow | undefined`, `insertTask(section: KnownSection, task: string, extras?: Extras): number`, `updateTask(id: number, changes: TaskUpdate): void`, `deleteTaskById(id: number): void`.

- [ ] **Step 1: Write `src/services/storage/repository.ts` with this exact content**

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

export function listTasks(): TaskRow[] {
  const rows = getDatabase()
    .query("SELECT id, task, section, extras FROM Tasks ORDER BY id DESC")
    .all() as DatabaseTaskRow[];
  return rows.map(toTaskRow);
}

export function getTaskById(id: number): TaskRow | undefined {
  const row = getDatabase()
    .query("SELECT id, task, section, extras FROM Tasks WHERE id = ? LIMIT 1")
    .get(id) as DatabaseTaskRow | null;
  return row ? toTaskRow(row) : undefined;
}

export function getOldestTaskByTitle(title: string): TaskRow | undefined {
  const row = getDatabase()
    .query("SELECT id, task, section, extras FROM Tasks WHERE task = ? ORDER BY id ASC LIMIT 1")
    .get(title) as DatabaseTaskRow | null;
  return row ? toTaskRow(row) : undefined;
}

export function insertTask(section: KnownSection, task: string, extras: Extras = {}): number {
  const result = getDatabase()
    .query("INSERT INTO Tasks (task, section, extras) VALUES (?, ?, ?)")
    .run(task, sectionValues[section], serializeExtras(extras));
  return Number(result.lastInsertRowid);
}

export function updateTask(id: number, changes: TaskUpdate): void {
  const entries: [string, string | number][] = [];
  if (changes.task !== undefined) entries.push(["task", changes.task]);
  if (changes.section !== undefined) entries.push(["section", changes.section]);
  if (changes.extras !== undefined) entries.push(["extras", serializeExtras(changes.extras)]);
  if (entries.length === 0) throw new Error("Task update requires at least one field");

  const result = getDatabase()
    .query(`UPDATE Tasks SET ${entries.map(([column]) => `${column} = ?`).join(", ")} WHERE id = ?`)
    .run(...entries.map(([, value]) => value), id);
  if (result.changes === 0) throw new Error(`Error: task not found: '${id}'`);
}

export function deleteTaskById(id: number): void {
  const result = getDatabase().query("DELETE FROM Tasks WHERE id = ?").run(id);
  if (result.changes === 0) throw new Error(`Error: task not found: '${id}'`);
}
```

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/storage/repository.ts
git commit -m "feat: add task repository with full CRUD set"
```

---

### Task 2: Switch consumers to the repository and delete `crud.ts`

**Files:**
- Modify: `src/services/storage/index.ts` (full rewrite, 8 lines)
- Delete: `src/services/storage/crud.ts`
- Modify: `src/commands/tasks/add/index.ts` (import + call site)
- Modify: `src/commands/tasks/start/index.ts` (import + call site)
- Modify: `src/commands/tasks/complete/index.ts` (import + call site)
- Modify: `src/commands/tasks/note/index.ts` (import + call site)
- Modify: `src/commands/tasks/print/index.ts` (import only)

**Interfaces:**
- Consumes: everything from Task 1 (`listTasks`, `getTaskById`, `getOldestTaskByTitle`, `insertTask`, `updateTask`, `deleteTaskById`).
- Produces: the public storage API — `import { ... } from "../../../services/storage"` resolving to repository functions; `crud.ts` no longer exists.

- [ ] **Step 1: Rewrite `src/services/storage/index.ts`**

Replace the entire file with:

```ts
export {
  deleteTaskById,
  getOldestTaskByTitle,
  getTaskById,
  insertTask,
  listTasks,
  updateTask,
} from "./repository";
```

- [ ] **Step 2: Delete `src/services/storage/crud.ts`**

```bash
git rm src/services/storage/crud.ts
```

- [ ] **Step 3: Update `src/commands/tasks/add/index.ts`**

Change line 2 from:

```ts
import { addTaskToSection } from "../../../services/storage";
```

to:

```ts
import { insertTask } from "../../../services/storage";
```

Change line 10 from `await addTaskToSection(section, task);` to `await insertTask(section, task);`.

- [ ] **Step 4: Update `src/commands/tasks/start/index.ts`**

Change line 2 from:

```ts
import { getOldestTaskByTitle, getTasks } from "../../../services/storage";
```

to:

```ts
import { getOldestTaskByTitle, listTasks } from "../../../services/storage";
```

Change line 20 from `dbTasks = dbTasks.concat(await getTasks());` to `dbTasks = dbTasks.concat(await listTasks());`.

- [ ] **Step 5: Update `src/commands/tasks/complete/index.ts`**

Change line 2 from:

```ts
import { getOldestTaskByTitle, getTasks } from "../../../services/storage";
```

to:

```ts
import { getOldestTaskByTitle, listTasks } from "../../../services/storage";
```

Change line 22 from `dbTasks = dbTasks.concat(await getTasks());` to `dbTasks = dbTasks.concat(await listTasks());`.

- [ ] **Step 6: Update `src/commands/tasks/note/index.ts`**

Change line 3 from:

```ts
import { getOldestTaskByTitle, getTasks } from "../../../services/storage";
```

to:

```ts
import { getOldestTaskByTitle, listTasks } from "../../../services/storage";
```

Change line 21 from `dbTasks = dbTasks.concat(await getTasks());` to `dbTasks = dbTasks.concat(await listTasks());`.

- [ ] **Step 7: Update `src/commands/tasks/print/index.ts`**

Change line 3 from `import { getTasks } from "../../../services/storage";` to `import { listTasks } from "../../../services/storage";` and line 18 from `const tasks = await getTasks();` to `const tasks = await listTasks();`.

- [ ] **Step 8: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors (proves no `getTasks`/`addTaskToSection` references remain).

- [ ] **Step 9: CRUD round-trip smoke test**

Create a temporary file `smoke.repository.ts` at the repo root:

```ts
import {
  deleteTaskById,
  getOldestTaskByTitle,
  getTaskById,
  insertTask,
  listTasks,
  updateTask,
} from "./src/services/storage";

const id = insertTask("backlog", "__smoke_test__");
console.log("inserted id:", id, typeof id === "number" ? "OK" : "FAIL");
console.log("byId:", JSON.stringify(getTaskById(id)?.task) === '"__smoke_test__"' ? "OK" : "FAIL");
console.log("byTitle:", getOldestTaskByTitle("__smoke_test__")?.id === id ? "OK" : "FAIL");

updateTask(id, { task: "__smoke_test_renamed__" });
console.log("updated:", getTaskById(id)?.task === "__smoke_test_renamed__" ? "OK" : "FAIL");

deleteTaskById(id);
console.log("deleted:", getTaskById(id) === undefined ? "OK" : "FAIL");
console.log("leftover smoke rows:", listTasks().filter(t => t.task.includes("__smoke_test")).length);
```

Run: `bun smoke.repository.ts`
Expected: every line prints `OK`; final line prints `leftover smoke rows: 0`.

If any line prints FAIL or the script throws, delete the leftover `__smoke_test*` row(s) before proceeding (e.g. re-run after fixing, since `deleteTaskById` cleans up by id).

Then delete the temp file:

```bash
Remove-Item smoke.repository.ts
```

(or `rm smoke.repository.ts` on non-Windows shells)

- [ ] **Step 10: CLI smoke test (read-only)**

Run: `bun index.ts tasks print`
Expected: markdown task list prints without errors (same behavior as before the refactor).

- [ ] **Step 11: Commit**

```bash
git add src/services/storage/index.ts src/commands/tasks/add/index.ts src/commands/tasks/start/index.ts src/commands/tasks/complete/index.ts src/commands/tasks/note/index.ts src/commands/tasks/print/index.ts
git commit -m "refactor: replace storage crud layer with repository, drop dead code"
```

(The `git rm` from Step 2 already staged the deletion of `crud.ts`; if not, add it explicitly with `git add src/services/storage/crud.ts` before committing.)
