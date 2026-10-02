export const GOOGLE_TASKS_BASE_URL = "https://tasks.googleapis.com/tasks/v1";

export type GoogleTaskStatus = "needsAction" | "completed";

// Subset of the Tasks API `Task` resource that planos reads and writes.
export type GoogleTask = {
  id?: string;
  title?: string;
  notes?: string;
  status?: GoogleTaskStatus;
  completed?: string | null;
  due?: string;
  updated?: string;
};

export class GoogleTasksApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "GoogleTasksApiError";
  }
}

export type GoogleTasksClientOptions = {
  getAccessToken: () => Promise<string>;
  
  baseUrl?: string;
};

export type GoogleTasksClient = ReturnType<typeof createGoogleTasksClient>;

// Thin wrapper over the Tasks API `tasks` endpoints.
export function createGoogleTasksClient({ getAccessToken, baseUrl = GOOGLE_TASKS_BASE_URL }: GoogleTasksClientOptions) {
  async function request<T>(method: string, path: string, body?: GoogleTask): Promise<T> {
    const headers: Record<string, string> = { Authorization: `Bearer ${await getAccessToken()}` };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      throw new GoogleTasksApiError(response.status, `Google Tasks ${method} ${path} failed: ${response.status} ${await response.text()}`);
    }

    return (response.status === 204 ? undefined : await response.json()) as T;
  }

  const taskPath = (taskListId: string, taskId?: string) =>
    `/lists/${encodeURIComponent(taskListId)}/tasks${taskId === undefined ? "" : `/${encodeURIComponent(taskId)}`}`;

  return {
    // tasks.list
    async listTasks(taskListId: string): Promise<GoogleTask[]> {
      const tasks: GoogleTask[] = [];
      let pageToken: string | undefined;
      do {
        const query = new URLSearchParams({ showCompleted: "true", showHidden: "true", maxResults: "100" });
        if (pageToken) query.set("pageToken", pageToken);
        const page = await request<{ items?: GoogleTask[]; nextPageToken?: string }>("GET", `${taskPath(taskListId)}?${query}`);
        tasks.push(...(page.items ?? []));
        pageToken = page.nextPageToken;
      } while (pageToken);
      return tasks;
    },
    // tasks.get
    getTask(taskListId: string, taskId: string): Promise<GoogleTask> {
      return request("GET", taskPath(taskListId, taskId));
    },
    // tasks.insert
    insertTask(taskListId: string, task: GoogleTask): Promise<GoogleTask> {
      return request("POST", taskPath(taskListId), task);
    },
    // tasks.patch
    patchTask(taskListId: string, taskId: string, task: GoogleTask): Promise<GoogleTask> {
      return request("PATCH", taskPath(taskListId, taskId), task);
    },
    // tasks.delete
    async deleteTask(taskListId: string, taskId: string): Promise<void> {
      await request("DELETE", taskPath(taskListId, taskId));
    },
  };
}
