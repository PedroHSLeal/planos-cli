import type { TaskRow } from "../storage/model";

// A remote backend that mirrors local task operations.
export interface TaskSyncAdapter {
  readonly provider: string;
  created(task: TaskRow): Promise<void>;
  updated(task: TaskRow): Promise<void>;
  deleted(taskId: number): Promise<void>;
}
