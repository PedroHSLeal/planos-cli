import { homedir } from "node:os";
import { join } from "node:path";

export type KnownSection = "doing" | "done" | "backlog";

export const TASK_SECTION = {
  done: 0,
  doing: 1,
  backlog: 2,
} as const;

export type TaskSection = (typeof TASK_SECTION)[keyof typeof TASK_SECTION];

export type Extras = {
  notes?: string;
  startedAt?: Date;
  completedAt?: Date;
  [key: string]: unknown;
};

export type TaskRow = {
  id: number;
  task: string;
  section: TaskSection;
  extras: Extras;
};

export type TaskUpdate = {
  task?: string;
  section?: TaskSection;
  extras?: Extras;
};

export const BASE_PATH = join(homedir(), ".config", "planos");
export const DATABASE_PATH = join(BASE_PATH, "tasks.sqlite");
