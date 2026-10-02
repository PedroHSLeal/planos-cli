import { getDatabase } from "./repository";

export type SyncLink = {
  taskId: number;
  provider: string;
  remoteListId: string;
  remoteId: string;
};

export function getSyncLink(taskId: number, provider: string, database = getDatabase()): SyncLink | undefined {
  const row = database
    .query("SELECT taskId, provider, remoteListId, remoteId FROM SyncLinks WHERE taskId = ? AND provider = ? LIMIT 1")
    .get(taskId, provider) as SyncLink | null;
  return row ?? undefined;
}

export function saveSyncLink(link: SyncLink, database = getDatabase()): void {
  database
    .query(`
      INSERT INTO SyncLinks (taskId, provider, remoteListId, remoteId) VALUES (?, ?, ?, ?)
      ON CONFLICT (taskId, provider) DO UPDATE SET remoteListId = excluded.remoteListId, remoteId = excluded.remoteId
    `)
    .run(link.taskId, link.provider, link.remoteListId, link.remoteId);
}

export function deleteSyncLink(taskId: number, provider: string, database = getDatabase()): void {
  database.query("DELETE FROM SyncLinks WHERE taskId = ? AND provider = ?").run(taskId, provider);
}
