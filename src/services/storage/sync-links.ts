import { getDatabase } from "./repository";

export type SyncLink = {
  taskId: number;
  provider: string;
  remoteListId: string;
  remoteId: string;
  // Remote-side fingerprint of the task as of the last `planos sync`; null until then.
  fingerprint?: string | null;
};

const SYNC_LINK_COLUMNS = "taskId, provider, remoteListId, remoteId, fingerprint";

export function getSyncLink(taskId: number, provider: string, database = getDatabase()): SyncLink | undefined {
  const row = database
    .query(`SELECT ${SYNC_LINK_COLUMNS} FROM SyncLinks WHERE taskId = ? AND provider = ? LIMIT 1`)
    .get(taskId, provider) as SyncLink | null;
  return row ?? undefined;
}

export function listSyncLinks(provider: string, database = getDatabase()): SyncLink[] {
  return database
    .query(`SELECT ${SYNC_LINK_COLUMNS} FROM SyncLinks WHERE provider = ? ORDER BY taskId ASC`)
    .all(provider) as SyncLink[];
}

export function saveSyncLink(link: SyncLink, database = getDatabase()): void {
  database
    .query(`
      INSERT INTO SyncLinks (${SYNC_LINK_COLUMNS}) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (taskId, provider) DO UPDATE SET
        remoteListId = excluded.remoteListId, remoteId = excluded.remoteId, fingerprint = excluded.fingerprint
    `)
    .run(link.taskId, link.provider, link.remoteListId, link.remoteId, link.fingerprint ?? null);
}

export function setSyncLinkFingerprint(taskId: number, provider: string, fingerprint: string, database = getDatabase()): void {
  database.query("UPDATE SyncLinks SET fingerprint = ? WHERE taskId = ? AND provider = ?").run(fingerprint, taskId, provider);
}

export function deleteSyncLink(taskId: number, provider: string, database = getDatabase()): void {
  database.query("DELETE FROM SyncLinks WHERE taskId = ? AND provider = ?").run(taskId, provider);
}
