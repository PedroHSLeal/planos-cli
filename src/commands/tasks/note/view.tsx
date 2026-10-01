import { createCliRenderer, type CliRendererConfig } from "@opentui/core";
import { Dynamic, render, useRenderer } from "@opentui/solid";

import { createSignal, type JSXElement } from "solid-js";
import { getTaskById, updateTask } from "../../../services/storage";
import type { TaskRow } from "../../../services/storage/model";
import { syncTaskUpdated } from "../../../services/sync";
import { renderEditor, renderSelect } from "../../../tui";

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
  step: "select" | "editor";
  tasks: TaskRow[];
};

function View(initialProps: ViewProps) {
  const renderer = useRenderer();

  const [id, setId] = createSignal<number>();
  const [step, setStep] = createSignal<string>(initialProps.step);
  const [extras, setExtras] = createSignal<TaskRow["extras"] | undefined>(undefined);

  const steps: { [key: string]: (props: any) => JSXElement } = {
    select: renderSelect({
      items: initialProps.tasks.map(t => ({ name: t.task, description: "", value: t })),
      onConfirmFn: async ({ id }: TaskRow) => {
        setId(id);
        setExtras(getTaskById(id)?.extras);
        setStep("editor");
      }
    }),
    editor: renderEditor({
      value: (initialProps?.tasks[0]?.extras ?? extras())?.notes ?? "",
      enableVimMode: true,
      onConfirmFn: async (plainText) => {
        updateTask(id()!, { extras: { ...extras(), notes: plainText } })
        renderer.destroy();
        await syncTaskUpdated(id()!);
      }
    })
  }

  return (
    <>
      <Dynamic component={steps[step()]} />
    </>
  )
}
