import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Command } from "commander";

import { TASK_SECTION, type TaskRow } from "../../src/services/storage/model";

const allTasks: TaskRow[] = [
  { id: 2, task: "second", section: TASK_SECTION.doing, extras: {} },
  { id: 1, task: "first", section: TASK_SECTION.done, extras: {} },
];

mock.module("../../src/services/storage", () => ({
  insertTask: mock(() => 1),
  listTasks: mock(() => allTasks),
  getTaskById: mock(() => undefined),
  getOldestTaskByTitle: mock((_title: string) => undefined),
  updateTask: mock(() => {}),
  deleteTaskById: mock(() => {}),
}));

const printCommand = (await import("../../src/commands/tasks/print")).default;

const originalLog = console.log;
const logged: string[] = [];

beforeEach(() => {
  logged.length = 0;
  console.log = ((...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  }) as typeof console.log;
});

afterEach(() => {
  console.log = originalLog;
});

describe("planos print", () => {
  test("prints markdown by default", async () => {
    const program = new Command();
    printCommand(program);
    await program.parseAsync(["print"], { from: "user" });

    expect(logged[0]).toContain("# DOING");
    expect(logged[0]).toContain("- [ ] second");
    expect(logged[0]).toContain("- [x] first");
  });

  test("prints JSON with --json", async () => {
    const program = new Command();
    printCommand(program);
    await program.parseAsync(["print", "--json"], { from: "user" });

    expect(JSON.parse(logged[0]!)).toEqual(allTasks);
  });
});
