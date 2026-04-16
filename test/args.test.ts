import { describe, expect, test } from "bun:test";
import { parseArgs } from "../src/core/args.ts";

describe("parseArgs", () => {
  test("no args → interactive", () => {
    expect(parseArgs([])).toEqual({ type: "interactive" });
  });

  test("list --json → list", () => {
    expect(parseArgs(["list", "--json"])).toEqual({
      type: "list",
      all: false,
    });
  });

  test("list --json --all → list with all", () => {
    expect(parseArgs(["list", "--json", "--all"])).toEqual({
      type: "list",
      all: true,
    });
  });

  test("list without --json → error", () => {
    const result = parseArgs(["list"]);
    expect(result.type).toBe("error");
  });

  test("run hello → run with actionId", () => {
    expect(parseArgs(["run", "hello"])).toEqual({
      type: "run",
      actionId: "hello",
    });
  });

  test("run database/reset → run with nested actionId", () => {
    expect(parseArgs(["run", "database/reset"])).toEqual({
      type: "run",
      actionId: "database/reset",
    });
  });

  test("run without action id → error", () => {
    const result = parseArgs(["run"]);
    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.message).toContain("action ID");
    }
  });

  test("mcp → mcp", () => {
    expect(parseArgs(["mcp"])).toEqual({ type: "mcp" });
  });

  test("--version → version", () => {
    expect(parseArgs(["--version"])).toEqual({ type: "version" });
  });

  test("-v → version", () => {
    expect(parseArgs(["-v"])).toEqual({ type: "version" });
  });

  test("sync → sync", () => {
    expect(parseArgs(["sync"])).toEqual({ type: "sync" });
  });

  test("--rerun → rerun", () => {
    expect(parseArgs(["--rerun"])).toEqual({ type: "rerun" });
  });

  test("-r → rerun", () => {
    expect(parseArgs(["-r"])).toEqual({ type: "rerun" });
  });

  test("unknown command → run with actionId", () => {
    expect(parseArgs(["foobar"])).toEqual({ type: "run", actionId: "foobar" });
  });

  test("unknown flag → error", () => {
    const result = parseArgs(["--foobar"]);
    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.message).toContain("--foobar");
    }
  });
});

describe("parseArgs — multi-run", () => {
  test("run with two IDs → run-sequential", () => {
    expect(parseArgs(["run", "build", "dev"])).toEqual({
      type: "run-sequential",
      actionIds: ["build", "dev"],
    });
  });

  test("run with three IDs → run-sequential", () => {
    expect(parseArgs(["run", "build", "test", "deploy"])).toEqual({
      type: "run-sequential",
      actionIds: ["build", "test", "deploy"],
    });
  });

  test("run with + separator → run-parallel", () => {
    expect(parseArgs(["run", "build", "+", "dev"])).toEqual({
      type: "run-parallel",
      actionIds: ["build", "dev"],
    });
  });

  test("run with multiple + separators → run-parallel", () => {
    expect(parseArgs(["run", "build", "+", "dev", "+", "test"])).toEqual({
      type: "run-parallel",
      actionIds: ["build", "dev", "test"],
    });
  });

  test("mixed spaces and + → error", () => {
    const result = parseArgs(["run", "build", "dev", "+", "test"]);
    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.message).toContain("mix");
    }
  });

  test("trailing + is also a mix error", () => {
    const result = parseArgs(["run", "a", "b", "+"]);
    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.message).toContain("mix");
    }
  });

  test("single ID still → run (unchanged)", () => {
    expect(parseArgs(["run", "hello"])).toEqual({
      type: "run",
      actionId: "hello",
    });
  });
});
