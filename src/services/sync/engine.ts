import type { Database } from "bun:sqlite";

import { deleteTaskById, getDatabase, getTaskById, insertTask, listTasks, updateTask } from "../storage/repository";
import { TASK_SECTION, type KnownSection, type TaskRow, type TaskSection } from "../storage/model";
import { deleteSyncLink, listSyncLinks, saveSyncLink, setSyncLinkFingerprint, type SyncLink } from "../storage/sync-links";
import type { RemoteTask, TaskSyncAdapter } from "./adapter";

type Counts = { created: number; updated: number; deleted: number };

export type SyncReport = {
  // local → remote
  pushed: Counts;
  // remote → local
  pulled: Counts;
  // one message per task that failed to sync; the rest of the sync still runs
  errors: string[];
};

const SECTION_NAMES = Object.fromEntries(
  Object.entries(TASK_SECTION).map(([name, value]) => [value, name]),
) as Record<TaskSection, KnownSection>;

// Two-way reconciliation between the local database and the adapter's remote list.
//
// Each SyncLink stores the task's fingerprint as of the last sync, so a side
// "changed" when its current fingerprint differs from the stored one:
// - changed on one side only → that side's version is copied to the other
// - changed on both sides → local wins (local storage is the source of truth)
// - deleted on one side, unchanged on the other → deleted on the other side too
// - deleted on one side, changed on the other → the changed copy is restored
// - present on one side only, never linked → created on the other side
export async function syncAll(adapter: TaskSyncAdapter, database: Database = getDatabase()): Promise<SyncReport> {
  const report: SyncReport = {
    pushed: { created: 0, updated: 0, deleted: 0 },
    pulled: { created: 0, updated: 0, deleted: 0 },
    errors: [],
  };
  const { provider } = adapter;

  const remoteTasks = await adapter.list();
  const remoteById = new Map(remoteTasks.map(task => [task.remoteId, task]));
  const localById = new Map(listTasks(database).map(task => [task.id, task]));
  // Links into another remote list (e.g. after changing the configured list) are ignored;
  // their local tasks count as unsynced and get created in the current list.
  const links = listSyncLinks(provider, database).filter(link => link.remoteListId === adapter.remoteListId);
  const linkedTaskIds = new Set(links.map(link => link.taskId));
  const linkedRemoteIds = new Set(links.map(link => link.remoteId));

  async function attempt(label: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (error) {
      report.errors.push(`${label}: ${(error as Error).message}`);
    }
  }

  async function push(task: TaskRow, kind: "created" | "updated"): Promise<void> {
    await adapter[kind](task);
    setSyncLinkFingerprint(task.id, provider, adapter.fingerprint(task), database);
    report.pushed[kind]++;
  }

  async function pull(remote: RemoteTask, local?: TaskRow): Promise<void> {
    let id: number;
    if (local) {
      // The remote can't tell doing from backlog; keep the local choice between them.
      const section = remote.section !== TASK_SECTION.done && local.section !== TASK_SECTION.done ? local.section : remote.section;
      updateTask(local.id, { task: remote.task, section, extras: remote.extras }, database);
      id = local.id;
      report.pulled.updated++;
    } else {
      id = insertTask(SECTION_NAMES[remote.section], remote.task, remote.extras, database);
      report.pulled.created++;
    }
    saveSyncLink({ taskId: id, provider, remoteListId: adapter.remoteListId, remoteId: remote.remoteId, fingerprint: remote.fingerprint }, database);

    // Normalize the remote copy when it doesn't round-trip (e.g. plain-text notes
    // typed in the remote app), so the next sync doesn't see a change.
    const pulled = getTaskById(id, database)!;
    if (adapter.fingerprint(pulled) !== remote.fingerprint) {
      await adapter.updated(pulled);
      setSyncLinkFingerprint(id, provider, adapter.fingerprint(pulled), database);
    }
  }

  async function reconcile(link: SyncLink): Promise<void> {
    const local = localById.get(link.taskId);
    const remote = remoteById.get(link.remoteId);
    const localChanged = local !== undefined && adapter.fingerprint(local) !== link.fingerprint;
    const remoteChanged = remote !== undefined && remote.fingerprint !== link.fingerprint;

    if (local && remote) {
      if (localChanged) await push(local, "updated");
      else if (remoteChanged) await pull(remote, local);
    } else if (local) {
      // Deleted remotely. `updated` recreates the remote copy when it's gone.
      if (localChanged) await push(local, "updated");
      else {
        deleteTaskById(local.id, database);
        deleteSyncLink(link.taskId, provider, database);
        report.pulled.deleted++;
      }
    } else if (remote) {
      // Deleted locally.
      if (remoteChanged) {
        deleteSyncLink(link.taskId, provider, database);
        await pull(remote);
      } else {
        await adapter.deleted(link.taskId);
        report.pushed.deleted++;
      }
    } else {
      deleteSyncLink(link.taskId, provider, database);
    }
  }

  for (const link of links) {
    const title = localById.get(link.taskId)?.task ?? remoteById.get(link.remoteId)?.task ?? `#${link.taskId}`;
    await attempt(`'${title}'`, () => reconcile(link));
  }

  for (const local of localById.values()) {
    if (!linkedTaskIds.has(local.id)) await attempt(`'${local.task}'`, () => push(local, "created"));
  }

  for (const remote of remoteTasks) {
    if (!linkedRemoteIds.has(remote.remoteId)) await attempt(`'${remote.task}'`, () => pull(remote));
  }

  return report;
}
