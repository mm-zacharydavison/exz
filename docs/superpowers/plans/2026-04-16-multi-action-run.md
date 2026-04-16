# Multi-Action Run Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to run multiple kadai actions sequentially (`kadai run a b c`) or in parallel with a tab UI (`kadai run a + b + c`), and compose these from the TUI via right-arrow/`l` (queue) or space (parallel-select).

**Architecture:** CLI args parser extended to produce `run-sequential` / `run-parallel` parsed types; two new command handlers (`handleRunSequential`, `handleRunParallel`) follow the same load-then-execute pattern as existing `handleRun`; the parallel handler spawns all processes with piped stdio and renders a new `ParallelOutput` Ink component that polls output every 100 ms using a timer-driven re-render; the TUI adds `runMode` state (via the existing `useRefState` hook) with a preview bar and new keyboard bindings, exiting with the action list to the same CLI routing.

**Tech Stack:** Bun, TypeScript, React, Ink, bun:test, `useRefState` (existing hook)

---

## File Map

| File | Change |
|------|--------|
| `src/core/args.ts` | Add `run-sequential` and `run-parallel` to `ParsedArgs`; update `parseArgs` |
| `src/types.ts` | Add `ParallelRunner` and `RunMode` types |
| `src/core/commands.ts` | Extract `loadAllActions` helper; add `handleRunSequential`, `handleRunParallel` |
| `src/components/ParallelOutput.tsx` | New Ink component — tab bar + output area for parallel runs |
| `src/cli.tsx` | Route `run-sequential` / `run-parallel`; wire `onRunMultiAction` from TUI |
| `src/app.tsx` | Add `runMode` via `useRefState`, `onRunMultiAction` prop, preview bar |
| `src/hooks/useKeyboard.ts` | Handle `→`/`l` (queue), `←`/`h` (dequeue), space (parallel toggle), Escape (clear mode) |
| `test/args.test.ts` | Add tests for new parsed types |
| `test/commands.test.ts` | Add integration tests for sequential and parallel handlers |
| `test/navigation.test.ts` | Add TUI composition key tests |

---

## Task 1: CLI Args Parsing

**Files:**
- Modify: `src/core/args.ts`
- Test: `test/args.test.ts`

- [ ] **Step 1: Write failing tests**

Add to the bottom of `test/args.test.ts`:

```ts
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

  test("single ID still → run (unchanged)", () => {
    expect(parseArgs(["run", "hello"])).toEqual({
      type: "run",
      actionId: "hello",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test test/args.test.ts
```

Expected: 5 new tests FAIL, existing tests pass.

- [ ] **Step 3: Implement multi-run parsing in `src/core/args.ts`**

Replace the entire file:

```ts
export type ParsedArgs =
  | { type: "interactive" }
  | { type: "version" }
  | { type: "rerun" }
  | { type: "list"; all: boolean }
  | { type: "run"; actionId: string }
  | { type: "run-sequential"; actionIds: string[] }
  | { type: "run-parallel"; actionIds: string[] }
  | { type: "mcp" }
  | { type: "sync" }
  | { type: "error"; message: string };

export function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0) {
    return { type: "interactive" };
  }

  const command = argv[0];

  if (command === "--version" || command === "-v") {
    return { type: "version" };
  }

  if (command === "--rerun" || command === "-r") {
    return { type: "rerun" };
  }

  switch (command) {
    case "list": {
      if (!argv.includes("--json")) {
        return { type: "error", message: "Usage: kadai list --json [--all]" };
      }
      const all = argv.includes("--all");
      return { type: "list", all };
    }

    case "run": {
      const rest = argv.slice(1);
      if (rest.length === 0 || (rest[0] as string).startsWith("-")) {
        return { type: "error", message: "Usage: kadai run <action ID>" };
      }

      if (rest.length === 1) {
        return { type: "run", actionId: rest[0] as string };
      }

      const hasPlus = rest.includes("+");

      if (!hasPlus) {
        return { type: "run-sequential", actionIds: rest };
      }

      // Parallel: must be id + id + id (alternating, odd-length)
      const mixError: ParsedArgs = {
        type: "error",
        message:
          'Error: cannot mix sequential and parallel — use either spaces or "+" between action IDs',
      };

      if (rest.length % 2 === 0) return mixError;

      const ids: string[] = [];
      for (let i = 0; i < rest.length; i++) {
        if (i % 2 === 0) {
          if (rest[i] === "+") return mixError;
          ids.push(rest[i] as string);
        } else {
          if (rest[i] !== "+") return mixError;
        }
      }

      return { type: "run-parallel", actionIds: ids };
    }

    case "mcp":
      return { type: "mcp" };

    case "sync":
      return { type: "sync" };

    default:
      return {
        type: "error",
        message: `Unknown command: ${command}. Available commands: list, run, sync, mcp, --version, --rerun`,
      };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test test/args.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/args.ts test/args.test.ts
git commit -m "feat: parse run-sequential and run-parallel CLI args"
```

---

## Task 2: `loadAllActions` helper + `handleRunSequential`

**Files:**
- Modify: `src/core/commands.ts`
- Test: `test/commands.test.ts`

- [ ] **Step 1: Write failing integration tests**

Add to the bottom of `test/commands.test.ts`:

```ts
// ─── run-sequential ──────────────────────────────────────────────

describe("kadai run (sequential)", () => {
  test("runs two actions in order", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "kadai-seq-"));
    const kadaiDir = join(tmpDir, ".kadai");
    const actionsDir = join(kadaiDir, "actions");
    mkdirSync(actionsDir, { recursive: true });
    writeFileSync(
      join(actionsDir, "first.sh"),
      "#!/usr/bin/env bash\necho 'first output'",
    );
    writeFileSync(
      join(actionsDir, "second.sh"),
      "#!/usr/bin/env bash\necho 'second output'",
    );
    writeFileSync(join(kadaiDir, "config.ts"), "export default {}");

    try {
      const session = spawnCLI({
        cwd: tmpDir,
        args: ["run", "first", "second"],
      });
      const { exitCode, output } = await session.waitForExit();
      expect(exitCode).toBe(0);
      const firstPos = output.indexOf("first output");
      const secondPos = output.indexOf("second output");
      expect(firstPos).toBeGreaterThanOrEqual(0);
      expect(secondPos).toBeGreaterThan(firstPos);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("short-circuits on failure — third action does not run", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "kadai-seq-fail-"));
    const kadaiDir = join(tmpDir, ".kadai");
    const actionsDir = join(kadaiDir, "actions");
    mkdirSync(actionsDir, { recursive: true });
    writeFileSync(
      join(actionsDir, "first.sh"),
      "#!/usr/bin/env bash\necho 'first output'",
    );
    writeFileSync(
      join(actionsDir, "fail.sh"),
      "#!/usr/bin/env bash\necho 'fail output'\nexit 42",
    );
    writeFileSync(
      join(actionsDir, "third.sh"),
      "#!/usr/bin/env bash\necho 'third output'",
    );
    writeFileSync(join(kadaiDir, "config.ts"), "export default {}");

    try {
      const session = spawnCLI({
        cwd: tmpDir,
        args: ["run", "first", "fail", "third"],
      });
      const { exitCode, output } = await session.waitForExit();
      expect(exitCode).toBe(42);
      expect(output).toContain("first output");
      expect(output).toContain("fail output");
      expect(output).not.toContain("third output");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("exits 1 if any action ID does not exist", async () => {
    const session = spawnCLI({
      cwd: fixturePath("basic-repo"),
      args: ["run", "hello", "nonexistent"],
    });
    const { exitCode, stderr } = await session.waitForExit();
    expect(exitCode).toBe(1);
    expect(stderr).toContain("nonexistent");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test test/commands.test.ts 2>&1 | tail -20
```

Expected: 3 new tests FAIL.

- [ ] **Step 3: Add `loadAllActions` helper and `handleRunSequential` to `src/core/commands.ts`**

Add this private helper after the imports and before `handleList`:

```ts
async function loadAllActions(kadaiDir: string) {
  const config = await loadConfig(kadaiDir);
  const actionsDir = join(kadaiDir, config.actionsDir ?? "actions");
  let actions = await loadActions(actionsDir);
  const globalActions = await loadUserGlobalActions();
  actions = [...actions, ...globalActions];
  if (config.plugins) {
    for (const source of config.plugins) {
      if ("path" in source) {
        const pathActions = await loadPathPlugin(kadaiDir, source);
        actions = [...actions, ...pathActions];
      }
    }
    const cachedActions = await loadCachedPlugins(kadaiDir, config.plugins);
    actions = [...actions, ...cachedActions];
  }
  return { actions, config };
}
```

Add this interface and function after `handleRun`:

```ts
interface RunMultiOptions {
  kadaiDir: string;
  actionIds: string[];
  cwd: string;
}

export async function handleRunSequential(
  options: RunMultiOptions,
): Promise<never> {
  const { kadaiDir, actionIds, cwd } = options;
  const { actions, config } = await loadAllActions(kadaiDir);

  for (const id of actionIds) {
    if (!actions.find((a) => a.id === id)) {
      process.stderr.write(`Error: action "${id}" not found\n`);
      process.exit(1);
    }
  }

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    ...(config.env ?? {}),
  };

  // Detach from parent's stdin so each child gets direct terminal access
  process.stdin.removeAllListeners();
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdin.pause();
  process.stdin.unref();

  for (const id of actionIds) {
    const action = actions.find((a) => a.id === id)!;

    process.stdout.write(
      `\n${action.meta.emoji ? `${action.meta.emoji} ` : ""}${action.meta.name}\n\n`,
    );

    if (action.runtime === "ink") {
      const cleanupKadai = ensureKadaiResolvable(join(cwd, "node_modules"));
      const mod = await import(action.filePath);
      if (typeof mod.default !== "function") {
        process.stderr.write(
          `Error: "${action.filePath}" does not export a default function component\n`,
        );
        process.exit(1);
      }
      const React = await import("react");
      const { render } = await import("ink");
      const instance = render(
        React.createElement(mod.default, {
          cwd,
          env: config.env ?? {},
          args: [],
          onExit: () => instance.unmount(),
        }),
      );
      await instance.waitUntilExit();
      cleanupKadai?.();
      continue;
    }

    const cmd = resolveCommand(action);
    const proc = Bun.spawn(cmd, {
      cwd,
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
      env,
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) process.exit(exitCode);
  }

  process.exit(0);
}
```

- [ ] **Step 4: Wire `run-sequential` into `src/cli.tsx`**

Find:

```ts
if (parsed.type === "list" || parsed.type === "run" || parsed.type === "sync" || parsed.type === "rerun") {
```

Replace with:

```ts
if (
  parsed.type === "list" ||
  parsed.type === "run" ||
  parsed.type === "run-sequential" ||
  parsed.type === "sync" ||
  parsed.type === "rerun"
) {
```

Find the dispatch block:

```ts
  if (parsed.type === "list") {
    await handleList({ kadaiDir, all: parsed.all });
  } else if (parsed.type === "run") {
    await handleRun({ kadaiDir, actionId: parsed.actionId, cwd });
  } else if (parsed.type === "rerun") {
    await handleRerun({ kadaiDir, cwd });
  } else {
    const { handleSync } = await import("./core/commands.ts");
    await handleSync({ kadaiDir });
  }
```

Replace with:

```ts
  if (parsed.type === "list") {
    await handleList({ kadaiDir, all: parsed.all });
  } else if (parsed.type === "run") {
    await handleRun({ kadaiDir, actionId: parsed.actionId, cwd });
  } else if (parsed.type === "run-sequential") {
    const { handleRunSequential } = await import("./core/commands.ts");
    await handleRunSequential({ kadaiDir, actionIds: parsed.actionIds, cwd });
  } else if (parsed.type === "rerun") {
    await handleRerun({ kadaiDir, cwd });
  } else {
    const { handleSync } = await import("./core/commands.ts");
    await handleSync({ kadaiDir });
  }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
bun test test/commands.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/commands.ts src/cli.tsx test/commands.test.ts
git commit -m "feat: add handleRunSequential with short-circuit on failure"
```

---

## Task 3: New Types (`ParallelRunner`, `RunMode`)

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add types to `src/types.ts`**

Append to the end of `src/types.ts`:

```ts
/** State of one process in a parallel run — `lines` is mutated in place as output streams in */
export interface ParallelRunner {
  action: Action;
  lines: string[];
  status: "running" | "done" | "failed";
}

/** Multi-run composition mode tracked in the TUI */
export type RunMode =
  | { type: "normal" }
  | { type: "sequential"; queue: Action[] }
  | { type: "parallel"; selected: Set<string> };
```

- [ ] **Step 2: Run type-check**

```bash
bun run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add ParallelRunner and RunMode types"
```

---

## Task 4: `ParallelOutput` Ink Component

**Files:**
- Create: `src/components/ParallelOutput.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/ParallelOutput.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ParallelRunner } from "../types.ts";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

interface ParallelOutputProps {
  runners: ParallelRunner[];
}

export function ParallelOutput({ runners }: ParallelOutputProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [, setTick] = useState(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % SPINNER_FRAMES.length;
      setTick((t) => t + 1);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useInput((input, key) => {
    if (key.rightArrow || input === "l") {
      setActiveTab((t) => Math.min(t + 1, runners.length - 1));
    }
    if (key.leftArrow || input === "h") {
      setActiveTab((t) => Math.max(t - 1, 0));
    }
  });

  const active = runners[activeTab];
  if (!active) return null;

  return (
    <Box flexDirection="column">
      <Box gap={2} marginBottom={1}>
        {runners.map((runner, i) => {
          const isActive = i === activeTab;
          const spinner = SPINNER_FRAMES[frameRef.current] as string;
          const statusIcon =
            runner.status === "running"
              ? spinner
              : runner.status === "done"
                ? "✓"
                : "✗";
          const color =
            isActive
              ? "cyan"
              : runner.status === "done"
                ? "green"
                : runner.status === "failed"
                  ? "red"
                  : undefined;
          return (
            <Text key={runner.action.id} color={color} bold={isActive} underline={isActive}>
              {statusIcon}{" "}
              {runner.action.meta.emoji ? `${runner.action.meta.emoji} ` : ""}
              {runner.action.meta.name}
            </Text>
          );
        })}
      </Box>
      <Box flexDirection="column">
        {active.lines.slice(-40).map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
        {active.status === "running" && active.lines.length === 0 && (
          <Text dimColor>waiting for output...</Text>
        )}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Run type-check**

```bash
bun run check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ParallelOutput.tsx
git commit -m "feat: add ParallelOutput Ink component for parallel run tab UI"
```

---

## Task 5: `handleRunParallel` + Wire Parallel into CLI

**Files:**
- Modify: `src/core/commands.ts`
- Modify: `src/cli.tsx`
- Test: `test/commands.test.ts`

- [ ] **Step 1: Write failing integration tests**

Add to the bottom of `test/commands.test.ts`:

```ts
// ─── run-parallel ────────────────────────────────────────────────

describe("kadai run (parallel)", () => {
  test("runs two actions concurrently and both outputs appear", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "kadai-par-"));
    const kadaiDir = join(tmpDir, ".kadai");
    const actionsDir = join(kadaiDir, "actions");
    mkdirSync(actionsDir, { recursive: true });
    writeFileSync(
      join(actionsDir, "alpha.sh"),
      "#!/usr/bin/env bash\necho 'alpha output'",
    );
    writeFileSync(
      join(actionsDir, "beta.sh"),
      "#!/usr/bin/env bash\necho 'beta output'",
    );
    writeFileSync(join(kadaiDir, "config.ts"), "export default {}");

    try {
      const session = spawnCLI({
        cwd: tmpDir,
        args: ["run", "alpha", "+", "beta"],
      });
      const { exitCode, output } = await session.waitForExit(15000);
      expect(exitCode).toBe(0);
      expect(output).toContain("alpha");
      expect(output).toContain("beta");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("exits 1 if any action fails, waits for all to finish", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "kadai-par-fail-"));
    const kadaiDir = join(tmpDir, ".kadai");
    const actionsDir = join(kadaiDir, "actions");
    mkdirSync(actionsDir, { recursive: true });
    writeFileSync(
      join(actionsDir, "ok.sh"),
      "#!/usr/bin/env bash\necho 'ok output'",
    );
    writeFileSync(
      join(actionsDir, "bad.sh"),
      "#!/usr/bin/env bash\necho 'bad output'\nexit 1",
    );
    writeFileSync(join(kadaiDir, "config.ts"), "export default {}");

    try {
      const session = spawnCLI({
        cwd: tmpDir,
        args: ["run", "ok", "+", "bad"],
      });
      const { exitCode, output } = await session.waitForExit(15000);
      expect(exitCode).toBe(1);
      expect(output).toContain("ok");
      expect(output).toContain("bad");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("exits 1 with error when an ink action is in the parallel list", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "kadai-par-ink-"));
    const kadaiDir = join(tmpDir, ".kadai");
    const actionsDir = join(kadaiDir, "actions");
    mkdirSync(actionsDir, { recursive: true });
    writeFileSync(
      join(actionsDir, "normal.sh"),
      "#!/usr/bin/env bash\necho 'hi'",
    );
    writeFileSync(
      join(actionsDir, "myink.tsx"),
      "export default function() { return null; }",
    );
    writeFileSync(join(kadaiDir, "config.ts"), "export default {}");

    try {
      const session = spawnCLI({
        cwd: tmpDir,
        args: ["run", "normal", "+", "myink"],
      });
      const { exitCode, stderr } = await session.waitForExit(10000);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("ink");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("exits 1 if any action ID does not exist", async () => {
    const session = spawnCLI({
      cwd: fixturePath("basic-repo"),
      args: ["run", "hello", "+", "nonexistent"],
    });
    const { exitCode, stderr } = await session.waitForExit();
    expect(exitCode).toBe(1);
    expect(stderr).toContain("nonexistent");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test test/commands.test.ts 2>&1 | tail -20
```

Expected: 4 new tests FAIL.

- [ ] **Step 3: Add `handleRunParallel` to `src/core/commands.ts`**

Add this import to the top of `src/core/commands.ts` alongside the existing imports:

```ts
import type { ParallelRunner } from "../types.ts";
```

Add `handleRunParallel` after `handleRunSequential`:

```ts
export async function handleRunParallel(
  options: RunMultiOptions,
): Promise<never> {
  const { kadaiDir, actionIds, cwd } = options;
  const { actions, config } = await loadAllActions(kadaiDir);

  for (const id of actionIds) {
    if (!actions.find((a) => a.id === id)) {
      process.stderr.write(`Error: action "${id}" not found\n`);
      process.exit(1);
    }
  }

  const selected = actionIds.map((id) => actions.find((a) => a.id === id)!);

  for (const action of selected) {
    if (action.runtime === "ink") {
      process.stderr.write(
        `Error: ink action "${action.id}" cannot be run in parallel mode\n`,
      );
      process.exit(1);
    }
  }

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    ...(config.env ?? {}),
  };

  const runners: ParallelRunner[] = selected.map((action) => ({
    action,
    lines: [],
    status: "running",
  }));

  const procs = selected.map((action, i) => {
    const cmd = resolveCommand(action);
    const proc = Bun.spawn(cmd, {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      stdin: null,
      env,
    });

    const collectStream = async (stream: ReadableStream<Uint8Array>) => {
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";
          runners[i]!.lines.push(...parts);
        }
      } catch {
        // stream closed
      }
      if (buffer) runners[i]!.lines.push(buffer);
    };

    collectStream(proc.stdout);
    collectStream(proc.stderr);

    return proc;
  });

  const React = await import("react");
  const { render } = await import("ink");
  const { ParallelOutput } = await import(
    "../components/ParallelOutput.tsx"
  );

  const instance = render(React.createElement(ParallelOutput, { runners }));

  const exitCodes = await Promise.all(procs.map((p) => p.exited));

  exitCodes.forEach((code, i) => {
    runners[i]!.status = code === 0 ? "done" : "failed";
  });

  // Allow one final render cycle to show completed statuses before unmounting
  await Bun.sleep(200);
  instance.unmount();

  const anyFailed = exitCodes.some((c) => c !== 0);
  process.exit(anyFailed ? 1 : 0);
}
```

- [ ] **Step 4: Wire `run-parallel` into `src/cli.tsx`**

Find:

```ts
if (
  parsed.type === "list" ||
  parsed.type === "run" ||
  parsed.type === "run-sequential" ||
  parsed.type === "sync" ||
  parsed.type === "rerun"
) {
```

Replace with:

```ts
if (
  parsed.type === "list" ||
  parsed.type === "run" ||
  parsed.type === "run-sequential" ||
  parsed.type === "run-parallel" ||
  parsed.type === "sync" ||
  parsed.type === "rerun"
) {
```

Find in the dispatch block:

```ts
  } else if (parsed.type === "run-sequential") {
    const { handleRunSequential } = await import("./core/commands.ts");
    await handleRunSequential({ kadaiDir, actionIds: parsed.actionIds, cwd });
  } else if (parsed.type === "rerun") {
```

Replace with:

```ts
  } else if (parsed.type === "run-sequential") {
    const { handleRunSequential } = await import("./core/commands.ts");
    await handleRunSequential({ kadaiDir, actionIds: parsed.actionIds, cwd });
  } else if (parsed.type === "run-parallel") {
    const { handleRunParallel } = await import("./core/commands.ts");
    await handleRunParallel({ kadaiDir, actionIds: parsed.actionIds, cwd });
  } else if (parsed.type === "rerun") {
```

- [ ] **Step 5: Run tests**

```bash
bun test test/commands.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Run full test suite**

```bash
bun test
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/commands.ts src/cli.tsx test/commands.test.ts
git commit -m "feat: add handleRunParallel and wire both multi-run modes into CLI"
```

---

## Task 6: TUI Multi-Run State, Keyboard Bindings, Preview Bar

**Files:**
- Modify: `src/hooks/useKeyboard.ts`
- Modify: `src/app.tsx`
- Modify: `src/cli.tsx`
- Test: `test/navigation.test.ts`

- [ ] **Step 1: Write failing TUI tests**

Add to the bottom of `test/navigation.test.ts`:

```ts
describe("multi-run composition", () => {
  test("right arrow queues an action and shows preview bar", async () => {
    cli = spawnCLI({ cwd: fixturePath("basic-repo") });
    await cli.waitForText("Hello World");
    cli.press(Keys.RIGHT);
    await cli.waitForText("kadai run");
  });

  test("escape clears the queue and hides preview bar", async () => {
    cli = spawnCLI({ cwd: fixturePath("basic-repo") });
    await cli.waitForText("Hello World");
    cli.press(Keys.RIGHT);
    await cli.waitForText("kadai run");
    cli.press(Keys.ESCAPE);
    await Bun.sleep(300);
    // Preview bar shows "kadai run <id>" — after escape only bare "kadai" remains in breadcrumb
    // The multi-action preview line must be gone
    const out = cli.getStrippedOutput();
    const lines = out.split("\n");
    const hasPreview = lines.some((l) => /kadai run \S/.test(l));
    expect(hasPreview).toBe(false);
  });

  test("space selects for parallel and shows + separator in preview", async () => {
    cli = spawnCLI({ cwd: fixturePath("basic-repo") });
    await cli.waitForText("Hello World");
    cli.press(" ");
    await cli.waitForText("kadai run");
    cli.press(Keys.DOWN);
    cli.press(" ");
    await cli.waitForText("+");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test test/navigation.test.ts 2>&1 | tail -20
```

Expected: 3 new tests FAIL.

- [ ] **Step 3: Replace `src/hooks/useKeyboard.ts`**

Replace the entire file:

```ts
import { useInput } from "ink";
import type { Action, MenuItem, RunMode, Screen } from "../types.ts";

function nextSelectableIndex(
  items: MenuItem[],
  current: number,
  direction: 1 | -1,
): number {
  let next = current + direction;
  while (
    next >= 0 &&
    next < items.length &&
    items[next]?.type === "separator"
  ) {
    next += direction;
  }
  if (next < 0 || next >= items.length) return current;
  return next;
}

interface UseKeyboardOptions {
  stackRef: React.MutableRefObject<Screen[]>;
  actionsRef: React.MutableRefObject<Action[]>;
  searchActiveRef: React.MutableRefObject<boolean>;
  searchQueryRef: React.MutableRefObject<string>;
  selectedIndexRef: React.MutableRefObject<number>;
  runModeRef: React.MutableRefObject<RunMode>;
  setSearchActive: (active: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSelectedIndex: (index: number) => void;
  setRunMode: (mode: RunMode) => void;
  resetSearch: () => void;
  pushScreen: (screen: Screen) => void;
  popScreen: () => void;
  exit: () => void;
  getMenuItems: (actions: Action[], path: string[]) => MenuItem[];
  computeFiltered: (items: MenuItem[], query: string) => MenuItem[];
  isActive?: boolean;
  onRunInteractive: (action: Action) => void;
  onRunMultiAction: (mode: "sequential" | "parallel", actions: Action[]) => void;
}

export function useKeyboard({
  stackRef,
  actionsRef,
  searchActiveRef,
  searchQueryRef,
  selectedIndexRef,
  runModeRef,
  setSearchActive,
  setSearchQuery,
  setSelectedIndex,
  setRunMode,
  resetSearch,
  pushScreen,
  popScreen,
  exit,
  getMenuItems,
  computeFiltered,
  isActive = true,
  onRunInteractive,
  onRunMultiAction,
}: UseKeyboardOptions) {
  useInput(
    (input, key) => {
      const screen = stackRef.current.at(-1) as Screen;

      if (screen.type !== "menu") return;

      // ── Search mode ──────────────────────────────────────────────
      if (searchActiveRef.current) {
        if (key.escape) {
          resetSearch();
          return;
        }
        if (key.return) {
          selectCurrentItem(
            screen,
            actionsRef,
            searchQueryRef,
            selectedIndexRef,
            getMenuItems,
            computeFiltered,
            pushScreen,
            onRunInteractive,
          );
          return;
        }
        if (key.backspace || key.delete) {
          const newQuery = searchQueryRef.current.slice(0, -1);
          searchQueryRef.current = newQuery;
          selectedIndexRef.current = 0;
          setSearchQuery(newQuery);
          setSelectedIndex(0);
          return;
        }
        if (key.upArrow) {
          const allItems = getMenuItems(actionsRef.current, screen.path);
          const filtered = computeFiltered(allItems, searchQueryRef.current);
          const newIdx = nextSelectableIndex(filtered, selectedIndexRef.current, -1);
          selectedIndexRef.current = newIdx;
          setSelectedIndex(newIdx);
          return;
        }
        if (key.downArrow) {
          const allItems = getMenuItems(actionsRef.current, screen.path);
          const filtered = computeFiltered(allItems, searchQueryRef.current);
          const newIdx = nextSelectableIndex(filtered, selectedIndexRef.current, 1);
          selectedIndexRef.current = newIdx;
          setSelectedIndex(newIdx);
          return;
        }
        if (!key.ctrl && !key.meta && input) {
          const newQuery = searchQueryRef.current + input;
          searchQueryRef.current = newQuery;
          selectedIndexRef.current = 0;
          setSearchQuery(newQuery);
          setSelectedIndex(0);
        }
        return;
      }

      // ── Normal menu mode ─────────────────────────────────────────
      if (input === "/") {
        searchActiveRef.current = true;
        searchQueryRef.current = "";
        selectedIndexRef.current = 0;
        setSearchActive(true);
        setSearchQuery("");
        setSelectedIndex(0);
        return;
      }

      if (input === "q") {
        exit();
        return;
      }

      // Escape: clear run mode first; if already normal, pop screen
      if (key.escape) {
        if (runModeRef.current.type !== "normal") {
          const cleared: RunMode = { type: "normal" };
          runModeRef.current = cleared;
          setRunMode(cleared);
          return;
        }
        popScreen();
        return;
      }

      // Enter: execute multi-run if queued/selected, otherwise normal select
      if (key.return) {
        const mode = runModeRef.current;
        if (mode.type === "sequential" && mode.queue.length > 0) {
          onRunMultiAction("sequential", mode.queue);
          exit();
          return;
        }
        if (mode.type === "parallel" && mode.selected.size > 0) {
          const selectedActions = actionsRef.current.filter((a) =>
            (mode.selected as Set<string>).has(a.id),
          );
          onRunMultiAction("parallel", selectedActions);
          exit();
          return;
        }
        selectCurrentItem(
          screen,
          actionsRef,
          searchQueryRef,
          selectedIndexRef,
          getMenuItems,
          computeFiltered,
          pushScreen,
          onRunInteractive,
        );
        return;
      }

      if (key.upArrow || input === "k") {
        const allItems = getMenuItems(actionsRef.current, screen.path);
        const newIdx = nextSelectableIndex(allItems, selectedIndexRef.current, -1);
        selectedIndexRef.current = newIdx;
        setSelectedIndex(newIdx);
        return;
      }
      if (key.downArrow || input === "j") {
        const allItems = getMenuItems(actionsRef.current, screen.path);
        const newIdx = nextSelectableIndex(allItems, selectedIndexRef.current, 1);
        selectedIndexRef.current = newIdx;
        setSelectedIndex(newIdx);
        return;
      }

      // Right / l — queue focused action for sequential run
      if (key.rightArrow || input === "l") {
        if (runModeRef.current.type === "parallel") return;
        const action = getFocusedAction(
          screen, actionsRef, searchQueryRef, selectedIndexRef,
          getMenuItems, computeFiltered,
        );
        if (!action) return;
        const prevQueue =
          runModeRef.current.type === "sequential"
            ? runModeRef.current.queue
            : [];
        const newMode: RunMode = {
          type: "sequential",
          queue: [...prevQueue, action],
        };
        runModeRef.current = newMode;
        setRunMode(newMode);
        return;
      }

      // Left / h — dequeue last occurrence of focused action from sequential queue
      if (key.leftArrow || input === "h") {
        if (runModeRef.current.type !== "sequential") return;
        const action = getFocusedAction(
          screen, actionsRef, searchQueryRef, selectedIndexRef,
          getMenuItems, computeFiltered,
        );
        if (!action) return;
        const queue = runModeRef.current.queue;
        const lastIdx = [...queue].reverse().findIndex((a) => a.id === action.id);
        if (lastIdx === -1) return;
        const actualIdx = queue.length - 1 - lastIdx;
        const newQueue = queue.filter((_, i) => i !== actualIdx);
        const newMode: RunMode =
          newQueue.length === 0
            ? { type: "normal" }
            : { type: "sequential", queue: newQueue };
        runModeRef.current = newMode;
        setRunMode(newMode);
        return;
      }

      // Space — toggle focused action for parallel run
      if (input === " ") {
        if (runModeRef.current.type === "sequential") return;
        const action = getFocusedAction(
          screen, actionsRef, searchQueryRef, selectedIndexRef,
          getMenuItems, computeFiltered,
        );
        if (!action) return;
        const prevSelected =
          runModeRef.current.type === "parallel"
            ? new Set(runModeRef.current.selected)
            : new Set<string>();
        if (prevSelected.has(action.id)) {
          prevSelected.delete(action.id);
        } else {
          prevSelected.add(action.id);
        }
        const newMode: RunMode =
          prevSelected.size === 0
            ? { type: "normal" }
            : { type: "parallel", selected: prevSelected };
        runModeRef.current = newMode;
        setRunMode(newMode);
        return;
      }
    },
    { isActive },
  );
}

function getFocusedAction(
  screen: Screen & { type: "menu" },
  actionsRef: React.MutableRefObject<Action[]>,
  searchQueryRef: React.MutableRefObject<string>,
  selectedIndexRef: React.MutableRefObject<number>,
  getMenuItems: (actions: Action[], path: string[]) => MenuItem[],
  computeFiltered: (items: MenuItem[], query: string) => MenuItem[],
): Action | null {
  const allItems = getMenuItems(actionsRef.current, screen.path);
  const filtered = computeFiltered(allItems, searchQueryRef.current);
  const item = filtered[selectedIndexRef.current];
  if (!item || item.type !== "action") return null;
  return actionsRef.current.find((a) => a.id === item.value) ?? null;
}

function selectCurrentItem(
  screen: Screen & { type: "menu" },
  actionsRef: React.MutableRefObject<Action[]>,
  searchQueryRef: React.MutableRefObject<string>,
  selectedIndexRef: React.MutableRefObject<number>,
  getMenuItems: (actions: Action[], path: string[]) => MenuItem[],
  computeFiltered: (items: MenuItem[], query: string) => MenuItem[],
  pushScreen: (screen: Screen) => void,
  onRunInteractive: (action: Action) => void,
) {
  const menuPath = screen.path;
  const allItems = getMenuItems(actionsRef.current, menuPath);
  const filtered = computeFiltered(allItems, searchQueryRef.current);
  const item = filtered[selectedIndexRef.current];
  if (!item || item.type === "separator") return;

  if (item.type === "category") {
    pushScreen({ type: "menu", path: [...menuPath, item.value] });
  } else {
    const action = actionsRef.current.find((a) => a.id === item.value);
    if (action?.meta.confirm) {
      pushScreen({ type: "confirm", actionId: item.value });
    } else if (action?.runtime === "ink") {
      pushScreen({ type: "ink-component", actionId: item.value });
    } else if (action) {
      onRunInteractive(action);
    }
  }
}
```

- [ ] **Step 4: Update `src/app.tsx`**

Add `useRefState` import to the top of `src/app.tsx`:

```ts
import { useRefState } from "./hooks/useRefState.ts";
```

Also add `RunMode` to the existing types import line (which already imports `Action`, `MenuItem`, `PluginSyncStatus`):

```ts
import type { Action, MenuItem, PluginSyncStatus, RunMode } from "./types.ts";
```

Update `AppProps`:

```ts
interface AppProps {
  kadaiDir: string;
  onRunAction: (action: Action) => void;
  onRunMultiAction: (mode: "sequential" | "parallel", actions: Action[]) => void;
}
```

Update the `App` function signature to destructure `onRunMultiAction`:

```ts
export function App({ kadaiDir, onRunAction, onRunMultiAction }: AppProps) {
```

In the `App` function body, add after `const { exit } = useApp();`:

```ts
const [runMode, runModeRef, setRunMode] = useRefState<RunMode>({ type: "normal" });
```

Update the `useKeyboard` call — add the four new props:

```ts
useKeyboard({
  stackRef: nav.stackRef,
  actionsRef,
  searchActiveRef: search.searchActiveRef,
  searchQueryRef: search.searchQueryRef,
  selectedIndexRef: search.selectedIndexRef,
  runModeRef,
  setSearchActive: search.setSearchActive,
  setSearchQuery: search.setSearchQuery,
  setSelectedIndex: search.setSelectedIndex,
  setRunMode,
  resetSearch: search.resetSearch,
  pushScreen: nav.pushScreen,
  popScreen: nav.popScreen,
  exit,
  getMenuItems: buildMenuItems,
  computeFiltered: search.computeFiltered,
  isActive: nav.currentScreen.type === "menu",
  onRunInteractive: handleRunAction,
  onRunMultiAction,
});
```

In the menu screen render block, add the preview bar just before the closing `</Box>` of the outermost `<Box flexDirection="column">`:

```tsx
{runMode.type !== "normal" && (
  <Box marginTop={1}>
    <Text dimColor>→ </Text>
    <Text>
      {runMode.type === "sequential"
        ? `kadai run ${runMode.queue.map((a) => a.id).join(" ")}`
        : `kadai run ${[...runMode.selected].join(" + ")}`}
    </Text>
  </Box>
)}
```

- [ ] **Step 5: Update `src/cli.tsx` to pass `onRunMultiAction` and handle TUI multi-run**

After `let selectedAction: Action | null = null;`, add:

```ts
let selectedMultiAction: {
  mode: "sequential" | "parallel";
  actions: Action[];
} | null = null;
```

Update the `render` call to pass `onRunMultiAction`:

```ts
const instance = render(
  React.createElement(App, {
    kadaiDir,
    onRunAction: (action: Action) => {
      selectedAction = action;
    },
    onRunMultiAction: (
      mode: "sequential" | "parallel",
      actions: Action[],
    ) => {
      selectedMultiAction = { mode, actions };
    },
  }),
  {
    stdin: stdinStream,
    stdout: process.stdout,
    stderr: process.stderr,
  },
);
```

Replace `if (!selectedAction) process.exit(0);` (right after `await instance.waitUntilExit();`) with:

```ts
if (!selectedAction && !selectedMultiAction) process.exit(0);

if (selectedMultiAction) {
  const { handleRunSequential, handleRunParallel } = await import(
    "./core/commands.ts"
  );
  const actionIds = selectedMultiAction.actions.map((a) => a.id);
  if (selectedMultiAction.mode === "sequential") {
    await handleRunSequential({ kadaiDir, actionIds, cwd });
  } else {
    await handleRunParallel({ kadaiDir, actionIds, cwd });
  }
}

if (!selectedAction) process.exit(0);
```

- [ ] **Step 6: Run navigation tests**

```bash
bun test test/navigation.test.ts
```

Expected: all tests PASS including the 3 new ones.

- [ ] **Step 7: Run full test suite**

```bash
bun test
```

Expected: all tests PASS.

- [ ] **Step 8: Run type-check**

```bash
bun run check
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useKeyboard.ts src/app.tsx src/cli.tsx test/navigation.test.ts
git commit -m "feat: TUI multi-run — queue (→/l), parallel (space), preview bar, Enter to execute"
```

---

## Task 7: Smoke Test (manual)

- [ ] **Step 1: Sequential from CLI**

```bash
bun src/cli.tsx run hello hello
```

Expected: "Hello World" header and "Hello from kadai!" output appears twice, with a blank line between, exit code 0.

- [ ] **Step 2: Sequential short-circuit from CLI**

```bash
cd test/fixtures/basic-repo && bun ../../../src/cli.tsx run hello nonexistent-id
```

Expected: exits 1 with error mentioning "nonexistent-id" before "Hello World" runs. *(Validate: only one output printed.)*

- [ ] **Step 3: Parallel from CLI**

```bash
bun src/cli.tsx run hello + hello
```

Expected: tab UI appears with two tabs both named "Hello World", both show "Hello from kadai!" in output, both tabs show ✓ when done, exits 0.

- [ ] **Step 4: TUI sequential queue**

```bash
bun src/cli.tsx
```

Press `→` on "Hello World" — preview bar shows `kadai run hello`.
Press `→` again on another action — preview updates with both IDs.
Press `←` to dequeue the last — preview updates.
Press `Enter` — actions run sequentially.

- [ ] **Step 5: TUI parallel select**

```bash
bun src/cli.tsx
```

Press `Space` on "Hello World" — preview shows `kadai run hello`.
Press `↓`, then `Space` — preview shows `kadai run hello + <second-id>`.
Press `Enter` — parallel tab UI appears with both actions running.
