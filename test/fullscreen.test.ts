import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { enterFullscreen } from "../src/core/fullscreen.ts";
import { loadActions } from "../src/core/loader.ts";
import { type CLISession, fixturePath, spawnCLI } from "./harness";

describe("fullscreen metadata", () => {
  test("parses fullscreen: true from fixture", async () => {
    const actionsDir = join(fixturePath("ink-repo"), ".kadai", "actions");
    const actions = await loadActions(actionsDir);

    const fs = actions.find((a) => a.id === "fullscreen-counter");
    expect(fs).toBeDefined();
    expect(fs?.meta.fullscreen).toBe(true);
  });

  test("fullscreen defaults to false when absent", async () => {
    const actionsDir = join(fixturePath("ink-repo"), ".kadai", "actions");
    const actions = await loadActions(actionsDir);

    const counter = actions.find((a) => a.id === "counter");
    expect(counter).toBeDefined();
    expect(counter?.meta.fullscreen).toBe(false);
  });
});

describe("enterFullscreen utility", () => {
  test("writes alt screen sequence on enter", () => {
    const writes: string[] = [];
    const origWrite = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      writes.push(chunk);
      return true;
    }) as typeof process.stdout.write;

    try {
      const cleanup = enterFullscreen();
      expect(writes.some((w) => w.includes("\x1b[?1049h"))).toBe(true);
      cleanup();
    } finally {
      process.stdout.write = origWrite;
    }
  });

  test("writes leave sequence on cleanup", () => {
    const writes: string[] = [];
    const origWrite = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      writes.push(chunk);
      return true;
    }) as typeof process.stdout.write;

    try {
      const cleanup = enterFullscreen();
      writes.length = 0; // Clear enter writes
      cleanup();
      expect(writes.some((w) => w.includes("\x1b[?1049l"))).toBe(true);
    } finally {
      process.stdout.write = origWrite;
    }
  });

  test("double cleanup is idempotent", () => {
    const writes: string[] = [];
    const origWrite = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      writes.push(chunk);
      return true;
    }) as typeof process.stdout.write;

    try {
      const cleanup = enterFullscreen();
      cleanup();
      const countAfterFirst = writes.filter((w) =>
        w.includes("\x1b[?1049l"),
      ).length;
      cleanup();
      const countAfterSecond = writes.filter((w) =>
        w.includes("\x1b[?1049l"),
      ).length;
      expect(countAfterSecond).toBe(countAfterFirst);
    } finally {
      process.stdout.write = origWrite;
    }
  });
});

describe("fullscreen ink action integration", () => {
  let cli: CLISession;

  afterEach(() => {
    cli?.kill();
  });

  test("fullscreen action appears in menu", async () => {
    cli = spawnCLI({ cwd: fixturePath("ink-repo") });
    await cli.waitForText("Fullscreen Counter");
  });

  test("fullscreen action emits alt screen sequence", async () => {
    cli = spawnCLI({ cwd: fixturePath("ink-repo") });
    await cli.waitForText("Fullscreen Counter");
    cli.type("/");
    cli.type("Fullscreen Counter");
    cli.press("\r");
    await cli.waitForText("Fullscreen Counter: 0");
    // Raw output should contain alt screen enter sequence
    expect(cli.getOutput()).toContain("\x1b[?1049h");
  });

  test("exiting fullscreen action emits leave sequence", async () => {
    cli = spawnCLI({ cwd: fixturePath("ink-repo") });
    await cli.waitForText("Fullscreen Counter");
    cli.type("/");
    cli.type("Fullscreen Counter");
    cli.press("\r");
    await cli.waitForText("Fullscreen Counter: 0");
    cli.type("q");
    // Poll raw output for the leave sequence
    const start = Date.now();
    while (Date.now() - start < 5000) {
      if (cli.getOutput().includes("\x1b[?1049l")) return;
      await Bun.sleep(50);
    }
    throw new Error(
      "Timed out waiting for alt screen leave sequence in raw output",
    );
  });

  test("menu is visible after exiting fullscreen action", async () => {
    cli = spawnCLI({ cwd: fixturePath("ink-repo") });
    await cli.waitForText("Fullscreen Counter");
    cli.type("/");
    cli.type("Fullscreen Counter");
    cli.press("\r");
    await cli.waitForText("Fullscreen Counter: 0");
    cli.type("q");
    // After exiting fullscreen, the menu should re-render visibly.
    // The clear+home sequences reset the screen so Ink draws fresh.
    // Look for the status bar which only appears on the menu screen.
    await cli.waitForText("navigate");
  });

  test("non-fullscreen action has no alt screen sequences", async () => {
    cli = spawnCLI({ cwd: fixturePath("ink-repo") });
    await cli.waitForText("Counter");
    cli.type("/");
    cli.type("Counter");
    cli.press("\r");
    await cli.waitForText("Counter: 0");
    expect(cli.getOutput()).not.toContain("\x1b[?1049h");
  });
});
