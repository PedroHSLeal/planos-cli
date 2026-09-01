import { describe, expect, test } from "bun:test";

import { deserializeExtras, serializeExtras } from "../../src/services/storage/extras";

describe("serializeExtras / deserializeExtras", () => {
  test("round-trips an extras object", () => {
    const extras = { notes: "hello" };
    expect(deserializeExtras(serializeExtras(extras))).toEqual(extras);
  });

  test("round-trips empty extras", () => {
    expect(deserializeExtras(serializeExtras({}))).toEqual({});
  });

  test("revives startedAt and completedAt strings into Dates", () => {
    const iso = "2026-09-01T10:00:00.000Z";
    const extras = deserializeExtras(JSON.stringify({ startedAt: iso, completedAt: iso }));
    expect(extras.startedAt).toBeInstanceOf(Date);
    expect(extras.completedAt).toBeInstanceOf(Date);
    expect((extras.startedAt as Date).toISOString()).toBe(iso);
  });

  test("leaves unknown string fields as strings", () => {
    const extras = deserializeExtras(JSON.stringify({ custom: "x" }));
    expect(typeof extras.custom).toBe("string");
  });

  test("throws on invalid JSON", () => {
    expect(() => deserializeExtras("not json")).toThrow("Invalid task extras JSON");
  });

  test("throws on array", () => {
    expect(() => deserializeExtras("[1,2]")).toThrow("expected an object");
  });

  test("throws on scalar", () => {
    expect(() => deserializeExtras("42")).toThrow("expected an object");
  });

  test("throws on null", () => {
    expect(() => deserializeExtras("null")).toThrow("expected an object");
  });
});
