import { useKeyboard, useRenderer } from "@opentui/solid"
import type { TextareaRenderable } from "@opentui/core"
import { createSignal } from "solid-js"
import type { EditorProps } from ".";

export type Mode = "normal" | "insert" | "visual";

/**
 * Self-contained vim modal keyboard controller.
 *
 * Returns reactive signals for `mode` and `pending` so the caller can render
 * a status bar. The keyboard listener is registered internally via
 * `useKeyboard` (which itself hooks `onMount`).
 */
export function useVimKeyboard(
  ta: () => TextareaRenderable | undefined,
  onConfirmFn: EditorProps["onConfirmFn"],
  enableVimMode: boolean,
) {
  const [mode, setMode] = createSignal<Mode>("normal")
  const [pending, setPending] = createSignal("")
  const [register, setRegister] = createSignal("")

  const setM = (m: Mode) => setMode(m)
  const setP = (p: string) => setPending(p)
  const setR = (r: string) => setRegister(r)

  useKeyboard((key: any) => {
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

    // Global keypress listeners run before the focused textarea's built-in
    // handler. Without this, the textarea would also process every key --
    // inserting characters in normal/visual mode and double-inserting in
    // insert mode. We fully manage input here, so swallow the default.
    key.preventDefault?.()

    const shift = !!key.shift
    const m = mode()
    const p = pending()

    // ── Global keys ─────────────────────────────────────────────
    if (k === "escape") {
      if (m === "insert") editor.moveCursorLeft()
      editor.clearSelection()
      setM("normal"); setP("")
      return
    }

    // ── INSERT mode ─────────────────────────────────────────────
    if (m === "insert") {
      if (k === "return" || k === "enter") { editor.newLine(); return }
      if (k === "backspace") { editor.deleteCharBackward(); return }
      if (k === "space") { editor.insertChar(" "); return }
      if (k === "tab") { editor.insertText("  "); return }
      if (k === "left") { editor.moveCursorLeft(); return }
      if (k === "right") { editor.moveCursorRight(); return }
      if (k === "up") { editor.moveCursorUp(); return }
      if (k === "down") { editor.moveCursorDown(); return }
      if (ctrl) return
      if (k.length === 1) {
        editor.insertChar(shift ? k.toUpperCase() : k)
      }
      return
    }

    // ── NORMAL or VISUAL ────────────────────────────────────────
    const sel = m === "visual"
    const mv = (fn: (o?: { select?: boolean }) => void) =>
      sel ? fn({ select: true }) : fn()

    if (sel) {
      if (k === "d" || k === "x") { editor.deleteSelection(); setM("normal"); return }
      if (k === "y") { editor.clearSelection(); setM("normal"); return }
    }

    // ── Pending two-key prefixes ────────────────────────────────
    if (p === "g") {
      setP("")
      if (k === "g" && !shift) { mv(o => editor.gotoBufferHome(o)); return }
      return
    }
    if (p === "d") {
      setP("")
      if (k === "d") { editor.deleteLine(); if (sel) setM("normal"); return }
      if (k === "w") { editor.deleteWordForward(); if (sel) setM("normal"); return }
      if (k === "b") { editor.deleteWordBackward(); if (sel) setM("normal"); return }
      if (k === "$") { editor.deleteToLineEnd(); if (sel) setM("normal"); return }
      if (k === "0") { editor.deleteToLineStart(); if (sel) setM("normal"); return }
      return
    }
    if (p === "y") {
      setP("")
      if (k === "y") { setR(editor.plainText); if (sel) setM("normal"); return }
      return
    }
    if (p === "c") {
      setP("")
      if (k === "w") { editor.deleteWordForward(); setM("insert"); return }
      if (k === "c") { editor.deleteLine(); setM("insert"); return }
      if (k === "$") { editor.deleteToLineEnd(); setM("insert"); return }
      return
    }

    // ── Movement ────────────────────────────────────────────────
    if (k === "h") { mv(o => editor.moveCursorLeft(o)); return }
    if (k === "l") { mv(o => editor.moveCursorRight(o)); return }
    if (k === "j") { mv(o => editor.moveCursorDown(o)); return }
    if (k === "k") { mv(o => editor.moveCursorUp(o)); return }
    if (k === "w") { mv(o => editor.moveWordForward(o)); return }
    if (k === "b") { mv(o => editor.moveWordBackward(o)); return }
    if (k === "0") { mv(o => editor.gotoLineHome(o)); return }
    if (k === "$") { mv(o => editor.gotoLineEnd(o)); return }
    if (k === "g" && !shift) { setP("g"); return }
    if (k === "g" && shift) { mv(o => editor.gotoBufferEnd(o)); return }

    // ── Editing ─────────────────────────────────────────────────
    if (k === "x" && !shift) { editor.deleteChar(); if (sel) setM("normal"); return }
    if (k === "x" && shift) { editor.deleteCharBackward(); if (sel) setM("normal"); return }
    if (k === "d") { setP("d"); return }
    if (k === "y") { setP("y"); return }
    if (k === "c") { setP("c"); return }
    if (k === "u") { editor.undo(); return }
    if (ctrl && k === "r") { editor.redo(); return }
    if (k === "p") { if (register()) editor.insertText(register()); return }

    if (k === "d" && shift) { editor.deleteToLineEnd(); if (sel) setM("normal"); return }
    if (k === "c" && shift) { editor.deleteToLineEnd(); setM("insert"); return }
    if (k === "s" && shift) { editor.deleteLine(); setM("insert"); return }
    if (k === "s" && !shift) { editor.deleteChar(); setM("insert"); return }

    // ── Mode transitions ────────────────────────────────────────
    if (k === "i" && !shift) { setM("insert"); return }
    if (k === "i" && shift) { editor.gotoLineStart(); setM("insert"); return }
    if (k === "a" && !shift) { editor.moveCursorRight(); setM("insert"); return }
    if (k === "a" && shift) { editor.gotoLineEnd(); setM("insert"); return }
    if (k === "o" && !shift) { editor.gotoLineEnd(); editor.newLine(); setM("insert"); return }
    if (k === "o" && shift) { editor.gotoLineStart(); editor.newLine(); editor.moveCursorUp(); setM("insert"); return }
    if (k === "v" && !shift && !sel) { setM("visual"); return }
  })

  return { mode, pending, register }
}
