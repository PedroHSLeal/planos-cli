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

All tasks are stored locally in `~/.config/planos/tasks.sqlite`. Nothing leaves your machine.

## Development

```sh
bun test    # run the test suite
bunx tsc    # typecheck
bun index.ts <cmd>   # run the CLI
```

## License

MIT
