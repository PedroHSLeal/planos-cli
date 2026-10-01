import { describe, expect, test } from "bun:test";

import { readGoogleTasksConfig } from "../../src/services/sync/google-tasks/config";

describe("readGoogleTasksConfig", () => {
  test("is disabled when no credentials are set", () => {
    expect(readGoogleTasksConfig({})).toBeUndefined();
  });

  test("is disabled with an incomplete refresh-token set", () => {
    expect(readGoogleTasksConfig({ PLANOS_GOOGLE_CLIENT_ID: "id", PLANOS_GOOGLE_REFRESH_TOKEN: "r" })).toBeUndefined();
  });

  test("enables with a refresh-token set and defaults the task list", () => {
    expect(readGoogleTasksConfig({
      PLANOS_GOOGLE_CLIENT_ID: "id",
      PLANOS_GOOGLE_CLIENT_SECRET: "secret",
      PLANOS_GOOGLE_REFRESH_TOKEN: "refresh",
    })).toEqual({
      taskListId: "@default",
      accessToken: undefined,
      clientId: "id",
      clientSecret: "secret",
      refreshToken: "refresh",
    });
  });

  test("enables with an access token and a custom task list", () => {
    const config = readGoogleTasksConfig({ PLANOS_GOOGLE_ACCESS_TOKEN: "tok", PLANOS_GOOGLE_TASKLIST: "list-1" });
    expect(config?.accessToken).toBe("tok");
    expect(config?.taskListId).toBe("list-1");
  });
});
