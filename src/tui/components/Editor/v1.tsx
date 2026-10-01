import type { TextareaRenderable } from "@opentui/core"
import { useVimKeyboard } from "./vim-keymaps"

export type EditorProps = {
  value: string;
  onConfirmFn: (plainText: string) => void;
  enableVimMode?: boolean;
}

export function Editor({ value, onConfirmFn, enableVimMode = false }: EditorProps) {
  // SolidJS assigns this synchronously during creation.
  let ta!: TextareaRenderable

  // All keyboard / mode logic lives in the hook now.
  const { mode, pending } = useVimKeyboard(() => ta, onConfirmFn, enableVimMode)

  const modeColor = () =>
    mode() === "insert" ? "#56FF88" :
      mode() === "visual" ? "#FFAA33" : "#56B6C2"

  return (
    <box style={{ flexDirection: "column", flexGrow: 1, padding: 1 }}>
      {enableVimMode && (
        <box
          style={{
            border: true,
            height: 3,
            paddingX: 1,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <text fg={modeColor()}>
            <b>-- {mode().toUpperCase()}{pending() ? ` (${pending()})` : ""} --</b>
          </text>
          <text fg="#777777">
            h/j/k/l move · w/b words · 0/$ line · gg/G buffer · i/a/A/I/o/O insert · v visual · dd/dw/d$ delete · cc/cw change · x delete char · u/C-r undo/redo · p paste · Esc normal · Ctrl-Enter quit
          </text>
        </box>
      )}
      <box
        title=" write down your notes "
        style={{ border: true, flexGrow: 1, padding: 1 }}
      >
        <textarea
          ref={ta}
          id="editor"
          initialValue={value}
          placeholder={enableVimMode
            ? "Press i to insert · Esc for normal · v for visual"
            : "Type your notes · Ctrl-Enter to save"}
          cursorColor="#FFFFFF"
          textColor="#E1E4E8"
          focusedBackgroundColor="#1a1a2e"
          selectionBg="#264F78"
          selectionFg="#FFFFFF"
          width="100%"
          height="100%"
        />
      </box>
    </box>
  )
}
