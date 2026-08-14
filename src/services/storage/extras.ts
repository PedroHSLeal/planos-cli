import type { Extras } from "./model";

export function serializeExtras(extras: Extras): string {
  return JSON.stringify(extras);
}

export function deserializeExtras(value: string): Extras {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(`Invalid task extras JSON: ${(error as Error).message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid task extras JSON: expected an object");
  }

  const extras = { ...(parsed as Record<string, unknown>) } as Extras;

  for (const key of ["startedAt", "completedAt"] as const) {
    if (typeof extras[key] === "string") extras[key] = new Date(extras[key]);
  }

  return extras;
}
