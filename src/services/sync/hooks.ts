import type { Database } from "bun:sqlite";

import { getTaskById } from "../storage/repository";
import type { TaskSyncAdapter } from "./adapter";
import { createGoogleTasksAdapterFromConfig } from "./google-tasks/adapter";
import { readGoogleTasksConfig } from "./google-tasks/config";

let adapter: TaskSyncAdapter | null | undefined;

function getAdapter(): TaskSyncAdapter | null {
  if (adapter === undefined) {
    const config = readGoogleTasksConfig();
    adapter = config ? createGoogleTasksAdapterFromConfig(config) : null;
  }
  return adapter;
}

// Overrides the env-derived adapter; null disables sync. Intended for tests.
export function setSyncAdapter(next: TaskSyncAdapter | null | undefined): void {
  adapter = next;
}

// Local storage is the source of truth: sync failures are reported, never thrown.
async function run(operation: string, fn: (adapter: TaskSyncAdapter) => Promise<void>): Promise<void> {
  const current = getAdapter();
  if (!current) return;

  try {
    await fn(current);
  } catch (error) {
    console.error(`planos: ${current.provider} sync failed (${operation}): ${(error as Error).message}`);
  }
}

export function syncTaskCreated(id: number, database?: Database): Promise<void> {
  return run("create", async adapter => {
    const task = getTaskById(id, database);
    if (task) await adapter.created(task);
  });
}

export function syncTaskUpdated(id: number, database?: Database): Promise<void> {
  return run("update", async adapter => {
    const task = getTaskById(id, database);
    if (task) await adapter.updated(task);
  });
}

export function syncTaskDeleted(id: number): Promise<void> {
  return run("delete", adapter => adapter.deleted(id));
}
