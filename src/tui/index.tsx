import { render } from "@opentui/solid";

import { VimEditor } from "./components/VimEditor";
import { CliRenderer, createCliRenderer } from "@opentui/core";

export async function renderView(cb: any) {
  const renderer = await createCliRenderer({
    clearOnShutdown: false,
    screenMode: "split-footer",
    externalOutputMode: "capture-stdout",
    footerHeight: 20,
    exitOnCtrlC: false
  });

  return render(() => <VimEditor onConfirmFn={cb} />, renderer);
}
