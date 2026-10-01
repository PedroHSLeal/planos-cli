import { createCliRenderer, type CliRendererConfig } from "@opentui/core";
import { Dynamic, render, useRenderer } from "@opentui/solid";

import { updateTask } from "../../../services/storage";
import type { TaskRow } from "../../../services/storage/model";
import { syncTaskUpdated } from "../../../services/sync";
import { renderSelect } from "../../../tui";

const rendererOptions: CliRendererConfig = {
  clearOnShutdown: true,
  screenMode: "split-footer",
  externalOutputMode: "capture-stdout",
  exitOnCtrlC: true,
};

export async function renderView(initialProps: any) {
  const renderer = await createCliRenderer(rendererOptions);

  await render(() => <View {...initialProps} />, renderer);

  return renderer;
}

type ViewProps = {
  tasks: TaskRow[];
};

function View(initialProps: ViewProps) {
  const renderer = useRenderer();

  const select = renderSelect({
    items: initialProps.tasks.map(t => ({ name: t.task, description: "", value: t })),
    onConfirmFn: async ({ id, extras }: TaskRow) => {
      await updateTask(id, { extras: { ...extras, startedAt: new Date() } })
      renderer.destroy();
      await syncTaskUpdated(id);
    }
  });


  return (
    <>
      <Dynamic component={select} />
    </>
  )
}