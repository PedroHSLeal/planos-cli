import type { Extras, Tasks } from "./model";

export function getExtra(tasks: Tasks, task: string): Extras {
  const value = Object.entries(tasks.extras).find(([k, v]) => k == task);
  return value?.length ? value[1] : {};
}

export function updateExtra(tasks: Tasks, task: string, obj: any) {
  const o: Record<string, any> = {};
  o[task] = obj;

  tasks.extras = { ...tasks.extras, ...o };
}