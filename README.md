# planos

> a tiny todo manager — a fast CLI for people who live in the terminal.

`planos` keeps your tasks in three simple sections (**backlog**, **doing**, **done**) and gets out of your way. Data lives in a local SQLite file; interactive commands open a keyboard-driven TUI.

## Features

- **Three-section workflow** — backlog / doing / done, no projects, no tags, no ceremony
- **Interactive TUI** — `start`, `complete` and `note` open an OpenTUI interface with task selection and a vim-style editor for notes
- **Scriptable output** — print your board as markdown (default) or `--json` for piping into other tools
- **Local-first** — tasks are stored in a single SQLite database at `~/.config/planos/tasks.sqlite`
- **Fast** — built on [Bun](https://bun.sh), starts instantly

## Requirements

- [Bun](https://bun.sh) 1.x

## Installation

```sh
git clone https://github.com/<your-username>/planos.git
cd planos
bun install
```

Run it from the repo:

```sh
bun index.ts --help
```

## Usage

```sh
# add a task (goes to backlog by default)
planos add "write the README"

# add straight to a section
planos add "fix the build" --section doing

# start a task (backlog -> doing), opens the TUI when no task is given
planos start "write the README"

# mark a task as done, opens the TUI when no task is given
planos complete "write the README"

# edit task notes in a vim-style editor
planos note "write the README"

# log in to a sync adapter (see "Google Tasks sync" below)
planos login google-tasks

# two-way sync with the adapter (defaults to google-tasks)
planos sync

# print your board (markdown by default)
planos print
planos print --json
```

Example output of `planos print`:

```markdown
# DONE

- [x] write the README

# DOING

- [ ] fix the build

# BACKLOG

- [ ] ship v1.0
```

## Data

All tasks are stored locally in `~/.config/planos/tasks.sqlite`. Nothing leaves your machine unless you enable Google Tasks sync.

## Google Tasks sync (optional)

`planos sync` reconciles your local tasks with a [Google Tasks](https://developers.google.com/workspace/tasks/reference/rest) list in both directions, using the Tasks API. Every synced task remembers a fingerprint of its content from the last sync, which is how planos tells which side changed:

| situation since the last sync | result |
| --- | --- |
| task only exists locally | created in Google (`tasks.insert`) |
| task only exists in Google | created locally |
| changed locally | pushed to Google (`tasks.patch`) |
| changed in Google | pulled into planos |
| changed on both sides | **local wins** |
| deleted on one side, unchanged on the other | deleted on the other side too |
| deleted on one side, changed on the other | the changed copy is restored |

Google Tasks can't tell `doing` from `backlog`, so pulled open tasks keep their local section (new ones land in `doing` if they have a `startedAt`, otherwise `backlog`). A task completed in Google moves to `done`. Notes typed in the Google Tasks app become the task's plain notes. If a single task fails to sync, the rest still sync, the failure is printed, and the command exits with code 1.

Each Google task gets the planos title, a `completed` status when the task is done (or has `completedAt`), and the task's whole `extras` object (notes, `startedAt`, `completedAt`, …) stored as JSON in the Google task's **notes**.

### Logging in

1. In the Google Cloud console, enable the **Tasks API** and create an OAuth client of type **Desktop app**.
2. Run the login once with that client:

```sh
PLANOS_GOOGLE_CLIENT_ID=... PLANOS_GOOGLE_CLIENT_SECRET=... planos login google-tasks
```

This opens your browser (the URL is also printed), asks for the `https://www.googleapis.com/auth/tasks` scope and saves the resulting credentials to `~/.config/planos/google-tasks.json` (mode 600). After that, sync works with no environment variables.

### Environment overrides

Environment variables take precedence over the saved login:

```sh
export PLANOS_GOOGLE_CLIENT_ID=...
export PLANOS_GOOGLE_CLIENT_SECRET=...
export PLANOS_GOOGLE_REFRESH_TOKEN=...

# or a short-lived access token instead (handy for quick tests)
export PLANOS_GOOGLE_ACCESS_TOKEN=...

# optional: target task list id (defaults to your default list)
export PLANOS_GOOGLE_TASKLIST=@default
```

## Development

```sh
bun test    # run the test suite
bunx tsc    # typecheck
bun index.ts <cmd>   # run the CLI
bun run build        # compile a standalone ./planos executable for this platform
```

Every push to `master` runs `.github/workflows/build.yml`: typecheck and tests, then `bun run build` on Linux (x64, arm64), macOS (arm64) and Windows (x64), and publishes the executables as a GitHub release tagged `v<version>-build.<run number>`. To bake a Google OAuth client into the binaries (so users can run `planos login google-tasks` without env vars), set the `PLANOS_GOOGLE_CLIENT_ID` and `PLANOS_GOOGLE_CLIENT_SECRET` repository secrets.

## License

MIT
