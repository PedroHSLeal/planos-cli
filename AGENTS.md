# AGENTS.md

Tiny Bun + commander todo CLI ("planos") with an OpenTUI (Solid) TUI layer. Windows dev machine.

## Commands

- `bun test` — full suite (107 tests). Single file: `bun test tests/commands/note.test.ts`
- `bunx tsc` — typecheck (tsconfig has `noEmit`; no dedicated script)
- `bun index.ts <cmd>` / `bun --watch index.ts` — run/dev the CLI
- No lint or codegen exists; don't invent steps

## Critical constraint: never touch the real database

The CLI stores tasks in `~/.config/planos/tasks.sqlite` (bun:sqlite). Tests must NEVER open it.
Inject a temp DB: repository functions take an optional trailing `database` param
(e.g. `insertTask("backlog", "task", {}, db)`), defaulting to the singleton. For subprocess/E2E
isolation, set `PLANOS_HOME=<temp dir>` (env read at module load in `src/services/storage/model.ts`;
empty string falls back to default).

## Architecture

- `index.ts` — commander program; each command self-registers from `src/commands/tasks/<name>/index.ts`
- `src/commands/tasks/<name>/view.tsx` — OpenTUI Solid TUI; `renderView` is the seam between CLI and TUI.
  Tests NEVER render it — mock the view module. TUI (Select/VimEditor) is intentionally untested
- `src/services/storage/` — repository.ts (CRUD), database.ts (open/init), extras.ts (JSON+Date
  serialization), to-markdown.ts, model.ts (types; sections done=0/doing=1/backlog=2)
- `src/services/sync/` — `TaskSyncAdapter` (push ops, `list()` of remote tasks, `fingerprint()`, `login()`).
  `engine.ts` `syncAll(adapter, db)` backs `planos sync`: two-way reconcile driven by the per-link `fingerprint`
  column in `SyncLinks` (last-synced remote-side content; local wins on conflict; per-task errors collected in the
  report). `hooks.ts` (`syncTaskCreated/Updated/Deleted`) remains but commands no longer call it. `registry.ts` maps adapter names → factories (used by `planos login <adapter>`). `google-tasks/` holds
  config (env `PLANOS_GOOGLE_*` over `<PLANOS_HOME>/google-tasks.json` saved by login), auth, login (OAuth loopback
  + PKCE via `Bun.serve` on 127.0.0.1), a Tasks API client using global `fetch`, mapper (extras → JSON in `notes`)
  and the adapter. Local↔remote ids live in the `SyncLinks` table (`storage/sync-links.ts`)
- bunfig.toml preloads `@opentui/solid/preload` — also active under `bun test`

## Testing conventions (established in tests/)

- Command tests use `mock.module("../../src/services/storage", ...)` with mocks defined at
  module top level, spreading the real `model` and `to-markdown` modules (the index re-exports them) and passed into the factory; the command module must be dynamically imported
  AFTER `mock.module`. `mock.module` resolves specifiers relative to the calling file — this
  boilerplate CANNOT be extracted into `tests/helpers/` (paths would break); duplication across
  test files is accepted
- Prefer mutable closure bindings over `mockImplementation` for controlling mock return values
- Drive commands with `program.parseAsync(["cmd", ...args], { from: "user" })` on a fresh
  `new Command()` per test
- E2E spawns the CLI with `process.execPath` (bun executable — PATH-lookup-free) and a temp
  `PLANOS_HOME`; TUI commands (no-arg complete/note/start) are excluded — they need a real terminal
- Temp-dir helpers live in `tests/helpers/tmp.ts`; `tests/helpers/fake-fetch.ts` records HTTP calls
  (`installFakeFetch` swaps `globalThis.fetch`; restore it in `afterEach`)
- Tests must NEVER hit Google: install a fake fetch, clear `PLANOS_GOOGLE_*` from `process.env` around config tests, use `setSyncAdapter(...)` (reset to `undefined` after),
  mock `src/services/sync` in command tests, and E2E strips `PLANOS_GOOGLE_*` from the child env.
  Sync tests import `sync/hooks` directly, not the `sync` index (which command tests mock). Pass the `stored`
  arg to `readGoogleTasksConfig` in tests. Engine tests use `createGoogleTasksAdapter` with an in-memory fake
  `GoogleTasksClient` (`tests/integration/sync-engine.test.ts`). Bun auto-loads `.env` (incl. `bun test`) — never
  build an adapter from env/config in tests so the real `~/.config/planos/google-tasks.json` is never read; login
  tests inject `openUrl` that plays the browser by hitting the loopback redirect

## TypeScript quirks

- `noUncheckedIndexedAccess` is on: `arr[0]` is `T | undefined` — use `?.` or `!`
- `verbatimModuleSyntax`: type-only imports need `import type` / inline `type`
- Solid JSX configured via tsconfig (`jsxImportSource: @opentui/solid`)

## Conventions

- Conventional commits (`feat:`, `test:`, `refactor:`, `docs:`)
- Repo-local OpenTUI docs/skill: `.claude/skills/opentui/` (mirror at `.agents/skills/opentui/`) — consult for TUI work
- No `main` branch and no remote; work happens on `prepare-for-publish`
