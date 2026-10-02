import type { TaskRow } from "../storage/model";

// A task as it currently exists in the remote, mapped back to local fields.
export type RemoteTask = Omit<TaskRow, "id"> & {
  remoteId: string;
  // Content fingerprint; compared against `fingerprint(localTask)` and the value stored at the last sync.
  fingerprint: string;
};

// A remote backend that mirrors local task operations.
export interface TaskSyncAdapter {
  readonly provider: string;
  // The remote list this adapter reads and writes (matches SyncLink.remoteListId).
  readonly remoteListId: string;
  // Interactively authenticates against the remote and persists the credentials.
  login(): Promise<void>;
  created(task: TaskRow): Promise<void>;
  updated(task: TaskRow): Promise<void>;
  deleted(taskId: number): Promise<void>;
  // Every task currently in the remote list.
  list(): Promise<RemoteTask[]>;
  // The fingerprint `task` would have in the remote once pushed.
  fingerprint(task: TaskRow): string;
}
