import { serializeExtras } from "../../storage/extras";
import { TASK_SECTION, type TaskRow } from "../../storage/model";
import type { GoogleTask } from "./client";

// Google Tasks only knows "needsAction" and "completed"; a task is completed when
// it sits in the done section or carries a completedAt stamp. The full extras
// object is stored, stringified, in the Google task's notes.
export function toGoogleTask(task: TaskRow): GoogleTask {
  const completed = task.section === TASK_SECTION.done || task.extras.completedAt !== undefined;

  return {
    title: task.task,
    notes: serializeExtras(task.extras),
    status: completed ? "completed" : "needsAction",
    completed: completed ? toDate(task.extras.completedAt).toISOString() : null,
  };
}

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date();
}
