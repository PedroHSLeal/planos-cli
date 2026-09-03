# Editor Vim Mode Design

## Goal

Refactor the `VimEditor` TUI component into a general `Editor` component that
can use either native textarea editing or the existing Vim-style modal editing
behavior.

## Public API

The component will be exported from `src/tui/components/Editor/`:

```ts
export type EditorProps = {
  value: string;
  onConfirmFn: (plainText: string) => void;
  enableVimMode?: boolean;
};
```

`enableVimMode` defaults to `false`. Existing consumers that need modal Vim
editing must opt in explicitly. The component remains responsible for the
shared textarea layout and confirmation callback.

## Behavior

When Vim mode is disabled, the textarea keeps its native OpenTUI editing
behavior. The keyboard controller must not prevent default input or interpret
Vim commands. `Ctrl+Enter` remains handled by the editor and invokes
`onConfirmFn` with the textarea's current `plainText`.

When Vim mode is enabled, the current normal, insert, and visual modes,
movement commands, editing commands, pending commands, register behavior, and
status display remain unchanged. The existing Vim keymap implementation will
be adapted to receive the mode flag rather than duplicated.

The component and directory are renamed from `VimEditor` to `Editor`. All
imports and consumers are updated to use the new name. No compatibility alias
for `VimEditor` is added because this is an internal component with one known
consumer and the requested API explicitly renames it.

## Implementation Structure

- `src/tui/components/Editor/index.tsx` exports `Editor` and `EditorProps`.
- `src/tui/components/Editor/vim-keymaps.ts` retains the Vim keyboard logic and
  accepts the enablement flag plus the confirmation callback.
- The keyboard listener is registered consistently, but returns without
  preventing or handling ordinary keys when Vim mode is disabled. This avoids
  conditional hook registration and lets the native textarea receive input.
- `src/tui/index.tsx` imports and renders `Editor`.
- Editor consumers explicitly pass `enableVimMode: true` where Vim editing is
  required; other consumers use the default native behavior.

## Testing and Verification

Add or update focused tests for the editor-facing behavior where the existing
OpenTUI test setup permits it:

- Vim mode is opt-in and the prop type is accepted.
- Disabled mode does not swallow native textarea input.
- `Ctrl+Enter` invokes confirmation in both modes.
- Existing Vim command behavior remains covered by the current implementation
  path or by targeted hook tests if practical.

Run the project verification commands after implementation:

- `bun test`
- `bunx tsc`

Tests must not render against or modify the real task database; this refactor
does not change storage behavior.
