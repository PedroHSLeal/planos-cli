import type { TaskSyncAdapter } from "./adapter";
import { createGoogleTasksAdapterFromConfig, resolveGoogleTasksConfig, GOOGLE_TASKS_PROVIDER } from "./adapters/google-tasks";

const factories: Record<string, () => TaskSyncAdapter> = {
  [GOOGLE_TASKS_PROVIDER]: () => createGoogleTasksAdapterFromConfig(resolveGoogleTasksConfig()),
};

export const SYNC_ADAPTER_NAMES = Object.keys(factories);

export function getSyncAdapter(name: string): TaskSyncAdapter {
  const factory = factories[name];
  if (!factory) {
    throw new Error(`Error: unknown adapter: '${name}' (available: ${SYNC_ADAPTER_NAMES.join(", ")})`);
  }
  return factory();
}
