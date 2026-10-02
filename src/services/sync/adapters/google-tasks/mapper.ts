import { deserializeExtras, serializeExtras } from "../../../storage/extras";
import { TASK_SECTION, type Extras, type TaskRow } from "../../../storage/model";
import type { RemoteTask } from "../../adapter";
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

// Inverse of toGoogleTask. Notes that aren't planos JSON (e.g. typed in the
// Google Tasks app) become the task's plain notes. Since Google can't tell
// doing from backlog, an open task with a startedAt stamp is considered doing.
export function fromGoogleTask(remote: GoogleTask & { id: string }): RemoteTask {
  const extras = parseNotes(remote.notes);
  const completed = remote.status === "completed";

  if (!completed) delete extras.completedAt;
  else if (extras.completedAt === undefined && remote.completed) extras.completedAt = new Date(remote.completed);

  return {
    remoteId: remote.id,
    fingerprint: googleTaskFingerprint(remote),
    task: remote.title ?? "",
    section: completed ? TASK_SECTION.done : extras.startedAt ? TASK_SECTION.doing : TASK_SECTION.backlog,
    extras,
  };
}

// Only the fields planos writes take part; `completed` is excluded because
// toGoogleTask stamps it with the current time when completedAt is missing.
export function googleTaskFingerprint(task: GoogleTask): string {
  return JSON.stringify([task.title ?? "", task.notes ?? "", task.status ?? "needsAction"]);
}

function parseNotes(notes: string | undefined): Extras {
  if (!notes) return {};
  try {
    return deserializeExtras(notes);
  } catch {
    return { notes };
  }
}

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date();
}
