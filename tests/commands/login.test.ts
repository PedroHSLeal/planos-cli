import { describe, expect, mock, test } from "bun:test";
import { Command } from "commander";

const login = mock(async () => {});
const getSyncAdapter = mock((name: string) => {
  if (name !== "google-tasks") throw new Error(`Error: unknown adapter: '${name}'`);
  return { provider: name, login };
});

mock.module("../../src/services/sync", () => ({
  getSyncAdapter,
  SYNC_ADAPTER_NAMES: ["google-tasks"],
  syncTaskCreated: mock(async () => {}),
  syncTaskUpdated: mock(async () => {}),
  syncTaskDeleted: mock(async () => {}),
  setSyncAdapter: mock(() => {}),
}));

const loginCommand = (await import("../../src/commands/tasks/login")).default;

describe("planos login", () => {
  test("calls login on the named adapter", async () => {
    login.mockClear();
    getSyncAdapter.mockClear();

    const program = new Command();
    loginCommand(program);
    await program.parseAsync(["login", "google-tasks"], { from: "user" });

    expect(getSyncAdapter).toHaveBeenCalledWith("google-tasks");
    expect(login).toHaveBeenCalledTimes(1);
  });

  test("throws for an unknown adapter", async () => {
    login.mockClear();

    const program = new Command();
    loginCommand(program);
    await expect(program.parseAsync(["login", "nope"], { from: "user" })).rejects.toThrow("unknown adapter");
    expect(login).not.toHaveBeenCalled();
  });

  test("requires the adapter argument", async () => {
    const program = new Command();
    program.exitOverride();
    loginCommand(program);
    program.commands[0]?.exitOverride().configureOutput({ writeErr: () => {} });

    await expect(program.parseAsync(["login"], { from: "user" })).rejects.toThrow("missing required argument");
  });
});
