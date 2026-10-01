import type { TextareaRenderable } from "@opentui/core"
import { useVimKeyboard } from "./vim-keymaps"
import { Portal, useKeyboard, useRenderer } from "@opentui/solid";
import { createSignal, onMount, Show } from "solid-js";

export type EditorProps = {
  value: string;
  onConfirmFn: (plainText: string) => void;
  enableVimMode?: boolean;
}

export function Editor({ value, onConfirmFn, enableVimMode = false }: EditorProps) {
  const renderer = useRenderer();

  let refTextArea!: TextareaRenderable;

  useKeyboard((key: any) => {
    if (!refTextArea) return

    const k: string = key.name ?? ""
    const ctrl = !!key.ctrl

    if (ctrl && k === "return") {
      key.preventDefault?.();
      onConfirmFn(refTextArea.plainText);
      return;
    }
  });

  onMount(() => {
    refTextArea.focus();
  })

  return (
    <box style={{ backgroundColor: "#1a1a2e", flexDirection: "column", padding: 1 }}>
      <textarea
        ref={refTextArea}
        id="editor"
        initialValue={value}
        placeholder="Type your notes · Ctrl-Enter to save"
        cursorColor="#FFFFFF"
        textColor="#E1E4E8"
        focusedBackgroundColor="#1a1a2e"
        selectionBg="#264F78"
        selectionFg="#FFFFFF"
        width="100%"
        height="100%"
      />
    </box>
  )
}
