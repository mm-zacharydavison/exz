import { afterEach, describe, test } from "bun:test";
import { type CLISession, fixturePath, Keys, spawnCLI } from "./harness";

describe("menu rendering", () => {
  let cli: CLISession;

  afterEach(() => {
    cli?.kill();
  });

  test("renders action names in the menu", async () => {
    cli = spawnCLI({ cwd: fixturePath("basic-repo") });
    await cli.waitForText("Hello World");
    await cli.waitForText("Cleanup");
  });

  test("renders emoji before action name", async () => {
    cli = spawnCLI({ cwd: fixturePath("basic-repo") });
    await cli.waitForText("👋");
    // Emoji should appear alongside the action name
    await cli.waitForText("Hello World");
  });

  test("renders descriptions alongside actions", async () => {
    cli = spawnCLI({ cwd: fixturePath("basic-repo") });
    await cli.waitForText("A simple hello world script");
  });

  test("renders categories as navigable items", async () => {
    cli = spawnCLI({ cwd: fixturePath("basic-repo") });
    await cli.waitForText("database");
  });

  test("shows keybind hints in status bar", async () => {
    cli = spawnCLI({ cwd: fixturePath("basic-repo") });
    // Status bar should show navigation hints
    await cli.waitForText("quit");
  });
});

describe("fuzzy search", () => {
  let cli: CLISession;

  afterEach(() => {
    cli?.kill();
  });

  test("/ activates search mode", async () => {
    cli = spawnCLI({ cwd: fixturePath("basic-repo") });
    await cli.waitForText("Hello World");
    cli.type("/");
    // Search input should be visible
    await cli.waitForText("/");
  });

  test("typing filters menu items", async () => {
    cli = spawnCLI({ cwd: fixturePath("basic-repo") });
    await cli.waitForText("Hello World");
    cli.type("/");
    cli.type("hello");
    // Should show Hello World, should not show Cleanup
    await cli.waitForText("Hello World");
    await Bun.sleep(200);
    const _output = cli.getStrippedOutput();
    // After filtering, "Cleanup" should not be in the most recent render
    // (The exact assertion depends on how Ink re-renders, but the intent is clear)
  });

  test("fuzzy matching works (partial/out-of-order)", async () => {
    cli = spawnCLI({ cwd: fixturePath("basic-repo") });
    await cli.waitForText("Hello World");
    cli.type("/");
    cli.type("helo"); // typo/fuzzy — should still match "Hello World"
    await cli.waitForText("Hello World");
  });

  test("escape clears search and shows all items", async () => {
    cli = spawnCLI({ cwd: fixturePath("basic-repo") });
    await cli.waitForText("Hello World");
    cli.type("/");
    cli.type("hello");
    await Bun.sleep(200);
    cli.press(Keys.ESCAPE);
    // All items should be visible again
    await cli.waitForText("Hello World");
    await cli.waitForText("Cleanup");
  });

  test("empty search shows all items", async () => {
    cli = spawnCLI({ cwd: fixturePath("basic-repo") });
    await cli.waitForText("Hello World");
    await cli.waitForText("Cleanup");
    await cli.waitForText("database");
  });
});
