import { createHash, randomBytes } from "node:crypto";

import { GOOGLE_TOKEN_URL } from "./auth";
import type { StoredGoogleCredentials } from "./config";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";

export type GoogleLoginOptions = {
  clientId?: string;
  clientSecret?: string;
  saveCredentials: (credentials: StoredGoogleCredentials) => void;
  openUrl?: (url: string) => void;
  log?: (message: string) => void;
  timeoutMs?: number;
};

// OAuth 2.0 installed-app flow with a loopback redirect and PKCE: the user
// consents in the browser, Google redirects to a temporary local server, and
// the code is exchanged for a refresh token that gets persisted.
export async function loginToGoogleTasks({
  clientId,
  clientSecret,
  saveCredentials,
  openUrl = openInBrowser,
  log = message => console.log(message),
  timeoutMs = 5 * 60_000,
}: GoogleLoginOptions): Promise<void> {
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google login requires an OAuth client: set PLANOS_GOOGLE_CLIENT_ID and PLANOS_GOOGLE_CLIENT_SECRET " +
      "(a \"Desktop app\" client from the Google Cloud console with the Tasks API enabled)",
    );
  }

  const state = base64Url(randomBytes(16));
  const codeVerifier = base64Url(randomBytes(32));
  const codeChallenge = base64Url(createHash("sha256").update(codeVerifier).digest());

  let settle!: { resolve: (code: string) => void; reject: (error: Error) => void };
  const codePromise = new Promise<string>((resolve, reject) => { settle = { resolve, reject }; });

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const params = new URL(request.url).searchParams;
      if (!params.has("code") && !params.has("error")) return new Response("Not found", { status: 404 });

      if (params.get("state") !== state) {
        settle.reject(new Error("Google login failed: state mismatch"));
        return new Response("Login failed: state mismatch. You can close this window.", { status: 400 });
      }
      const error = params.get("error");
      if (error) {
        settle.reject(new Error(`Google login failed: ${error}`));
        return new Response(`Login failed: ${error}. You can close this window.`, { status: 400 });
      }
      settle.resolve(params.get("code")!);
      return new Response("planos is logged in to Google Tasks. You can close this window.");
    },
  });

  const redirectUri = `http://127.0.0.1:${server.port}`;
  const authUrl = `${GOOGLE_AUTH_URL}?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_TASKS_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  })}`;

  const timeout = setTimeout(() => settle.reject(new Error("Google login timed out")), timeoutMs);

  try {
    log(`Open this URL to authorize planos with Google Tasks:\n\n${authUrl}\n`);
    openUrl(authUrl);

    const code = await codePromise;
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Google login failed: token exchange returned ${response.status} ${await response.text()}`);
    }

    const body = await response.json() as { refresh_token?: string };
    if (!body.refresh_token) throw new Error("Google login failed: no refresh_token in response");

    saveCredentials({ clientId, clientSecret, refreshToken: body.refresh_token });
  } finally {
    clearTimeout(timeout);
    server.stop(true);
  }
}

function base64Url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

// Best effort: the URL is also printed, so failing to launch a browser is fine.
function openInBrowser(url: string): void {
  const cmd =
    process.platform === "win32" ? ["rundll32", "url.dll,FileProtocolHandler", url]
    : process.platform === "darwin" ? ["open", url]
    : ["xdg-open", url];

  try {
    Bun.spawn({ cmd, stdout: "ignore", stderr: "ignore" }).exited.catch(() => {});
  } catch {
    // no browser launcher available
  }
}
