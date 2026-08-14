# Note Command Design

## Goal

Add a `note <task>` command that opens the existing Vim editor, replaces the selected task's `extras.notes` with the editor's plain text when the user confirms exit, and persists the result in SQLite.

## Requirements

- `note` receives the task title as its single positional argument.
- The command selects the oldest matching task when duplicate titles exist.
- The oldest matching task is the row with the smallest database `id`.
- If no task matches, the command fails with a task-not-found error before opening the editor.
- The existing `VimEditor` component is rendered for a matching task.
- Confirmation uses the editor's existing `Ctrl-Enter` behavior.
- Confirmation saves the editor's plain text as `extras.notes`.
- Saving replaces the existing `extras.notes` value, including replacing it with an empty string.
- Other extras, including `startedAt`, `completedAt`, and unrelated keys, are preserved.

## Architecture

The storage layer owns duplicate-selection semantics. It will expose a helper that queries the oldest task by title with `ORDER BY id ASC LIMIT 1`. The note command will resolve that task before starting the TUI, so missing tasks fail without opening an editor.

After a successful lookup, the command will call the existing `renderView` function with an asynchronous confirmation callback. The callback will update the selected task by its stable internal ID using the existing `updateTask` API, merging the original extras and replacing only `notes`.

The Vim editor and keyboard controller do not need behavioral changes: `Ctrl-Enter` already passes `editor.plainText` to `onConfirmFn` and destroys the renderer. The command only supplies the callback that persists that value.

## Interfaces

The storage layer will add:

```ts
getOldestTaskByTitle(task: string): Promise<TaskRow | undefined>
```

The query will select `id`, `task`, `section`, and `extras` from `Tasks`, filter by the exact title, order by ascending ID, and limit the result to one row.

The command will be registered as:

```ts
program
  .command("note <task>")
  .description("edit notes for a task")
```

Its flow is:

1. Call `getOldestTaskByTitle(task)`.
2. Throw `Error: task not found: '<task>'` if the result is undefined.
3. Render `VimEditor` through `renderView`.
4. On confirmation, call `updateTask(existingTask.id, { extras: { ...existingTask.extras, notes: plainText } })`.

## Error Handling

- Missing tasks are rejected before `renderView` is called.
- Storage and update errors propagate to the command caller.
- An empty editor result is valid and is persisted as `notes: ""`.
- Duplicate task titles never cause a command-level scan or ambiguous update; the storage query chooses the smallest ID and the update uses that ID.

## Testing

Storage tests will cover:

- Selecting the oldest row for duplicate titles.
- Updating only the selected row when duplicates exist.
- Replacing an existing note with new plain text.
- Replacing an existing note with an empty string.
- Preserving date extras and unrelated extras during the note update.

Command tests will cover:

- Rendering the editor for a matching task and persisting the confirmed plain text.
- Failing before renderer startup for a missing task.
- Updating only the oldest duplicate.

The existing Vim editor behavior remains covered by its current integration path; no keymap changes are part of this feature.

## Scope

This feature does not add a notes-specific display command, alter task title matching, change generic task mutation ordering, or modify the Vim editor's key bindings.
