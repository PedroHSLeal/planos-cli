import { Database } from "bun:sqlite";

import { openDatabase } from "./database";
import { deserializeExtras, serializeExtras } from "./extras";
import {
  type Extras,
  type KnownSection,
  type TaskRow,
  type TaskSection,
  type TaskUpdate,
  TASK_SECTION,
} from "./model";

type DatabaseTaskRow = {
  id: number;
  task: string;
  section: number;
  extras: string;
};

const sectionValues: Record<KnownSection, TaskSection> = {
  done: TASK_SECTION.done,
  doing: TASK_SECTION.doing,
  backlog: TASK_SECTION.backlog,
};

function toTaskRow(row: DatabaseTaskRow): TaskRow {
  if (![TASK_SECTION.done, TASK_SECTION.doing, TASK_SECTION.backlog].includes(row.section as TaskSection)) {
    throw new Error(`Invalid task section value: ${row.section}`);
  }

  return {
    id: row.id,
    task: row.task,
    section: row.section as TaskSection,
    extras: deserializeExtras(row.extras),
  };
}

function firstTask(database: Database, task: string, section?: TaskSection) {
  const query = section === undefined
    ? "SELECT id, task, section, extras FROM Tasks WHERE task = ? ORDER BY id ASC LIMIT 1"
    : "SELECT id, task, section, extras FROM Tasks WHERE task = ? AND section = ? ORDER BY id ASC LIMIT 1";
  const row = section === undefined
    ? database.query(query).get(task) as DatabaseTaskRow | null
    : database.query(query).get(task, section) as DatabaseTaskRow | null;
  return row;
}

function requireTask(database: Database, task: string, section?: TaskSection) {
  const row = firstTask(database, task, section);
  if (!row) throw new Error(`Error: task not found: '${task}'`);
  return row;
}

export function createTaskStorage(database: Database) {
  return {
    async getTasks(): Promise<TaskRow[]> {
      const rows = database
        .query("SELECT id, task, section, extras FROM Tasks ORDER BY id DESC")
        .all() as DatabaseTaskRow[];
      return rows.map(toTaskRow);
    },

    async addTaskToSection(section: KnownSection, task: string, extras: Extras = {}): Promise<number> {
      const result = database
        .query("INSERT INTO Tasks (task, section, extras) VALUES (?, ?, ?)")
        .run(task, sectionValues[section], serializeExtras(extras));
      return Number(result.lastInsertRowid);
    },

    async startTask(task: string): Promise<void> {
      const row = requireTask(database, task, TASK_SECTION.backlog);
      const extras = deserializeExtras(row.extras);
      extras.startedAt = new Date();
      database.transaction(() => {
        database
          .query("UPDATE Tasks SET section = ?, extras = ? WHERE id = ?")
          .run(TASK_SECTION.doing, serializeExtras(extras), row.id);
      })();
    },

    async completeTask(section: KnownSection, task: string): Promise<void> {
      if (section !== "doing") {
        throw new Error(`Invalid operation. KnownSection forbidden. Desired section: doing`);
      }

      const row = requireTask(database, task, TASK_SECTION.doing);
      const extras = deserializeExtras(row.extras);
      extras.completedAt = new Date();
      database.transaction(() => {
        database
          .query("UPDATE Tasks SET section = ?, extras = ? WHERE id = ?")
          .run(TASK_SECTION.done, serializeExtras(extras), row.id);
      })();
    },

    async deleteTask(task: string): Promise<void> {
      const row = requireTask(database, task);
      database.query("DELETE FROM Tasks WHERE id = ?").run(row.id);
    },

    async updateTask(id: number, changes: TaskUpdate): Promise<void> {
      const entries: [string, string | number][] = [];
      if (changes.task !== undefined) entries.push(["task", changes.task]);
      if (changes.section !== undefined) entries.push(["section", changes.section]);
      if (changes.extras !== undefined) entries.push(["extras", serializeExtras(changes.extras)]);
      if (entries.length === 0) throw new Error("Task update requires at least one field");

      const result = database
        .query(`UPDATE Tasks SET ${entries.map(([column]) => `${column} = ?`).join(", ")} WHERE id = ?`)
        .run(...entries.map(([, value]) => value), id);
      if (result.changes === 0) throw new Error(`Error: task not found: '${id}'`);
    },
  };
}

let defaultStorage: ReturnType<typeof createTaskStorage> | undefined;

function getDefaultStorage() {
  return defaultStorage ??= createTaskStorage(openDatabase());
}

export async function getTasks() {
  return getDefaultStorage().getTasks();
}

export async function addTaskToSection(section: KnownSection, task: string, extras?: Extras) {
  return getDefaultStorage().addTaskToSection(section, task, extras);
}

export async function startTask(task: string) {
  return getDefaultStorage().startTask(task);
}

export async function completeTask(section: KnownSection, task: string) {
  return getDefaultStorage().completeTask(section, task);
}

export async function deleteTask(task: string) {
  return getDefaultStorage().deleteTask(task);
}

export async function updateTask(id: number, changes: TaskUpdate) {
  return getDefaultStorage().updateTask(id, changes);
}
