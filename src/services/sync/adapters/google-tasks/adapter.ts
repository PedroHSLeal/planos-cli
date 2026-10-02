import type { Database } from "bun:sqlite";

import type { TaskRow } from "../../../storage/model";
import { deleteSyncLink, getSyncLink, saveSyncLink } from "../../../storage/sync-links";
import type { TaskSyncAdapter } from "../../adapter";
import { createAccessTokenProvider } from "./auth";
import { createGoogleTasksClient, GoogleTasksApiError, type GoogleTasksClient } from "./client";
import { saveStoredGoogleCredentials, type GoogleTasksConfig } from "./config";
import { loginToGoogleTasks } from "./login";
import { toGoogleTask } from "./mapper";

export const GOOGLE_TASKS_PROVIDER = "google-tasks";

export type GoogleTasksAdapterOptions = {
  client: GoogleTasksClient;
  taskListId: string;
  login: () => Promise<void>;
  database?: Database;
};

export function createGoogleTasksAdapter({ client, taskListId, login, database }: GoogleTasksAdapterOptions): TaskSyncAdapter {
  async function insert(task: TaskRow): Promise<void> {
    const remote = await client.insertTask(taskListId, toGoogleTask(task));
    if (!remote.id) throw new Error("Google Tasks insert returned no task id");
    saveSyncLink({ taskId: task.id, provider: GOOGLE_TASKS_PROVIDER, remoteListId: taskListId, remoteId: remote.id }, database);
  }

  return {
    provider: GOOGLE_TASKS_PROVIDER,

    login,

    created: insert,

    async updated(task) {
      const link = getSyncLink(task.id, GOOGLE_TASKS_PROVIDER, database);
      // Tasks created before sync was enabled have no remote copy yet.
      if (!link) return insert(task);

      try {
        await client.patchTask(link.remoteListId, link.remoteId, toGoogleTask(task));
      } catch (error) {
        // Remote copy was deleted in Google Tasks; recreate it.
        if (error instanceof GoogleTasksApiError && error.status === 404) return insert(task);
        throw error;
      }
    },

    async deleted(taskId) {
      const link = getSyncLink(taskId, GOOGLE_TASKS_PROVIDER, database);
      if (!link) return;

      try {
        await client.deleteTask(link.remoteListId, link.remoteId);
      } catch (error) {
        if (!(error instanceof GoogleTasksApiError && error.status === 404)) throw error;
      }
      deleteSyncLink(taskId, GOOGLE_TASKS_PROVIDER, database);
    },
  };
}

export function createGoogleTasksAdapterFromConfig(config: GoogleTasksConfig, database?: Database): TaskSyncAdapter {
  const client = createGoogleTasksClient({ getAccessToken: createAccessTokenProvider(config) });
  const login = () => loginToGoogleTasks({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    saveCredentials: credentials => saveStoredGoogleCredentials(credentials),
  });
  return createGoogleTasksAdapter({ client, taskListId: config.taskListId, login, database });
}
