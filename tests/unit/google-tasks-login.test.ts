import { describe, expect, mock, test } from "bun:test";

import { GOOGLE_TOKEN_URL } from "../../src/services/sync/google-tasks/auth";
import type { StoredGoogleCredentials } from "../../src/services/sync/google-tasks/config";
import { GOOGLE_AUTH_URL, GOOGLE_TASKS_SCOPE, loginToGoogleTasks } from "../../src/services/sync/google-tasks/login";
import { createFakeFetch, jsonResponse } from "../helpers/fake-fetch";

// Plays the browser: follows Google's redirect back to the local loopback server.
function browserRedirect(query: (authParams: URLSearchParams) => Record<string, string>) {
  return (authUrl: string) => {
    const authParams = new URL(authUrl).searchParams;
    const redirect = new URL(authParams.get("redirect_uri")!);
    for (const [key, value] of Object.entries(query(authParams))) redirect.searchParams.set(key, value);
    void fetch(redirect.toString()).catch(() => {});
  };
}

function baseOptions() {
  const saveCredentials = mock((_credentials: StoredGoogleCredentials) => {});
  const fake = createFakeFetch(() => jsonResponse({ access_token: "a", refresh_token: "refresh-1" }));
  return { saveCredentials, fake, log: () => {} };
}

describe("loginToGoogleTasks", () => {
  test("requires an OAuth client id and secret", async () => {
    const { saveCredentials, log } = baseOptions();

    await expect(loginToGoogleTasks({ saveCredentials, log })).rejects.toThrow("PLANOS_GOOGLE_CLIENT_ID");
    expect(saveCredentials).not.toHaveBeenCalled();
  });

  test("exchanges the redirected code and saves the refresh token", async () => {
    const { saveCredentials, fake, log } = baseOptions();
    let authParams: URLSearchParams | undefined;

    await loginToGoogleTasks({
      clientId: "id",
      clientSecret: "secret",
      saveCredentials,
      log,
      fetch: fake.fetch,
      openUrl: browserRedirect(params => {
        authParams = params;
        return { code: "auth-code", state: params.get("state")! };
      }),
    });

    expect(authParams?.get("client_id")).toBe("id");
    expect(authParams?.get("scope")).toBe(GOOGLE_TASKS_SCOPE);
    expect(authParams?.get("access_type")).toBe("offline");
    expect(authParams?.get("code_challenge_method")).toBe("S256");
    expect(authParams?.get("redirect_uri")).toStartWith("http://127.0.0.1:");

    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]?.url).toBe(GOOGLE_TOKEN_URL);
    const exchange = Object.fromEntries(new URLSearchParams(fake.requests[0]?.body));
    expect(exchange).toMatchObject({
      code: "auth-code",
      client_id: "id",
      client_secret: "secret",
      redirect_uri: authParams?.get("redirect_uri"),
      grant_type: "authorization_code",
    });
    expect(exchange.code_verifier).toBeString();

    expect(saveCredentials).toHaveBeenCalledWith({ clientId: "id", clientSecret: "secret", refreshToken: "refresh-1" });
  });

  test("rejects a redirect with the wrong state", async () => {
    const { saveCredentials, fake, log } = baseOptions();

    await expect(loginToGoogleTasks({
      clientId: "id",
      clientSecret: "secret",
      saveCredentials,
      log,
      fetch: fake.fetch,
      openUrl: browserRedirect(() => ({ code: "auth-code", state: "forged" })),
    })).rejects.toThrow("state mismatch");
    expect(fake.requests).toHaveLength(0);
  });

  test("reports a consent error from Google", async () => {
    const { saveCredentials, fake, log } = baseOptions();

    await expect(loginToGoogleTasks({
      clientId: "id",
      clientSecret: "secret",
      saveCredentials,
      log,
      fetch: fake.fetch,
      openUrl: browserRedirect(params => ({ error: "access_denied", state: params.get("state")! })),
    })).rejects.toThrow("access_denied");
    expect(saveCredentials).not.toHaveBeenCalled();
  });

  test("times out when no redirect arrives", async () => {
    const { saveCredentials, fake, log } = baseOptions();

    await expect(loginToGoogleTasks({
      clientId: "id",
      clientSecret: "secret",
      saveCredentials,
      log,
      fetch: fake.fetch,
      openUrl: () => {},
      timeoutMs: 20,
    })).rejects.toThrow("timed out");
  });

  test("prints the authorization URL", async () => {
    const { saveCredentials, fake } = baseOptions();
    const log = mock((_message: string) => {});

    await loginToGoogleTasks({
      clientId: "id",
      clientSecret: "secret",
      saveCredentials,
      log,
      fetch: fake.fetch,
      openUrl: browserRedirect(params => ({ code: "c", state: params.get("state")! })),
    });

    expect(String(log.mock.calls[0]?.[0])).toContain(GOOGLE_AUTH_URL);
  });
});
