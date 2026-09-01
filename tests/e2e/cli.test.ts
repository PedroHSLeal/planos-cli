import { afterEach, beforeEach, expect, test } from "bun:test";
import { join } from "node:path";

import { cleanupTempDir, makeTempDir } from "../helpers/tmp";

const repoRoot = join(import.meta.dir, "..", "..");

let home: string;

beforeEach(() => {
  home = makeTempDir();
});

afterEach(() => {
  cleanupTempDir(home);
});

async function runCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn({
    cmd: [process.execPath, "index.ts", ...args],
    cwd: repoRoot,
    env: { ...process.env, PLANOS_HOME: home },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

test("add then print --json round-trips tasks across sections", async () => {
  expect((await runCli(["add", "backlog task one"])).exitCode).toBe(0);
  expect((await runCli(["add", "doing task", "-s", "doing"])).exitCode).toBe(0);
  expect((await runCli(["add", "done task", "-s", "done"])).exitCode).toBe(0);

  const result = await runCli(["print", "--json"]);
  expect(result.exitCode).toBe(0);

  const tasks = JSON.parse(result.stdout) as Array<{ task: string; section: number }>;
  expect(tasks).toHaveLength(3);
  const byTitle = Object.fromEntries(tasks.map((t): [string, number] => [t.task, t.section]));
  expect(byTitle["backlog task one"]).toBe(2);
  expect(byTitle["doing task"]).toBe(1);
  expect(byTitle["done task"]).toBe(0);
});

test("add then print renders markdown by default", async () => {
  expect((await runCli(["add", "e2e markdown task"])).exitCode).toBe(0);
  const result = await runCli(["print"]);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("- [ ] e2e markdown task");
  expect(result.stdout).toContain("# BACKLOG");
});

test("completing a nonexistent task exits non-zero with an error", async () => {
  const result = await runCli(["complete", "does not exist"]);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr + result.stdout).toContain("task not found");
});
