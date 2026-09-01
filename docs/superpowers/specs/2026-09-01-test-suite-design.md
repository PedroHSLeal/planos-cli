# planos Test Suite Design

**Date:** 2026-09-01
**Status:** Approved (user confirmed design)

## Goal

Add tests covering every CLI command and the storage layer so `planos` can be used
with confidence. Coverage follows a full pyramid: unit → integration → command →
E2E. The TUI rendering layer is intentionally untested for now, but command tests
mock `renderView` so real TUI tests can replace the mocks later.

## Decisions

- **Approach A — dependency injection** for the repository: each function accepts
  an optional `Database`, defaulting to the existing module singleton. Callers
  are unchanged.
- **`PLANOS_HOME` env var** overrides `BASE_PATH` in `model.ts`. Required for
  E2E isolation (a spawned subprocess cannot receive injected objects).
- **Runner:** `bun test` — built in, zero new dependencies.
- **TUI:** skipped, per user decision. `renderView` is mocked and asserted in
  command tests, leaving a seam for future TUI tests.

## Source changes (testability refactor)

### `src/services/storage/model.ts`

```ts
export const BASE_PATH = process.env.PLANOS_HOME
  ?? join(homedir(), ".config", "planos");
```

`DATABASE_PATH` stays derived from `BASE_PATH`. No other behavior change.

### `src/services/storage/repository.ts`

All exported functions gain an optional trailing `database?: Database`
parameter, defaulting to `getDatabase()`:

```ts
export function listTasks(database = getDatabase()): TaskRow[]
export function getTaskById(id: number, database = getDatabase()): TaskRow | undefined
export function getOldestTaskByTitle(title: string, database = getDatabase()): TaskRow | undefined
export function insertTask(section: KnownSection, task: string, extras: Extras = {}, database = getDatabase()): number
export function updateTask(id: number, changes: TaskUpdate, database = getDatabase()): void
export function deleteTaskById(id: number, database = getDatabase()): void
```

Existing callers pass no database and hit the singleton — no call-site changes.

### `package.json`

Add `"test": "bun test"` script.

## Test suite structure

```
tests/
  helpers/
    tmp.ts              # temp dir/DB helpers (create, cleanup)
  unit/
    extras.test.ts
    to-markdown.test.ts
  integration/
    repository.test.ts
  commands/
    add.test.ts
    print.test.ts
    complete.test.ts
    note.test.ts
    start.test.ts
  e2e/
    cli.test.ts
```

### Unit tests (no DB)

**`extras.test.ts`** — `serializeExtras`/`deserializeExtras`:
- round-trip: serialize → deserialize returns equivalent object
- `startedAt`/`completedAt` JSON strings are revived to `Date` instances
- invalid JSON throws "Invalid task extras JSON"
- array / scalar / null values rejected with "expected an object"

**`to-markdown.test.ts`** — `tasksToMarkdown`:
- headers appear in order: `# DOING`, `# DONE`, `# BACKLOG`
- done section renders `- [x]`, others `- [ ]`
- empty input produces headers with no items
- tasks are filtered into their correct sections

### Integration tests (temp-file SQLite via `openDatabase(tmpPath)`)

Each test gets a fresh temp DB; helpers create/teardown a temp directory.

**`repository.test.ts`**:
- insert → list round-trip; list ordered `id DESC`
- section mapping: `done`→0, `doing`→1, `backlog`→2
- `getTaskById`: found / undefined when missing
- `getOldestTaskByTitle`: returns oldest of duplicate titles
- `updateTask`: partial update (only `task`), section change, extras serialized on write; throws on empty update; throws `task not found` when id missing
- section CHECK constraint: invalid section insert fails (the `toTaskRow` invalid-section guard is unreachable through the schema, so it is covered by the constraint test instead of a direct test)
- `deleteTaskById`: removes row; throws when id missing

### Command tests (mocked storage, fresh `Command` program per test)

Storage module is replaced via `mock.module()`; `renderView` is mocked for
TUI commands and asserted with expected props.

**`add.test.ts`**: default section `backlog`; custom `-s`; calls
`insertTask(section, task)`.

**`print.test.ts`**: default markdown output; `--json` prints parsed JSON of tasks.

**`complete.test.ts`**: with task arg → `getOldestTaskByTitle` lookup, throws
`task not found` when missing; without arg → `listTasks`; `renderView` called
with `{ tasks }`.

**`note.test.ts`**: with task arg → `step: "editor"` and lookup; without arg →
`step: "select"` with all tasks; not-found throws.

**`start.test.ts`**: same shape as complete (lookup + not-found error, or
list-all; `renderView` called with `{ tasks }`).

### E2E tests (spawn real CLI with `PLANOS_HOME=<tmpdir>`)

**`cli.test.ts`** via `Bun.spawn`:
- `add` multiple tasks across sections → `print --json` returns them with
  correct sections (full-stack round trip)
- `complete "nonexistent"` exits non-zero with error message
- TUI commands (`note`, `start`, `complete` without arg) are excluded — they
  require a real terminal.

## Error handling expectations

All "task not found" paths must throw (commands surface commander errors);
invalid section / extras data must fail loudly rather than silently corrupt.
Tests assert both messages and exit behavior where applicable.

## What is NOT covered (explicitly out of scope)

- OpenTUI rendering, `Select`, `VimEditor` and `vim-keymaps` behavior
- Concurrent access / locking behavior of SQLite
- Windows-specific terminal behavior

## Future work

- Replace `renderView` mocks with OpenTUI component tests if tooling matures
- Property-based tests for `extras` round-trip
- CI workflow running `bun test` on push
