import { type Database } from "bun:sqlite";

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

let database: Database | undefined;

function getDatabase(): Database {
  return database ??= openDatabase();
}

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

export function listTasks(database = getDatabase()): TaskRow[] {
  const rows = database
    .query("SELECT id, task, section, extras FROM Tasks ORDER BY id DESC")
    .all() as DatabaseTaskRow[];
  return rows.map(toTaskRow);
}

export function getTaskById(id: number, database = getDatabase()): TaskRow | undefined {
  const row = database
    .query("SELECT id, task, section, extras FROM Tasks WHERE id = ? LIMIT 1")
    .get(id) as DatabaseTaskRow | null;
  return row ? toTaskRow(row) : undefined;
}

export function getOldestTaskByTitle(title: string, database = getDatabase()): TaskRow | undefined {
  const row = database
    .query("SELECT id, task, section, extras FROM Tasks WHERE task = ? ORDER BY id ASC LIMIT 1")
    .get(title) as DatabaseTaskRow | null;
  return row ? toTaskRow(row) : undefined;
}

export function insertTask(section: KnownSection, task: string, extras: Extras = {}, database = getDatabase()): number {
  const result = database
    .query("INSERT INTO Tasks (task, section, extras) VALUES (?, ?, ?)")
    .run(task, sectionValues[section], serializeExtras(extras));
  return Number(result.lastInsertRowid);
}

export function updateTask(id: number, changes: TaskUpdate, database = getDatabase()): void {
  const entries: [string, string | number][] = [];

  if (changes.task !== undefined) entries.push(["task", changes.task]);
  if (changes.section !== undefined) entries.push(["section", changes.section]);
  if (changes.extras !== undefined) entries.push(["extras", serializeExtras(changes.extras)]);
  if (entries.length === 0) throw new Error("Task update requires at least one field");

  const result = database
    .query(`UPDATE Tasks SET ${entries.map(([column]) => `${column} = ?`).join(", ")} WHERE id = ?`)
    .run(...entries.map(([, value]) => value), id);

  if (result.changes === 0) throw new Error(`Error: task not found: '${id}'`);
}

export function deleteTaskById(id: number, database = getDatabase()): void {
  const result = database.query("DELETE FROM Tasks WHERE id = ?").run(id);

  if (result.changes === 0) throw new Error(`Error: task not found: '${id}'`);
}
