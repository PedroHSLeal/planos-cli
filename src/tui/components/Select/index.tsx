import { render, useRenderer } from "@opentui/solid"
import type { TextareaRenderable } from "@opentui/core"
import { createSignal, onMount } from "solid-js"

export function Select(props: any) {
  const renderer = useRenderer()

  const [tasks, setTasks] = createSignal([]);

  onMount(() => {
    setTasks(props.tasks.map(t => ({ name: t, description: "" })))
  })

  return (
    <box style={{ flexDirection: "column", flexGrow: 1, padding: 1 }}>
      <select
        title=" write down your somethin... "
        options={tasks()}
        style={{ border: true, flexGrow: 1, padding: 1 }}
      />
        
      
    </box>
  )
}

