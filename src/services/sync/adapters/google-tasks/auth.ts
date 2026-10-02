import type { GoogleTasksConfig } from "./config";

export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// Returns a memoized access-token provider: a static token when configured,
// otherwise one exchanged from the refresh token on first use.
export function createAccessTokenProvider(config: GoogleTasksConfig): () => Promise<string> {
  let token: Promise<string> | undefined;

  return () => {
    if (config.accessToken) return Promise.resolve(config.accessToken);
    return token ??= refreshAccessToken(config).catch(error => {
      token = undefined;
      throw error;
    });
  };
}

async function refreshAccessToken(config: GoogleTasksConfig): Promise<string> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId ?? "",
      client_secret: config.clientSecret ?? "",
      refresh_token: config.refreshToken ?? "",
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${response.status} ${await response.text()}`);
  }

  const body = await response.json() as { access_token?: string };
  if (!body.access_token) throw new Error("Google token refresh failed: no access_token in response");
  return body.access_token;
}
