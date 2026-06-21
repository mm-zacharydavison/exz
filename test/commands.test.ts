import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixturePath, spawnCLI, TEST_HOME } from "./harness.ts";

// ─── list --json ─────────────────────────────────────────────────

describe("kadai list --json", () => {
  test("outputs valid JSON with correct fields", async () => {
    const session = spawnCLI({
      cwd: fixturePath("basic-repo"),
      args: ["list", "--json"],
    });
    const { exitCode, output } = await session.waitForExit();
    expect(exitCode).toBe(0);

    const actions = JSON.parse(output);
    expect(Array.isArray(actions)).toBe(true);
    expect(actions.length).toBeGreaterThan(0);

    // Check that each action has the expected fields
    for (const action of actions) {
      expect(action).toHaveProperty("id");
      expect(action).toHaveProperty("name");
      expect(action).toHaveProperty("runtime");
      expect(typeof action.id).toBe("string");
      expect(typeof action.name).toBe("string");
    }
  });

  test("JSON excludes internal fields", async () => {
    const session = spawnCLI({
      cwd: fixturePath("basic-repo"),
      args: ["list", "--json"],
    });
    const { output } = await session.waitForExit();
    const actions = JSON.parse(output);

    for (const action of actions) {
      expect(action).not.toHaveProperty("filePath");
      expect(action).not.toHaveProperty("addedAt");
      expect(action).not.toHaveProperty("shebang");
    }
  });

  test("includes expected actions from basic-repo", async () => {
    const session = spawnCLI({
      cwd: fixturePath("basic-repo"),
      args: ["list", "--json"],
    });
    const { output } = await session.waitForExit();
    const actions = JSON.parse(output);
    const ids = actions.map((a: { id: string }) => a.id);

    expect(ids).toContain("hello");
    expect(ids).toContain("database/reset");
    expect(ids).toContain("database/migrate");
  });

  test("hidden actions excluded by default", async () => {
    const session = spawnCLI({
      cwd: fixturePath("basic-repo"),
      args: ["list", "--json"],
    });
    const { output } = await session.waitForExit();
    const actions = JSON.parse(output);
    const ids = actions.map((a: { id: string }) => a.id);

    expect(ids).not.toContain("secret-tool");
  });

  test("hidden actions included with --all", async () => {
    const session = spawnCLI({
      cwd: fixturePath("basic-repo"),
      args: ["list", "--json", "--all"],
    });
    const { output } = await session.waitForExit();
    const actions = JSON.parse(output);
    const ids = actions.map((a: { id: string }) => a.id);

    expect(ids).toContain("secret-tool");
  });

  test("exits 1 with error when no .kadai dir", async () => {
    // Use a temp dir so findZcliDir can't find .kadai by searching upward
    const tmpDir = mkdtempSync(join(tmpdir(), "kadai-no-dir-"));
    try {
      const session = spawnCLI({
        cwd: tmpDir,
        args: ["list", "--json"],
      });
      const { exitCode, stderr } = await session.waitForExit();
      expect(exitCode).toBe(1);
      expect(stderr).toContain(".kadai");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ─── run <action-id> ─────────────────────────────────────────────

describe("kadai run <action-id>", () => {
  test("runs hello and outputs greeting", async () => {
    const session = spawnCLI({
      cwd: fixturePath("basic-repo"),
      args: ["run", "hello"],
    });
    const { exitCode, output } = await session.waitForExit();
    expect(exitCode).toBe(0);
    expect(output).toContain("Hello from kadai!");
  });

  test("runs nested action (database/migrate)", async () => {
    const session = spawnCLI({
      cwd: fixturePath("basic-repo"),
      args: ["run", "database/migrate"],
    });
    const { exitCode, output } = await session.waitForExit();
    expect(exitCode).toBe(0);
    expect(output).toContain("Migration complete.");
  });

  test("exits 1 for nonexistent action", async () => {
    const session = spawnCLI({
      cwd: fixturePath("basic-repo"),
      args: ["run", "nonexistent"],
    });
    const { exitCode, stderr } = await session.waitForExit();
    expect(exitCode).toBe(1);
    expect(stderr).toContain("nonexistent");
  });

  test("exits 1 with error when no .kadai dir", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "kadai-no-dir-"));
    try {
      const session = spawnCLI({
        cwd: tmpDir,
        args: ["run", "hello"],
      });
      const { exitCode, stderr } = await session.waitForExit();
      expect(exitCode).toBe(1);
      expect(stderr).toContain(".kadai");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("skips confirmation in non-TTY", async () => {
    const session = spawnCLI({
      cwd: fixturePath("basic-repo"),
      args: ["run", "database/reset"],
    });
    const { exitCode, output } = await session.waitForExit();
    expect(exitCode).toBe(0);
    expect(output).toContain("Database reset complete.");
  });

  test("saves last action to .kadai/.last-action", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "kadai-rerun-"));
    const kadaiDir = join(tmpDir, ".kadai");
    const actionsDir = join(kadaiDir, "actions");
    mkdirSync(actionsDir, { recursive: true });
    writeFileSync(join(actionsDir, "hello.sh"), "#!/usr/bin/env bash\necho 'Hello from kadai!'");
    writeFileSync(join(kadaiDir, "config.ts"), "export default {}");

    try {
      const session = spawnCLI({ cwd: tmpDir, args: ["run", "hello"] });
      const { exitCode } = await session.waitForExit();
      expect(exitCode).toBe(0);

      const lastAction = readFileSync(join(kadaiDir, ".last-action"), "utf8").trim();
      expect(lastAction).toBe("hello");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ─── --rerun / -r ─────────────────────────────────────────────────

describe("kadai --rerun", () => {
  test("reruns the last action", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "kadai-rerun-"));
    const kadaiDir = join(tmpDir, ".kadai");
    const actionsDir = join(kadaiDir, "actions");
    mkdirSync(actionsDir, { recursive: true });
    writeFileSync(join(actionsDir, "hello.sh"), "#!/usr/bin/env bash\necho 'Hello from kadai!'");
    writeFileSync(join(kadaiDir, "config.ts"), "export default {}");
    writeFileSync(join(kadaiDir, ".last-action"), "hello");

    try {
      const session = spawnCLI({ cwd: tmpDir, args: ["--rerun"] });
      const { exitCode, output } = await session.waitForExit();
      expect(exitCode).toBe(0);
      expect(output).toContain("Hello from kadai!");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("-r reruns the last action", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "kadai-rerun-"));
    const kadaiDir = join(tmpDir, ".kadai");
    const actionsDir = join(kadaiDir, "actions");
    mkdirSync(actionsDir, { recursive: true });
    writeFileSync(join(actionsDir, "hello.sh"), "#!/usr/bin/env bash\necho 'Hello from kadai!'");
    writeFileSync(join(kadaiDir, "config.ts"), "export default {}");
    writeFileSync(join(kadaiDir, ".last-action"), "hello");

    try {
      const session = spawnCLI({ cwd: tmpDir, args: ["-r"] });
      const { exitCode, output } = await session.waitForExit();
      expect(exitCode).toBe(0);
      expect(output).toContain("Hello from kadai!");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("exits 1 with helpful message when no last action saved", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "kadai-rerun-"));
    const kadaiDir = join(tmpDir, ".kadai");
    mkdirSync(join(kadaiDir, "actions"), { recursive: true });
    writeFileSync(join(kadaiDir, "config.ts"), "export default {}");

    try {
      const session = spawnCLI({ cwd: tmpDir, args: ["--rerun"] });
      const { exitCode, stderr } = await session.waitForExit();
      expect(exitCode).toBe(1);
      expect(stderr).toContain("No last action");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("exits 1 with error when no .kadai dir", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "kadai-no-dir-"));
    try {
      const session = spawnCLI({ cwd: tmpDir, args: ["--rerun"] });
      const { exitCode, stderr } = await session.waitForExit();
      expect(exitCode).toBe(1);
      expect(stderr).toContain(".kadai");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ─── kadai install ────────────────────────────────────────────────

describe("kadai install", () => {
  // fakeHome is a fresh temp dir — it will never be in the real PATH,
  // so we rely on the real PATH (which has bun) rather than overriding it.

  test("exits 0 and prints install path", async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "kadai-install-home-"));
    try {
      const session = spawnCLI({
        cwd: fakeHome,
        args: ["install"],
        env: { HOME: fakeHome },
      });
      const { exitCode, output } = await session.waitForExit();
      expect(exitCode).toBe(0);
      expect(output).toContain("Installed kadai to");
      expect(output).toContain(".local/bin/kadai");
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
    }
  });

  test("creates binary at ~/.local/bin/kadai", async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "kadai-install-home-"));
    try {
      const session = spawnCLI({
        cwd: fakeHome,
        args: ["install"],
        env: { HOME: fakeHome },
      });
      await session.waitForExit();
      // harness forces HOME=TEST_HOME so homedir() returns TEST_HOME
      expect(existsSync(join(TEST_HOME, ".local", "bin", "kadai"))).toBe(true);
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
    }
  });

  test("warns when ~/.local/bin not in PATH", async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "kadai-install-home-"));
    try {
      const session = spawnCLI({
        cwd: fakeHome,
        args: ["install"],
        env: { HOME: fakeHome, SHELL: "/bin/zsh" },
      });
      const { output } = await session.waitForExit();
      expect(output).toContain("~/.local/bin is not in your PATH");
      expect(output).toContain("export PATH");
      expect(output).toContain("~/.zshrc");
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
    }
  });

  test("no PATH warning when ~/.local/bin already in PATH", async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "kadai-install-home-"));
    try {
      // harness forces HOME=TEST_HOME, so use TEST_HOME for the PATH entry
      const localBin = join(TEST_HOME, ".local", "bin");
      const session = spawnCLI({
        cwd: fakeHome,
        args: ["install"],
        env: { PATH: `${process.env.PATH}:${localBin}` },
      });
      const { output } = await session.waitForExit();
      expect(output).not.toContain("not in your PATH");
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
    }
  });

  test("fish shell gets fish_add_path instruction", async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "kadai-install-home-"));
    try {
      const session = spawnCLI({
        cwd: fakeHome,
        args: ["install"],
        env: { HOME: fakeHome, SHELL: "/usr/local/bin/fish" },
      });
      const { output } = await session.waitForExit();
      expect(output).toContain("fish_add_path");
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
    }
  });
});
