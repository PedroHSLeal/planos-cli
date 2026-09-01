# Storage Repository Refactor — Design

Date: 2026-09-01

## Goal

Refactor `src/services/storage` to be as concise as possible by extracting a repository containing just the CRUD operations, deleting dead code, and removing the factory/singleton boilerplate.

## Current State

- `crud.ts` (209 lines) mixes raw SQL, domain operations, a factory + lazy singleton, and 10 module-level wrapper functions.
- Only 3 storage functions are used by the app: `getTasks`, `getOldestTaskByTitle`, `addTaskToSection` (plus `tasksToMarkdown`).
- The domain functions (`startTask*`, `completeTask*`, `deleteTask`, `updateTask`, `getTaskById`) have no callers anywhere.

## Decisions

1. **Delete dead code.** All unused domain functions are removed. Only what the app uses plus the full CRUD set remains.
2. **Repository contains the full CRUD set** (list, getById, getByTitle, insert, update, deleteById) as a base layer for future features, even though only some are used today.
3. **Lazy module-level repository** (Approach A): plain functions over a lazily-opened shared `Database`. No factory, no wrapper layer, no class. The project has no tests, so an injectable database buys nothing.

## File Structure (after refactor)

```
src/services/storage/
  repository.ts   ← new: full CRUD, lazy shared DB
  database.ts     ← unchanged
  extras.ts       ← unchanged
  model.ts        ← unchanged
  to-markdown.ts  ← unchanged
  index.ts        ← re-exports from repository
```

`crud.ts` is deleted.

## Repository API

```ts
let db: Database | undefined;  // lazy, opened via openDatabase() on first use

export function listTasks(): TaskRow[]
export function getTaskById(id: number): TaskRow | undefined
export function getOldestTaskByTitle(title: string): TaskRow | undefined
export function insertTask(section: KnownSection, task: string, extras?: Extras): number  // returns new id
export function updateTask(id: number, changes: TaskUpdate): void
export function deleteTaskById(id: number): void
```

- All synchronous — bun:sqlite is synchronous, and existing `await` calls in commands keep working unchanged.
- Internal `DatabaseTaskRow` type + `toTaskRow` mapper (validates section enum, deserializes extras) carried over from `crud.ts`.
- Extras are serialized on insert/update and deserialized on read via `extras.ts`, as today.

## Public API Changes

- `getTasks` → `listTasks`
- `addTaskToSection` → `insertTask`
- `getOldestTaskByTitle` keeps its name.

Callers updated: `src/commands/tasks/{add,start,complete,note,print}/index.ts` (import path `services/storage` unchanged).

## Error Handling (preserved from current code)

- Corrupt section value in a row → throws.
- `updateTask` with zero fields → throws; affecting 0 rows → throws "task not found".
- `deleteTaskById` affecting 0 rows → throws "task not found" (matches old `deleteTask` semantics).

## Non-CRUD Functions

Only `tasksToMarkdown` remains; it already operates on plain `TaskRow[]` without touching the DB. No change.

## Verification

- No test suite exists. Verify with the project's typecheck/build command and by exercising the CLI commands (`tasks print`, `tasks add`, `tasks start`, `tasks complete`, `tasks note`) to confirm unchanged behavior.
