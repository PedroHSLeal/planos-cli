import { SelectRenderableEvents, type SelectOption, type SelectRenderable } from "@opentui/core";
import { createSignal, onMount } from "solid-js"

export type SelectProps = {
  items: SelectOption[];
  onConfirmFn: (value: any) => void;
}

export function Select({ items, onConfirmFn }: SelectProps) {
  let refSelect: SelectRenderable;

  const [optionItems] = createSignal<SelectOption[]>(items);

  onMount(() => {
    refSelect.focus();
    refSelect!.on(SelectRenderableEvents.ITEM_SELECTED, async (index: number, option: SelectOption) => {
      onConfirmFn(option.value);
    });
  });

  return (
    <box style={{ flexDirection: "column" }}>
      <text>[up / down] <span style={{ fg: "#777" }}>[j / k]</span> navigation - [enter] confirm</text>
      <select
        showDescription={false}
        showScrollIndicator={true}
        height="auto"
        width="auto"
        ref={(el) => { refSelect = el; }}
        options={optionItems()}
        style={{ flexGrow: 1, padding: 1 }}
      />
    </box>
  )
}
