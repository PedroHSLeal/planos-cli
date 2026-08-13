import { join } from "node:path";
import { homedir } from "node:os";

export type KnownSection = "doing" | "done" | "backlog";

export type Extras = {
  notes?: string;
  startedAt?: Date;
  completedAt?: Date;
  [key: string]: unknown;
}

export type Tasks = { [key in KnownSection]: string[] } & { extras: { [key: string]: Extras } };

export const BASE_PATH = join(homedir(), ".config", "planos");
export const FILE_PATH = join(BASE_PATH, "tasks.md");

export const TASK_MARKER = "- [ ] ";
export const TASK_COMPLETE_MARKER = "- [x] ";
export const HEADER_PREFIX = "# ";
export const SECTIONS: Record<KnownSection, string> = {
  doing: "# DOING",
  done: "# DONE",
  backlog: "# BACKLOG",
};
export const SECTION_ORDER: KnownSection[] = ["doing", "done", "backlog"];
export const EMPTY_STRUCTURE = { doing: [], done: [], backlog: [], extras: {} };