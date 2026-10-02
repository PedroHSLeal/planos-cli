import { afterEach, describe, expect, test } from "bun:test";

import { createAccessTokenProvider, GOOGLE_TOKEN_URL } from "../../src/services/sync/adapters/google-tasks/auth";
import { createGoogleTasksClient, GoogleTasksApiError } from "../../src/services/sync/adapters/google-tasks/client";
import { installFakeFetch, jsonResponse } from "../helpers/fake-fetch";

let restoreFetch: (() => void) | undefined;

afterEach(() => {
  restoreFetch?.();
  restoreFetch = undefined;
});

function fakeFetch(respond: Parameters<typeof installFakeFetch>[0]) {
  const fake = installFakeFetch(respond);
  restoreFetch = fake.restore;
  return fake;
}

const BASE = "https://tasks.googleapis.com/tasks/v1";

function makeClient(respond: Parameters<typeof installFakeFetch>[0]) {
  const fake = fakeFetch(respond);
  const client = createGoogleTasksClient({ getAccessToken: async () => "tok" });
  return { client, requests: fake.requests };
}

describe("Google Tasks client", () => {
  test("insertTask POSTs the task to the list", async () => {
    const { client, requests } = makeClient(() => jsonResponse({ id: "g1", title: "t" }));

    const result = await client.insertTask("@default", { title: "t", notes: "{}" });

    expect(result).toEqual({ id: "g1", title: "t" });
    expect(requests[0]).toEqual({
      url: `${BASE}/lists/%40default/tasks`,
      method: "POST",
      headers: { Authorization: "Bearer tok", "Content-Type": "application/json" },
      body: JSON.stringify({ title: "t", notes: "{}" }),
    });
  });

  test("patchTask PATCHes the task", async () => {
    const { client, requests } = makeClient(() => jsonResponse({ id: "g1" }));

    await client.patchTask("list", "g1", { status: "completed" });

    expect(requests[0]?.method).toBe("PATCH");
    expect(requests[0]?.url).toBe(`${BASE}/lists/list/tasks/g1`);
    expect(requests[0]?.body).toBe(JSON.stringify({ status: "completed" }));
  });

  test("getTask GETs the task", async () => {
    const { client, requests } = makeClient(() => jsonResponse({ id: "g1", title: "x" }));

    expect(await client.getTask("list", "g1")).toEqual({ id: "g1", title: "x" });
    expect(requests[0]?.method).toBe("GET");
    expect(requests[0]?.body).toBeUndefined();
  });

  test("deleteTask DELETEs and accepts 204", async () => {
    const { client, requests } = makeClient(() => new Response(null, { status: 204 }));

    await client.deleteTask("list", "g1");

    expect(requests[0]?.method).toBe("DELETE");
    expect(requests[0]?.url).toBe(`${BASE}/lists/list/tasks/g1`);
  });

  test("listTasks follows pagination", async () => {
    const { client, requests } = makeClient(({ url }) =>
      url.includes("pageToken=p2")
        ? jsonResponse({ items: [{ id: "b" }] })
        : jsonResponse({ items: [{ id: "a" }], nextPageToken: "p2" }),
    );

    expect(await client.listTasks("list")).toEqual([{ id: "a" }, { id: "b" }]);
    expect(requests).toHaveLength(2);
  });

  test("non-2xx responses throw GoogleTasksApiError with the status", async () => {
    const { client } = makeClient(() => new Response("gone", { status: 404 }));

    const error = await client.getTask("list", "g1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GoogleTasksApiError);
    expect((error as GoogleTasksApiError).status).toBe(404);
  });
});

describe("createAccessTokenProvider", () => {
  test("returns a static access token without fetching", async () => {
    const fake = fakeFetch(() => jsonResponse({}));
    const provider = createAccessTokenProvider({ taskListId: "@default", accessToken: "static" });

    expect(await provider()).toBe("static");
    expect(fake.requests).toHaveLength(0);
  });

  test("exchanges the refresh token once and memoizes it", async () => {
    const fake = fakeFetch(() => jsonResponse({ access_token: "fresh" }));
    const provider = createAccessTokenProvider(
      { taskListId: "@default", clientId: "id", clientSecret: "secret", refreshToken: "refresh" }
    );

    expect(await provider()).toBe("fresh");
    expect(await provider()).toBe("fresh");
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]?.url).toBe(GOOGLE_TOKEN_URL);
    expect(Object.fromEntries(new URLSearchParams(fake.requests[0]?.body))).toEqual({
      client_id: "id",
      client_secret: "secret",
      refresh_token: "refresh",
      grant_type: "refresh_token",
    });
  });

  test("throws when the token endpoint rejects", async () => {
    const fake = fakeFetch(() => new Response("bad", { status: 400 }));
    const provider = createAccessTokenProvider(
      { taskListId: "@default", clientId: "id", clientSecret: "secret", refreshToken: "refresh" }
    );

    await expect(provider()).rejects.toThrow("token refresh failed");
  });
});
