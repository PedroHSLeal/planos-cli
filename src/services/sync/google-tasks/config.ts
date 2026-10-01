export type GoogleTasksConfig = {
  taskListId: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
};

type Env = Record<string, string | undefined>;

// Sync is enabled when either a static access token or a full refresh-token
// credential set is present. Returns undefined when Google sync is not configured.
export function readGoogleTasksConfig(env: Env = process.env): GoogleTasksConfig | undefined {
  const accessToken = env.PLANOS_GOOGLE_ACCESS_TOKEN || undefined;
  const clientId = env.PLANOS_GOOGLE_CLIENT_ID || undefined;
  const clientSecret = env.PLANOS_GOOGLE_CLIENT_SECRET || undefined;
  const refreshToken = env.PLANOS_GOOGLE_REFRESH_TOKEN || undefined;

  if (!accessToken && !(clientId && clientSecret && refreshToken)) return undefined;

  return {
    taskListId: env.PLANOS_GOOGLE_TASKLIST || "@default",
    accessToken,
    clientId,
    clientSecret,
    refreshToken,
  };
}
