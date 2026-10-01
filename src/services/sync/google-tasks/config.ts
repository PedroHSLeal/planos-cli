import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { BASE_PATH } from "../../storage/model";

export type GoogleTasksConfig = {
  taskListId: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
};

// Credentials written by `planos login google-tasks`.
export type StoredGoogleCredentials = {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
};

type Env = Record<string, string | undefined>;

export const GOOGLE_CREDENTIALS_PATH = join(BASE_PATH, "google-tasks.json");

export function readStoredGoogleCredentials(path = GOOGLE_CREDENTIALS_PATH): StoredGoogleCredentials {
  if (!existsSync(path)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" ? parsed as StoredGoogleCredentials : {};
  } catch {
    return {};
  }
}

export function saveStoredGoogleCredentials(credentials: StoredGoogleCredentials, path = GOOGLE_CREDENTIALS_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(credentials, null, 2), { mode: 0o600 });
  chmodSync(path, 0o600);
}

// Builds the config from env vars, falling back to stored login credentials
// (env wins). Missing credentials are left undefined.
export function resolveGoogleTasksConfig(env: Env = process.env, stored: StoredGoogleCredentials = readStoredGoogleCredentials()): GoogleTasksConfig {
  return {
    taskListId: env.PLANOS_GOOGLE_TASKLIST || "@default",
    accessToken: env.PLANOS_GOOGLE_ACCESS_TOKEN || undefined,
    clientId: env.PLANOS_GOOGLE_CLIENT_ID || stored.clientId || undefined,
    clientSecret: env.PLANOS_GOOGLE_CLIENT_SECRET || stored.clientSecret || undefined,
    refreshToken: env.PLANOS_GOOGLE_REFRESH_TOKEN || stored.refreshToken || undefined,
  };
}

// Sync is enabled when either a static access token or a full refresh-token
// credential set is present. Returns undefined when Google sync is not configured.
export function readGoogleTasksConfig(env: Env = process.env, stored: StoredGoogleCredentials = readStoredGoogleCredentials()): GoogleTasksConfig | undefined {
  const config = resolveGoogleTasksConfig(env, stored);
  if (!config.accessToken && !(config.clientId && config.clientSecret && config.refreshToken)) return undefined;
  return config;
}
