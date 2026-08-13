import { access, writeFile, readFile, mkdir } from "node:fs/promises";

import { BASE_PATH, EMPTY_STRUCTURE, FILE_PATH, type KnownSection, type Tasks } from "./model";
import { fromMarkdownToTasks } from "./from-markdown-to-tasks";
import { fromTasksToMarkdown } from "./from-tasks-to-markdown";
import { getExtra, updateExtra } from "./extras";

export async function getTasks(format: "raw"): Promise<string>
export async function getTasks(format: "obj"): Promise<Tasks>
export async function getTasks(format: "raw" | "obj") {
  await ensureFile();

  switch (format) {
    case "raw":
      return await readTasksFile();
    case "obj":
      return fromMarkdownToTasks(await readTasksFile());
    default:
      throw new Error("unknown format to getTasks()");
  }
}

export async function saveTasks(tasks: Tasks) {
  await writeTasksFile(tasks);
}

export async function addTaskToSection(section: KnownSection, task: string) {
  const tasks = await getTasks("obj");

  if (tasks[section]) tasks[section].unshift(task);
  else {
    tasks[section] = [task];
  }

  await saveTasks(tasks);
}

export async function completeTask(section: KnownSection, task: string) {
  checkSection("doing", section);

  const tasks = await getTasks("obj");

  const foundedExtra = getExtra(tasks, task);

  if (!foundedExtra) throw new Error(`Error in completing task '${task}': task not found`);
  else {
    foundedExtra.completedAt = new Date();

    updateExtra(tasks, task, foundedExtra);

    await saveTasks(tasks);
  }

}

export async function startTask(task: string) {
  const tasks = await getTasks("obj");

  const taskAboutToStart = tasks.backlog.find(t => t == task);
  const foundedExtra = getExtra(tasks, task);

  if (!taskAboutToStart) throw new Error(`Error in starting task '${task}': task not found in 'backlog'`);
  else {
    foundedExtra.startedAt = new Date();

    tasks.backlog.splice(tasks.backlog.indexOf(taskAboutToStart), 1);
    tasks.doing.unshift(taskAboutToStart);

    updateExtra(tasks, task, foundedExtra);

    await saveTasks(tasks);
  }
}

function checkSection(desiredSection: string, section: string) {
  if (desiredSection != section) throw new Error(`Invalid operation. KnownSection forbidden. Desired section: ${desiredSection}`);
}

async function ensureFile(): Promise<void> {
  try {
    await mkdir(BASE_PATH, { recursive: true });
    await access(FILE_PATH);
  } catch {
    try {
      await writeFile(FILE_PATH, fromTasksToMarkdown(structuredClone(EMPTY_STRUCTURE)));
    } catch (err) {
      throw new Error(`failed to create tasks file at ${FILE_PATH}: ${(err as Error).message}`);
    }
  }
}

async function readTasksFile(): Promise<string> {
  try {
    return await readFile(FILE_PATH, "utf8");
  } catch (err) {
    throw new Error(`failed to read tasks file at ${FILE_PATH}: ${(err as Error).message}`);
  }
}

async function writeTasksFile(tasks: Tasks): Promise<void> {
  try {
    return await writeFile(FILE_PATH, fromTasksToMarkdown(tasks), "utf8");
  } catch (err) {
    throw new Error(`failed to write tasks file at ${FILE_PATH}: ${(err as Error).message}`);
  }
}