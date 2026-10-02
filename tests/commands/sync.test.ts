import { afterEach, describe, expect, mock, test } from "bun:test";
import { Command } from "commander";

let report = {
  pushed: { created: 1, updated: 2, deleted: 3 },
  pulled: { created: 4, updated: 5, deleted: 6 },
  errors: [] as string[],
};

const adapter = { provider: "google-tasks" };
const syncAll = mock(async (_adapter: unknown) => report);
const getSyncAdapter = mock((name: string) => {
  if (name !== "google-tasks") throw new Error(`Error: unknown adapter: '${name}'`);
  return adapter;
});

mock.module("../../src/services/sync", () => ({
  getSyncAdapter,
  syncAll,
  SYNC_ADAPTER_NAMES: ["google-tasks"],
  syncTaskCreated: mock(async () => {}),
  syncTaskUpdated: mock(async () => {}),
  syncTaskDeleted: mock(async () => {}),
  setSyncAdapter: mock(() => {}),
}));

const syncCommand = (await import("../../src/commands/tasks/sync")).default;

const originalLog = console.log;
const originalError = console.error;

afterEach(() => {
  console.log = originalLog;
  console.error = originalError;
  process.exitCode = undefined;
  syncAll.mockClear();
  getSyncAdapter.mockClear();
});

async function run(...args: string[]) {
  const log = mock((..._args: unknown[]) => {});
  const error = mock((..._args: unknown[]) => {});
  console.log = log;
  console.error = error;

  const program = new Command();
  syncCommand(program);
  await program.parseAsync(["sync", ...args], { from: "user" });
  return { log, error };
}

describe("planos sync", () => {
  test("syncs the named adapter and prints a summary", async () => {
    const { log } = await run("google-tasks");

    expect(getSyncAdapter).toHaveBeenCalledWith("google-tasks");
    expect(syncAll).toHaveBeenCalledWith(adapter);
    expect(log).toHaveBeenCalledWith(
      "Synced with google-tasks: pushed 1 created, 2 updated, 3 deleted; pulled 4 created, 5 updated, 6 deleted.",
    );
    expect(process.exitCode).toBeUndefined();
  });

  test("requires the adapter argument", async () => {
    const program = new Command();
    program.exitOverride();
    syncCommand(program);
    program.commands[0]?.exitOverride().configureOutput({ writeErr: () => {} });

    await expect(program.parseAsync(["sync"], { from: "user" })).rejects.toThrow("missing required argument");
    expect(syncAll).not.toHaveBeenCalled();
  });

  test("reports per-task failures and sets a failing exit code", async () => {
    report = { ...report, errors: ["'task': boom"] };

    const { error } = await run("google-tasks");

    expect(error).toHaveBeenCalledWith("planos: google-tasks sync failed for 'task': boom");
    expect(process.exitCode).toBe(1);
  });

  test("throws for an unknown adapter", async () => {
    await expect(run("nope")).rejects.toThrow("unknown adapter");
    expect(syncAll).not.toHaveBeenCalled();
  });
});
