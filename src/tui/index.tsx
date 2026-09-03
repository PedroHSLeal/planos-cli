import { createCliRenderer, type CliRendererConfig } from "@opentui/core";
import { render } from "@opentui/solid";

import { Editor, type EditorProps } from "./components/Editor";
import { Select, type SelectProps } from "./components/Select";

const rendererOptions: CliRendererConfig = {
  clearOnShutdown: false,
  screenMode: "split-footer",
  externalOutputMode: "capture-stdout",
  exitOnCtrlC: true,
};

async function renderView(componentFn: () => unknown) {
  const renderer = await createCliRenderer(rendererOptions);

  await render(componentFn, renderer);
  return renderer;
}

export function renderEditor(props: EditorProps) {
  return () => <Editor {...props} />;
}

export function renderSelect(props: SelectProps) {
  return () => <Select {...props} />;
}
