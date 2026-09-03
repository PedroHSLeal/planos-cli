# Editor Vim Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `VimEditor` to `Editor` and make Vim keyboard handling opt-in through `enableVimMode?: boolean`.

**Architecture:** Keep the shared textarea UI in `Editor` and retain Vim command handling in `vim-keymaps.ts`. Register one keyboard listener, but bypass Vim handling and `preventDefault()` when the flag is false so OpenTUI's native textarea editing remains active; handle `Ctrl+Enter` in either mode.

**Tech Stack:** Bun, TypeScript, SolidJS, `@opentui/core`, `@opentui/solid`.

## Global Constraints

- `enableVimMode` defaults to `false`.
- `Ctrl+Enter` invokes `onConfirmFn` with the textarea's current `plainText` in both modes.
- Vim normal, insert, visual, pending-command, register, movement, and editing behavior remains unchanged when enabled.
- Do not add a `VimEditor` compatibility alias.
- Tests must never open the real database.
- Verification commands are `bun test` and `bunx tsc`.

---

## File Map

- Rename `src/tui/components/VimEditor/index.tsx` to `src/tui/components/Editor/index.tsx`; export the general `Editor` component and `EditorProps`.
- Rename `src/tui/components/VimEditor/vim-keymaps.ts` to `src/tui/components/Editor/vim-keymaps.ts`; keep the Vim keyboard controller and add the enablement argument.
- Modify `src/tui/index.tsx`; import and render `Editor`.
- Modify `src/commands/tasks/note/view.tsx`; explicitly opt the notes editor into Vim mode.
- No TUI component test file is added because the repository convention excludes real TUI rendering tests; typecheck and the existing command suite verify the integration surface.

### Task 1: Rename the Component and Add the Opt-In API

**Files:**
- Rename: `src/tui/components/VimEditor/index.tsx` to `src/tui/components/Editor/index.tsx`
- Rename: `src/tui/components/VimEditor/vim-keymaps.ts` to `src/tui/components/Editor/vim-keymaps.ts`
- Modify: `src/tui/components/Editor/index.tsx`
- Modify: `src/tui/components/Editor/vim-keymaps.ts`

**Interfaces:**
- `EditorProps` produces `value: string`, `onConfirmFn: (plainText: string) => void`, and `enableVimMode?: boolean`.
- `useVimKeyboard` consumes `ta`, `onConfirmFn`, and `enableVimMode: boolean`.

- [ ] **Step 1: Rename both component files without changing their contents.**

Use a file move so the implementation history and the keymap filename are preserved. Keep both files under the new `Editor` directory.

- [ ] **Step 2: Update the public component type and export.**

In `src/tui/components/Editor/index.tsx`, change the props and function declaration to:

```tsx
export type EditorProps = {
  value: string;
  onConfirmFn: (plainText: string) => void;
  enableVimMode?: boolean;
}

export function Editor({ value, onConfirmFn, enableVimMode = false }: EditorProps) {
```

Pass the resolved boolean to the hook:

```tsx
const { mode, pending } = useVimKeyboard(
  () => ta,
  onConfirmFn,
  enableVimMode,
)
```

Render the Vim status/help bar only when `enableVimMode` is true. Keep the textarea layout and its existing Vim placeholder unchanged for enabled mode; use a native-editor placeholder such as `Type your notes · Ctrl-Enter to save` when disabled.

- [ ] **Step 3: Extend the hook signature without changing enabled-mode behavior.**

In `src/tui/components/Editor/vim-keymaps.ts`, use this signature:

```ts
export function useVimKeyboard(
  ta: () => TextareaRenderable | undefined,
  onConfirmFn: EditorProps["onConfirmFn"],
  enableVimMode: boolean,
) {
```

Inside the keyboard callback, resolve the editor first. Then handle `Ctrl+Enter` before the mode gate, and return immediately for all other keys when Vim mode is disabled:

```ts
const editor = ta()
if (!editor) return

const k: string = key.name ?? ""
const ctrl = !!key.ctrl

if (ctrl && k === "return") {
  key.preventDefault?.()
  onConfirmFn(editor.plainText)
  return
}

if (!enableVimMode) return

key.preventDefault?.()
```

After this gate, retain the existing Vim logic and derive `shift` and the current mode as before. This ordering is required: disabled mode must not swallow ordinary native textarea input, while confirmation must still work.

- [ ] **Step 4: Run the typecheck for the isolated component changes.**

Run: `bunx tsc`

Expected: PASS with no TypeScript errors, or errors only from unrelated pre-existing worktree changes. Resolve any errors caused by the rename/API changes before continuing.

- [ ] **Step 5: Commit the component refactor.**

```bash
git add -- src/tui/components/Editor src/tui/components/VimEditor
git commit -m "refactor: make editor vim mode opt-in"
```

### Task 2: Update TUI Consumers

**Files:**
- Modify: `src/tui/index.tsx`
- Modify: `src/commands/tasks/note/view.tsx`

**Interfaces:**
- `renderEditor(props: EditorProps)` continues to return a render function.
- The notes editor passes `enableVimMode: true`; other future consumers receive native editing by default.

- [ ] **Step 1: Update the TUI import and JSX component name.**

In `src/tui/index.tsx`, replace:

```ts
import { VimEditor, type EditorProps } from "./components/VimEditor";
```

with:

```ts
import { Editor, type EditorProps } from "./components/Editor";
```

and replace the renderer body with:

```tsx
export function renderEditor(props: EditorProps) {
  return () => <Editor {...props} />;
}
```

- [ ] **Step 2: Opt the note editor into Vim mode.**

Add `enableVimMode: true` to the object passed to `renderEditor` in `src/commands/tasks/note/view.tsx`, alongside `value` and `onConfirmFn`. This preserves the note command's existing modal editing behavior while making the general editor native by default.

- [ ] **Step 3: Search for stale component references.**

Run: `rg "VimEditor|components/VimEditor" src tests`

Expected: no matches. The keymap filename and `useVimKeyboard` references are allowed to remain.

- [ ] **Step 4: Run the existing test suite.**

Run: `bun test`

Expected: all existing tests pass. No test should launch an interactive TUI or access the real database.

- [ ] **Step 5: Commit the consumer updates.**

```bash
git add -- src/tui/index.tsx src/commands/tasks/note/view.tsx
git commit -m "refactor: rename vim editor consumer"
```

### Task 3: Final Verification

**Files:**
- Verify: `src/tui/components/Editor/index.tsx`
- Verify: `src/tui/components/Editor/vim-keymaps.ts`
- Verify: `src/tui/index.tsx`
- Verify: `src/commands/tasks/note/view.tsx`

- [ ] **Step 1: Check the final diff for whitespace errors.**

Run: `git diff HEAD~2 --check`

Expected: no output.

- [ ] **Step 2: Run the complete test suite and typecheck.**

Run: `bun test`

Expected: all tests pass.

Run: `bunx tsc`

Expected: TypeScript exits successfully with no errors from the refactor.

- [ ] **Step 3: Inspect the worktree for unintended files.**

Run: `git status --short`

Expected: only the intended component rename and consumer changes are present, plus any unrelated pre-existing worktree changes; do not stage or revert unrelated changes.
