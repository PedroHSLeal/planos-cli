import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  readGoogleTasksConfig,
  readStoredGoogleCredentials,
  saveStoredGoogleCredentials,
} from "../../src/services/sync/adapters/google-tasks/config";
import { cleanupTempDir, makeTempDir } from "../helpers/tmp";

// Bun auto-loads .env (which may hold real PLANOS_GOOGLE_* values), so every test
// starts from a clean slate and sets only what it needs.
const savedGoogleEnv: Record<string, string | undefined> = {};

function setGoogleEnv(values: Record<string, string>): void {
  Object.assign(process.env, values);
}

beforeEach(() => {
  for (const key of Object.keys(process.env).filter(key => key.startsWith("PLANOS_GOOGLE_"))) {
    savedGoogleEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of Object.keys(process.env).filter(key => key.startsWith("PLANOS_GOOGLE_"))) delete process.env[key];
  Object.assign(process.env, savedGoogleEnv);
});

describe("readGoogleTasksConfig", () => {
  test("is disabled when no credentials are set", () => {
    expect(readGoogleTasksConfig({})).toBeUndefined();
  });

  test("is disabled with an incomplete refresh-token set", () => {
    setGoogleEnv({ PLANOS_GOOGLE_CLIENT_ID: "id", PLANOS_GOOGLE_REFRESH_TOKEN: "r" });
    expect(readGoogleTasksConfig({})).toBeUndefined();
  });

  test("enables with a refresh-token set and defaults the task list", () => {
    setGoogleEnv({
      PLANOS_GOOGLE_CLIENT_ID: "id",
      PLANOS_GOOGLE_CLIENT_SECRET: "secret",
      PLANOS_GOOGLE_REFRESH_TOKEN: "refresh",
    });
    expect(readGoogleTasksConfig({})).toEqual({
      taskListId: "@default",
      accessToken: undefined,
      clientId: "id",
      clientSecret: "secret",
      refreshToken: "refresh",
    });
  });

  test("enables with an access token and a custom task list", () => {
    setGoogleEnv({ PLANOS_GOOGLE_ACCESS_TOKEN: "tok", PLANOS_GOOGLE_TASKLIST: "list-1" });
    const config = readGoogleTasksConfig({});
    expect(config?.accessToken).toBe("tok");
    expect(config?.taskListId).toBe("list-1");
  });

  test("enables from stored login credentials", () => {
    const config = readGoogleTasksConfig({ clientId: "id", clientSecret: "secret", refreshToken: "stored" });
    expect(config?.refreshToken).toBe("stored");
  });

  test("env vars override stored credentials", () => {
    setGoogleEnv({ PLANOS_GOOGLE_REFRESH_TOKEN: "env" });
    const config = readGoogleTasksConfig({ clientId: "id", clientSecret: "secret", refreshToken: "stored" });
    expect(config?.refreshToken).toBe("env");
    expect(config?.clientId).toBe("id");
  });
});

describe("stored Google credentials", () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTempDir();
  });

  afterEach(() => {
    cleanupTempDir(dir);
  });

  test("round-trips through a private file", () => {
    const path = join(dir, "nested", "google-tasks.json");
    saveStoredGoogleCredentials({ clientId: "id", clientSecret: "secret", refreshToken: "r" }, path);

    expect(readStoredGoogleCredentials(path)).toEqual({ clientId: "id", clientSecret: "secret", refreshToken: "r" });
    if (process.platform !== "win32") expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  test("missing or corrupt files read as empty", () => {
    const path = join(dir, "google-tasks.json");
    expect(readStoredGoogleCredentials(path)).toEqual({});

    writeFileSync(path, "not json");
    expect(readStoredGoogleCredentials(path)).toEqual({});
  });
});
