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

# print your board (markdown by default)
planos print
planos print --json
```

Example output of `planos print`:

```markdown
# DOING

- [ ] fix the build

# DONE

- [x] write the README

# BACKLOG

- [ ] ship v1.0
```

## Data

All tasks are stored locally in `~/.config/planos/tasks.sqlite`. Nothing leaves your machine unless you enable Google Tasks sync.

## Google Tasks sync (optional)

When configured, every change made through planos is mirrored to [Google Tasks](https://developers.google.com/workspace/tasks/reference/rest) via the Tasks API. The local database stays the source of truth: sync is one-way (planos → Google), and a failed sync prints a warning without failing the command.

| planos operation | Tasks API call |
| --- | --- |
| `add` | `tasks.insert` |
| `start`, `complete`, `note` | `tasks.patch` (or `tasks.insert` if the task was never synced, or was deleted in Google) |
| task deletion | `tasks.delete` |

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
```

## License

MIT
