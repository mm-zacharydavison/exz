# Better Init Experience — Implementation Plan

## Context

Currently, when a user runs `zcli` in a repo without `.zcli/`, it silently auto-creates the directory with a hello-world sample action. This misses an opportunity to configure sources and preferences upfront. A guided init flow should detect the user's environment and ask targeted questions to set up a useful `.zcli/config.ts` from the start.

---

## User Flow

**Org repo detected (current repo belongs to org "meetsmore"):**

```
$ zcli

No .zcli directory found. Let's set one up.

Detected GitHub org "meetsmore" with a shared actions repo.
? Use meetsmore/zcli-actions as a source for shared actions?
  [1] Yes, use meetsmore/zcli-actions (recommended)
  [2] I have a different repo
  [3] No shared repo — just use local .zcli/actions/

> 1

✓ AI generation enabled (Claude CLI detected)

Creating .zcli/actions/ with a sample action...
Writing .zcli/config.ts...
Done! Run zcli again to get started.
```

**Personal repo detected (current repo belongs to user "zack"):**

```
$ zcli

No .zcli directory found. Let's set one up.

Detected a shared actions repo: zack/zcli-actions
? Use zack/zcli-actions as a source?
  [1] Yes, use zack/zcli-actions (recommended)
  [2] I have a different repo
  [3] No shared repo — just use local .zcli/actions/

> 1

Creating .zcli/actions/ with a sample action...
Writing .zcli/config.ts...
Done!
```

**No zcli-actions repo found (org repo):**

```
$ zcli

No .zcli directory found. Let's set one up.

? No shared actions repo found for "meetsmore".
  [1] Create meetsmore/zcli-actions on GitHub
  [2] I have a different repo
  [3] No shared repo — just use local .zcli/actions/

> 1

Creating meetsmore/zcli-actions on GitHub...
✓ Created meetsmore/zcli-actions

Creating .zcli/actions/ with a sample action...
Writing .zcli/config.ts...
Done!
```

**Create repo fails due to insufficient permissions:**

```
> 1

Creating meetsmore/zcli-actions on GitHub...
✗ Could not create meetsmore/zcli-actions: insufficient permissions.
  Ask an org admin to create the repo, or visit:
  https://github.com/organizations/meetsmore/repositories/new

? What would you like to do?
  [1] I have a different repo
  [2] No shared repo — just use local .zcli/actions/
```

**No zcli-actions repo found (personal repo):**

```
$ zcli

No .zcli directory found. Let's set one up.

? No shared actions repo found for "zack".
  [1] Create zack/zcli-actions on GitHub
  [2] I have a different repo
  [3] No shared repo — just use local .zcli/actions/
```

**No git repo / no gh CLI:**

```
$ zcli

No .zcli directory found. Let's set one up.

? Do you have a shared zcli actions repo?
  [1] Yes, let me enter it
  [2] No, just use local .zcli/actions/

> 1

? Repo (org/name):
> meetsmore/zcli-actions

Creating .zcli/actions/ with a sample action...
Writing .zcli/config.ts...
Done!
```

AI is detected and enabled/disabled silently — no question asked. If `claude` (or other supported AI CLIs) is found on PATH, AI generation is enabled. If not, it's disabled. The user can always change this later in `config.ts`.

---

## Design

### Phase 1: Detect environment

Before prompting, gather three signals in parallel (all silent, best-effort):

1. **Git repo identity** — `detectRepoIdentity(cwd)` to get `{ org, repo }` or null
2. **Shared zcli-actions repo** — Based on whether the current repo is an org repo or personal repo, check if `{owner}/zcli-actions` exists on GitHub via `gh api repos/{owner}/zcli-actions --jq .full_name`. The `owner` is the org name for org repos, or the GitHub username for personal repos.
3. **AI CLIs installed** — Check `Bun.which("claude")` for Claude Code. Future: also check `codex`, `aider`, etc.

**Org vs personal detection**: The `org` field from `detectRepoIdentity` could be a GitHub org or a personal username. Both are checked the same way — `gh api repos/{org}/zcli-actions`. GitHub's API works identically for orgs and users.

**Default branch detection**: When a repo is found, detect its default branch via `gh api repos/{owner}/zcli-actions --jq .default_branch` instead of prompting. This returns `"main"` or `"master"` (or whatever the repo uses). No branch question for the user.

### Phase 2: Prompt the user

The init wizard is a plain `readline`-based flow (not Ink) since it runs before the app renders and needs simple sequential prompts.

#### Question: Sources

**If `{owner}/zcli-actions` was found on GitHub:**

```
Detected a shared actions repo: {owner}/zcli-actions
? Use it as a source for shared actions?
  [1] Yes, use {owner}/zcli-actions (recommended)
  [2] I have a different repo
  [3] No shared repo — just use local .zcli/actions/
```

**If no zcli-actions repo found but owner is known:**

```
No shared actions repo found for "{owner}".
  [1] Create {owner}/zcli-actions on GitHub
  [2] I have a different repo
  [3] No shared repo — just use local .zcli/actions/
```

Creation uses `gh repo create {owner}/zcli-actions --public --description "Shared zcli actions"`. If creation fails with a permission error (exit code non-zero, stderr contains "permission" or "403"), show:

```
✗ Could not create {owner}/zcli-actions: insufficient permissions.
  Ask an org admin to create the repo, or visit:
  https://github.com/organizations/{owner}/repositories/new
```

Then fall back to the two remaining options (enter a different repo / skip). For personal users the URL omits the `/organizations/` path segment.

**If no git repo / no gh CLI:**

```
? Do you have a shared zcli actions repo?
  [1] Yes, let me enter it
  [2] No, just use local .zcli/actions/
```

If the user enters a custom repo, validate it exists via `gh api repos/{repo}` before proceeding. On failure, print a warning and ask again (up to 3 attempts, then skip). Also fetch its default branch via the same API call.

#### AI: No question — silent detection

AI generation is enabled or disabled purely based on whether a supported CLI is installed:

- `Bun.which("claude")` returns a path → `ai.enabled = true` (show `✓ AI generation enabled (Claude CLI detected)`)
- Returns null → `ai.enabled = false` (no message, silent)

Users who install `claude` later just need to delete the `ai` field from config (or set it to `{ enabled: true }`), or re-run init.

### Phase 3: Write files

Based on answers, generate:

1. `.zcli/actions/` directory with the sample `hello.sh` (existing logic from `init.ts`)
2. `.zcli/config.ts` — **always generated**, with all available config fields. Active settings use real values, everything else is commented out with defaults so users can discover what's configurable.

**Example: sources configured, AI enabled (default):**
```ts
export default {
  sources: [
    { repo: "meetsmore/zcli-actions" },
  ],

  // actionsDir: "actions",
  // env: {},
  // hooks: {
  //   before: "",
  //   after: "",
  // },
  // ai: { enabled: true },
};
```

**Example: no sources, AI disabled:**
```ts
export default {
  ai: { enabled: false },

  // actionsDir: "actions",
  // env: {},
  // hooks: {
  //   before: "",
  //   after: "",
  // },
  // sources: [],
};
```

**Example: all defaults (no sources, AI enabled):**
```ts
export default {
  // actionsDir: "actions",
  // env: {},
  // hooks: {
  //   before: "",
  //   after: "",
  // },
  // sources: [],
  // ai: { enabled: true },
};
```

The config template is built by `generateConfigFile()` in `init-wizard.ts`. Active (non-default) settings go at the top as real properties. Remaining fields are appended as commented-out defaults. `ref` is omitted from source config when it matches `"main"` (the default).

### `gh` CLI dependency

The repo detection uses `gh api`. If `gh` is not installed or not authenticated, detection silently fails and the user gets the manual "do you have a repo?" question instead. No error shown — best-effort convenience.

---

## Files to Create

### `src/core/init-wizard.ts` — Interactive init flow

Responsibilities:
- `runInitWizard(cwd: string): Promise<InitResult>` — orchestrates the full flow
- `detectZcliActionsRepo(owner: string): Promise<{ repo: string; defaultBranch: string } | null>` — checks if `{owner}/zcli-actions` exists on GitHub, returns repo full name and default branch
- `createZcliActionsRepo(owner: string): Promise<{ success: true; repo: string; defaultBranch: string } | { success: false; permissionError: boolean }>` — creates `{owner}/zcli-actions` via `gh repo create`. Returns `permissionError: true` when the user lacks org permissions (403 / "permission denied" in stderr)
- `detectAiCli(): Promise<boolean>` — checks for `claude` (and future AI CLIs)
- `promptChoice(question: string, options: string[]): Promise<number>` — simple numbered menu prompt
- `promptText(question: string, defaultValue?: string): Promise<string>` — text input with optional default
- `validateRepo(repo: string): Promise<{ valid: boolean; defaultBranch?: string }>` — checks repo exists via `gh api`, returns default branch if found

```ts
interface InitResult {
  zcliDir: string;
  sources: SourceConfig[];
  aiEnabled: boolean;
}
```

### `test/init-wizard.test.ts` — Tests for init wizard

Tests use dependency injection for all I/O (gh CLI, git detection, Bun.which, readline).

---

## Files to Modify

### `src/types.ts`

Add to `ZcliConfig`:
```ts
export interface ZcliConfig {
  // ... existing fields
  ai?: {
    enabled?: boolean;  // default true
  };
}
```

### `src/core/init.ts`

Refactor to accept `InitResult` and write the config file accordingly. The existing `initZcli` becomes the "write" step that the wizard calls after gathering preferences.

```ts
export async function initZcli(cwd: string, options?: {
  sources?: SourceConfig[];
  aiEnabled?: boolean;
}): Promise<string>
```

### `src/cli.tsx`

Replace the current auto-init block:

```ts
// Before (current)
if (!zcliDir) {
  console.log("No .zcli directory found. Initializing...");
  zcliDir = await initZcli(cwd);
}

// After
if (!zcliDir) {
  if (!process.stdin.isTTY) {
    process.stderr.write("Error: No .zcli directory found.\n");
    process.exit(1);
  }
  const result = await runInitWizard(cwd);
  zcliDir = result.zcliDir;
}
```

### `src/core/config.ts`

Add `ai` field to config loading:

```ts
return {
  actionsDir: userConfig.actionsDir ?? DEFAULT_CONFIG.actionsDir,
  env: userConfig.env ?? DEFAULT_CONFIG.env,
  hooks: userConfig.hooks,
  sources: userConfig.sources,
  ai: userConfig.ai,
};
```

### `src/hooks/useKeyboard.ts` (or wherever `n` is handled)

Check `config.ai?.enabled !== false` before triggering AI generation. When disabled, `n` is a no-op on the menu screen.

### `src/components/StatusBar.tsx`

Hide the `n new` hint when `config.ai?.enabled === false`.

---

## Implementation Order (TDD)

### Step 1: Types

Add `ai` field to `ZcliConfig` in `src/types.ts`.

### Step 2: Environment detection utilities

**Tests first** (`test/init-wizard.test.ts`):

| Test                                                  | Input                          | Expected                                   |
| ----------------------------------------------------- | ------------------------------ | ------------------------------------------ |
| detectZcliActionsRepo finds repo for org              | owner "meetsmore", gh returns OK | `{ repo: "meetsmore/zcli-actions", defaultBranch: "main" }` |
| detectZcliActionsRepo finds repo for personal user    | owner "zack", gh returns OK    | `{ repo: "zack/zcli-actions", defaultBranch: "main" }` |
| detectZcliActionsRepo returns null when no repo       | gh returns 404                 | `null`                                     |
| detectZcliActionsRepo returns null when no gh         | gh not installed               | `null`                                     |
| detectZcliActionsRepo returns correct default branch  | gh returns repo with master    | `{ ..., defaultBranch: "master" }`         |
| detectAiCli returns true when claude found            | Bun.which returns path         | `true`                                     |
| detectAiCli returns false when none found             | Bun.which returns null         | `false`                                    |
| validateRepo returns valid with default branch        | gh returns 200                 | `{ valid: true, defaultBranch: "main" }`   |
| validateRepo returns invalid for missing repo         | gh returns 404                 | `{ valid: false }`                         |
| createZcliActionsRepo succeeds                        | gh repo create succeeds        | `{ success: true, repo: "meetsmore/zcli-actions", defaultBranch: "main" }` |
| createZcliActionsRepo fails with permission error     | gh returns 403 / "permission"  | `{ success: false, permissionError: true }`  |
| createZcliActionsRepo fails with other error          | gh returns other error         | `{ success: false, permissionError: false }` |

**Implement** detection functions in `src/core/init-wizard.ts`.

### Step 3: Init wizard orchestration

**Tests first** (extend `test/init-wizard.test.ts`):

| Test                                                 | Setup                                   | Expected                                               |
| ---------------------------------------------------- | --------------------------------------- | ------------------------------------------------------ |
| Wizard suggests detected zcli-actions repo           | org detected, repo exists               | Sources include detected repo                          |
| Wizard works for personal user repos                 | personal user detected, repo exists     | Sources include user's zcli-actions                    |
| Wizard offers to create repo when owner has none     | owner detected, no zcli-actions found   | Shows "Create {owner}/zcli-actions" option             |
| Wizard creates repo when user selects create         | user selects create, gh succeeds        | Repo created, sources include new repo                 |
| Wizard shows admin error on permission failure       | user selects create, gh returns 403     | Shows "ask org admin" message with URL, falls back     |
| Wizard falls back to enter/skip after create failure | create failed (permissions)             | Prompts with "different repo" / "no shared repo" only  |
| Wizard asks for repo when no git remote              | no git remote                           | Prompts user for repo input                            |
| Wizard silently enables AI when claude installed     | Bun.which("claude") found               | `aiEnabled: true`, no prompt                           |
| Wizard silently disables AI when no CLI found        | no AI CLI found                         | `aiEnabled: false`, no prompt                          |
| Wizard writes config with sources                    | user selects a source                   | config.ts written with sources array                   |
| Wizard writes config with AI disabled                | no AI CLI                               | config.ts written with `ai: { enabled: false }`        |
| Wizard creates actions dir and sample                | any path                                | `.zcli/actions/hello.sh` exists                        |
| Wizard writes config with all defaults commented out | no sources, AI enabled                  | config.ts has all fields commented out                 |
| Wizard validates user-entered repo                   | user enters invalid repo                | Re-prompts with error message                          |
| Wizard uses detected default branch                  | repo has "master" as default            | Source config uses `ref: "master"`                     |
| Wizard omits ref when default branch is "main"       | repo has "main" as default              | Source config has no `ref` field                       |

**Implement** `runInitWizard` in `src/core/init-wizard.ts`.

### Step 4: Init.ts refactor

**Modify** `src/core/init.ts` to accept optional sources and AI config, and write `config.ts` when needed.

### Step 5: CLI integration

**Modify** `src/cli.tsx` to call `runInitWizard` instead of `initZcli` directly.

### Step 6: AI flag integration

**Modify** `src/core/config.ts` to pass through the `ai` field.
**Modify** StatusBar to conditionally show/hide the `n new` hint.
**Modify** keyboard handler to check `config.ai?.enabled !== false` before triggering AI generation.

---

## Edge Cases

| Scenario                                    | Behavior                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| `gh` CLI not installed                      | Repo detection silently skips, user gets manual prompt                   |
| `gh` not authenticated                      | Same as above — API call fails silently                                  |
| Not in a git repo                           | No owner detection, skip straight to "do you have a repo?" prompt        |
| User Ctrl+C during wizard                   | Process exits cleanly, no partial `.zcli/` left behind                   |
| Non-interactive (piped stdin)               | Error and exit (existing behavior, unchanged)                            |
| User enters repo that doesn't exist         | Warn and re-prompt (up to 3 attempts, then skip)                         |
| `.zcli/` already exists but no `config.ts`  | Wizard is NOT triggered (only triggers when no `.zcli/` at all)          |
| User selects "no shared repo"               | No sources configured, config still written with defaults commented out  |
| Repo default branch is neither main/master  | Works fine — `gh api` returns whatever the actual default branch is      |
| Owner has zcli-actions but it's private      | `gh api` returns it if user is authenticated, 404 otherwise (falls back) |
| Repo creation fails due to org permissions   | Show admin error with org settings URL, fall back to enter/skip options  |
| Repo creation fails for other reasons        | Show generic error, fall back to enter/skip options                      |

---

## File Summary

| File                           | Change   |
| ------------------------------ | -------- |
| `src/types.ts`                 | Modify   |
| `src/core/init-wizard.ts`      | **New**  |
| `src/core/init.ts`             | Modify   |
| `src/cli.tsx`                  | Modify   |
| `src/core/config.ts`           | Modify   |
| `src/components/StatusBar.tsx`  | Modify   |
| `src/hooks/useKeyboard.ts`     | Modify   |
| `test/init-wizard.test.ts`     | **New**  |

---

## Verification

1. Delete `.zcli/` in an org repo → run `zcli` → wizard detects org and suggests `{org}/zcli-actions`
2. Delete `.zcli/` in a personal repo → run `zcli` → wizard detects user and suggests `{user}/zcli-actions`
3. Delete `.zcli/` with no `gh` CLI → run `zcli` → wizard asks if you have a shared repo
4. Enter an invalid repo name → wizard warns and re-prompts
5. Select "no shared repo" with `claude` installed → AI silently enabled, minimal setup
6. Select "no shared repo" without `claude` → AI silently disabled
7. No zcli-actions repo exists → select "Create" → repo created, configured as source
8. No zcli-actions repo, user lacks org permissions → select "Create" → admin error shown with URL, falls back to enter/skip
9. Check that AI-disabled config hides `n new` hint and disables `n` key
8. Run `bun test` → all tests pass
9. Pipe input (`echo | zcli`) → errors with "no .zcli directory" (non-interactive unchanged)
