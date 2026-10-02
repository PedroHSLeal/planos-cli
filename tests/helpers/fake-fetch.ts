export type RecordedRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
};

type Responder = (request: RecordedRequest) => Response | Promise<Response>;

// A fetch stand-in that records every request and answers via `respond`.
export function createFakeFetch(respond: Responder) {
  const requests: RecordedRequest[] = [];

  const fetchFn = async (input: string, init: RequestInit = {}): Promise<Response> => {
    const request: RecordedRequest = {
      url: input,
      method: init.method ?? "GET",
      headers: { ...(init.headers as Record<string, string> | undefined) },
      body: typeof init.body === "string" ? init.body : undefined,
    };
    requests.push(request);
    return respond(request);
  };

  return { fetch: fetchFn, requests };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Replaces the global fetch with a fake for the duration of a test; call `restore` in afterEach.
// The real fetch is returned for code that must still hit the network (e.g. the login loopback).
export function installFakeFetch(respond: Responder) {
  const realFetch = globalThis.fetch;
  const fake = createFakeFetch(respond);
  globalThis.fetch = fake.fetch as unknown as typeof fetch;
  return { requests: fake.requests, realFetch, restore: () => { globalThis.fetch = realFetch; } };
}
