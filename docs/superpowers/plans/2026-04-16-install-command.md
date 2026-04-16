# Install Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `bunx kadai install` which compiles a self-contained binary to `~/.local/bin/kadai` and warns if that directory is not in PATH.

**Architecture:** Follows the existing `parseArgs → cli.tsx dispatch → commands.ts handler` pattern. Three small, focused changes: extend the arg union type, add a case to the switch, add a handler function.

**Tech Stack:** Bun (spawn, build --compile, homedir via os module), TypeScript, bun:test

---

## File Map

| File | Change |
|------|--------|
| `src/core/args.ts` | Add `{ type: "install" }` to `ParsedArgs`; add `case "install"` to `parseArgs` switch |
| `src/core/commands.ts` | Add `handleInstall()` |
| `src/cli.tsx` | Add dispatch branch for `parsed.type === "install"` before TUI section |
| `test/args.test.ts` | Add `install → install` test case |
| `test/commands.test.ts` | Add integration tests for `kadai install` |

---

## Task 1: Extend arg parsing

**Files:**
- Modify: `src/core/args.ts`
- Test: `test/args.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `test/args.test.ts` inside the existing `describe("parseArgs", ...)` block:

```typescript
test("install → install", () => {
  expect(parseArgs(["install"])).toEqual({ type: "install" });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test test/args.test.ts
```

Expected: FAIL — `install` is not a recognised command so it falls through to `{ type: "run", actionId: "install" }` instead of `{ type: "install" }`.

- [ ] **Step 3: Add `install` to `ParsedArgs` and `parseArgs`**

In `src/core/args.ts`, add `| { type: "install" }` to the `ParsedArgs` union:

```typescript
export type ParsedArgs =
  | { type: "interactive" }
  | { type: "version" }
  | { type: "rerun" }
  | { type: "list"; all: boolean }
  | { type: "run"; actionId: string }
  | { type: "mcp" }
  | { type: "sync" }
  | { type: "install" }
  | { type: "error"; message: string };
```

Add `case "install":` to the switch in `parseArgs`, before `default:`:

```typescript
case "install":
  return { type: "install" };
```

Also update the unknown-flag error message to include `install`:

```typescript
message: `Unknown flag: ${command}. Available commands: list, run, sync, mcp, install, --version, --rerun`,
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test test/args.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/args.ts test/args.test.ts
git commit -m "feat: add install to arg parsing"
```

---

## Task 2: Implement `handleInstall`

**Files:**
- Modify: `src/core/commands.ts`
- Test: `test/commands.test.ts`

- [ ] **Step 1: Write the failing integration tests**

First, add `existsSync` to the existing `node:fs` import at the top of `test/commands.test.ts`:

```typescript
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
```

Then add a new `describe` block at the bottom of `test/commands.test.ts`:

```typescript
describe("kadai install", () => {
  test("exits 0 and prints install path", async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "kadai-install-home-"));
    try {
      const session = spawnCLI({
        cwd: fakeHome,
        args: ["install"],
        env: { HOME: fakeHome, PATH: "/usr/bin:/bin" },
      });
      const { exitCode, output } = await session.waitForExit(60000);
      expect(exitCode).toBe(0);
      expect(output).toContain("Installed kadai to");
      expect(output).toContain(".local/bin/kadai");
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
    }
  }, 60000);

  test("creates binary at ~/.local/bin/kadai", async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "kadai-install-home-"));
    try {
      const session = spawnCLI({
        cwd: fakeHome,
        args: ["install"],
        env: { HOME: fakeHome, PATH: "/usr/bin:/bin" },
      });
      await session.waitForExit(60000);
      expect(existsSync(join(fakeHome, ".local", "bin", "kadai"))).toBe(true);
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
    }
  }, 60000);

  test("warns when ~/.local/bin not in PATH", async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "kadai-install-home-"));
    try {
      const session = spawnCLI({
        cwd: fakeHome,
        args: ["install"],
        env: { HOME: fakeHome, PATH: "/usr/bin:/bin", SHELL: "/bin/zsh" },
      });
      const { output } = await session.waitForExit(60000);
      expect(output).toContain("~/.local/bin is not in your PATH");
      expect(output).toContain("export PATH");
      expect(output).toContain("~/.zshrc");
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
    }
  }, 60000);

  test("no PATH warning when ~/.local/bin already in PATH", async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "kadai-install-home-"));
    try {
      const localBin = join(fakeHome, ".local", "bin");
      const session = spawnCLI({
        cwd: fakeHome,
        args: ["install"],
        env: { HOME: fakeHome, PATH: `/usr/bin:${localBin}` },
      });
      const { output } = await session.waitForExit(60000);
      expect(output).not.toContain("not in your PATH");
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
    }
  }, 60000);

  test("fish shell gets fish_add_path instruction", async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "kadai-install-home-"));
    try {
      const session = spawnCLI({
        cwd: fakeHome,
        args: ["install"],
        env: { HOME: fakeHome, PATH: "/usr/bin:/bin", SHELL: "/usr/local/bin/fish" },
      });
      const { output } = await session.waitForExit(60000);
      expect(output).toContain("fish_add_path");
    } finally {
      rmSync(fakeHome, { recursive: true, force: true });
    }
  }, 60000);
});
```

Note: the imports at the top of `test/commands.test.ts` already import `mkdtempSync`, `rmSync`, `mkdirSync`, `tmpdir`, `join` — add `existsSync` to the `node:fs` import line.

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test test/commands.test.ts --test-name-pattern "kadai install"
```

Expected: FAIL — `install` arg currently falls through to `run` which errors.

- [ ] **Step 3: Implement `handleInstall` in `commands.ts`**

At the top of `src/core/commands.ts`, add two imports alongside the existing ones:

```typescript
import { homedir } from "node:os";
import { mkdirSync } from "node:fs";
```

Then add the function at the bottom of the file:

```typescript
export async function handleInstall(): Promise<never> {
  const entryPoint = Bun.main;
  if (!entryPoint) {
    process.stderr.write("Error: Cannot determine entry point for compilation.\n");
    process.exit(1);
  }

  const installDir = join(homedir(), ".local", "bin");
  const outputPath = join(installDir, "kadai");

  try {
    mkdirSync(installDir, { recursive: true });
  } catch (err) {
    process.stderr.write(`Error: Cannot create ${installDir}: ${(err as Error).message}\n`);
    process.exit(1);
  }

  const buildProc = Bun.spawn(
    ["bun", "build", "--compile", entryPoint, "--outfile", outputPath],
    { stdout: "inherit", stderr: "inherit" },
  );
  const buildExit = await buildProc.exited;
  if (buildExit !== 0) {
    process.stderr.write(`Error: bun build --compile failed (exit ${buildExit})\n`);
    process.exit(1);
  }

  process.stdout.write(`Installed kadai to ${outputPath}\n`);

  const pathDirs = (process.env.PATH ?? "").split(":");
  const inPath = pathDirs.some((d) => d.replace(/^~/, homedir()) === installDir);

  if (!inPath) {
    const shell = (process.env.SHELL ?? "").split("/").pop() ?? "";
    process.stdout.write("\n~/.local/bin is not in your PATH.\n");
    if (shell === "fish") {
      process.stdout.write("Add it with:\n\n  fish_add_path ~/.local/bin\n");
    } else {
      const rcFile =
        shell === "zsh" ? "~/.zshrc" :
        shell === "bash" ? "~/.bashrc" :
        "your shell rc file";
      process.stdout.write(
        `Add this to ${rcFile} and restart your shell:\n\n  export PATH="$HOME/.local/bin:$PATH"\n`,
      );
    }
  }

  process.exit(0);
}
```

Also add `mkdirSync` to the existing `node:fs` import at the top of `commands.ts` if it's there, otherwise add the new import. Add `homedir` import from `node:os`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test test/commands.test.ts --test-name-pattern "kadai install"
```

Expected: all 5 tests PASS (these are slow — allow up to 5 minutes total).

- [ ] **Step 5: Commit**

```bash
git add src/core/commands.ts test/commands.test.ts
git commit -m "feat: implement handleInstall"
```

---

## Task 3: Wire up dispatch in `cli.tsx`

**Files:**
- Modify: `src/cli.tsx`

- [ ] **Step 1: Add dispatch branch**

In `src/cli.tsx`, find the block that handles `parsed.type === "list" || ...`. Add a new `if` branch **before** it (install does not need a `kadaiDir`):

```typescript
if (parsed.type === "install") {
  const { handleInstall } = await import("./core/commands.ts");
  await handleInstall();
}
```

Place this immediately after the `parsed.type === "version"` block and before the `parsed.type === "mcp"` block.

- [ ] **Step 2: Run the full test suite**

```bash
bun test
```

Expected: all tests PASS (the install tests run as part of `commands.test.ts`).

- [ ] **Step 3: Smoke-test manually**

```bash
bunx --bun . install
```

Expected:
- Binary written to `~/.local/bin/kadai` (or PATH warning if dir is missing from PATH)
- Exit 0
- Running `~/.local/bin/kadai` launches the interactive TUI

- [ ] **Step 4: Commit**

```bash
git add src/cli.tsx
git commit -m "feat: wire up kadai install command"
```
