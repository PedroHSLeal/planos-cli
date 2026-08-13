import { render, useRenderer } from "@opentui/solid"
import type { TextareaRenderable } from "@opentui/core"
import { useVimKeyboard } from "./vim-keymaps"

export function VimEditor(props: any) {
  const renderer = useRenderer()

  // SolidJS assigns this synchronously during creation.
  let ta!: TextareaRenderable

  // All keyboard / mode logic lives in the hook now.
  const { mode, pending } = useVimKeyboard(() => ta, props)

  const modeColor = () =>
    mode() === "insert" ? "#56FF88" :
      mode() === "visual" ? "#FFAA33" : "#56B6C2"

  return (
    <box style={{ flexDirection: "column", flexGrow: 1, padding: 1 }}>
      <box
        title=" write down your somethin... "
        style={{ border: true, flexGrow: 1, padding: 1 }}
      >
        <textarea
          ref={ta}
          id="editor"
          placeholder="Press i to insert · Esc for normal · v for visual"
          cursorColor="#FFFFFF"
          textColor="#E1E4E8"
          focusedBackgroundColor="#1a1a2e"
          selectionBg="#264F78"
          selectionFg="#FFFFFF"
          width="100%"
          height="100%"
        />
      </box>

      {/* {<box
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
          {"  h/j/k/l move · w/b words · 0/$ line · gg/G buffer · i/a/A/I/o/O insert · v visual · dd/dw/d$ delete · cc/cw change · x delete char · u/C-r undo/redo · p paste · Esc normal · Ctrl-Enter quit"}
        </text>
      </box>} */}
    </box>
  )
}
