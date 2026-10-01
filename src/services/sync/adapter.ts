import type { TaskRow } from "../storage/model";

// A remote backend that mirrors local task operations.
export interface TaskSyncAdapter {
  readonly provider: string;
  // Interactively authenticates against the remote and persists the credentials.
  login(): Promise<void>;
  created(task: TaskRow): Promise<void>;
  updated(task: TaskRow): Promise<void>;
  deleted(taskId: number): Promise<void>;
}
