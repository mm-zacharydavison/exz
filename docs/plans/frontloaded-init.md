# Frontloaded Init

Move all configuration decisions into the `xcli init` wizard and add pull request workflow support.

## Motivation

The current init workflow uses smart auto-detection (probing GitHub API for `{org}/xcli-actions`, inferring org vs personal from git remote). This creates implicit behavior that's hard to predict and debug. The share workflow also always pushes directly to main, which doesn't work for teams that require code review.

This plan replaces auto-detection with explicit questions during init, and adds a PR-based sharing option.

Auto-detections also exist outside init and should be replaced with config reads:
- `src/cli.tsx:189-194` — `detectRepoIdentity()` and `getGitUserName()` called at session start, passed as `org`/`userName` to App → ShareScreen for default share path building
- `src/hooks/useActions.ts:33` — `detectRepoIdentity()` called to auto-navigate the menu to `@{org}/{repo}` category on load

After this change, all of these read from config written during init instead of re-detecting at runtime.

## Current State

### Init Wizard (`src/components/InitWizard.tsx` + `src/core/init-wizard.ts`)

Phases: detecting → choose-source → enter-repo | creating-repo → writing → done

- **Auto-detects** org from git remote (`detectRepoIdentity`)
- **Probes GitHub API** for `{org}/xcli-actions` repo (`detectXcliActionsRepo`)
- **Branches UI** based on detection results (3 different option sets)
- **Offers to create** `{org}/xcli-actions` on GitHub

### Share Workflow (`src/ai/share.ts` + `src/components/ShareScreen.tsx`)

- After AI generation, pushes new actions directly to main
- `shareToSource()`: pull → copy files → commit → `git push`
- ShareScreen picks source repo + destination path, then calls `shareToSource`

### Config (`src/types.ts` → `XcliConfig`)

```ts
{
  actionsDir?: string
  env?: Record<string, string>
  hooks?: { before?: string; after?: string }
  sources?: SourceConfig[]        // { repo, ref? }
  ai?: { enabled?: boolean }
}
```

No PR config exists. No share strategy config exists.

### Runtime Auto-Detections (outside init)

| Location                      | What it detects                  | Used for                                             |
|-------------------------------|----------------------------------|------------------------------------------------------|
| `src/cli.tsx:189-194`         | `detectRepoIdentity`, `getGitUserName` | `org`/`userName` → ShareScreen default path    |
| `src/hooks/useActions.ts:33`  | `detectRepoIdentity`             | Auto-navigate menu to `@{org}/{repo}` category       |
| `src/components/InitWizard.tsx:88` | `detectRepoIdentity`        | Init wizard detection phase (already being replaced)  |

## Proposed Changes

### 1. New Init Wizard Flow

Replace the current detection-based branching with a linear question sequence.

```
Phase 1: "Where should xcli actions live?"
  ❯ Local only (.xcli/actions/)
  ❯ Shared repo

Phase 2: (if shared repo) "Shared repo setup"
  ❯ Create a new repo on GitHub
  ❯ Use an existing repo

Phase 2a: (if create) "Where should the repo be created?"
  ❯ Personal (github.com/{username}/xcli-actions)
  ❯ {org-1} (github.com/{org-1}/xcli-actions)
  ❯ {org-2} (github.com/{org-2}/xcli-actions)
  ...
  [fetches orgs via `gh api user/orgs`, lists them alongside personal account]
  [runs `gh repo create {owner}/xcli-actions --public`, captures default branch]

Phase 2b: (if existing) "Enter the repo"
  > org/repo-name
  [validates via GitHub API]

Phase 3: "How should changes be pushed?"
  ❯ Push directly to the default branch
  ❯ Push to an xcli-actions branch
  ❯ Create a pull request

Phase 4: (if PR) "Who should review PRs?" (optional)
  > @username (or leave blank for no default reviewer)

Phase 5: "Enable AI action generation?"
  ❯ Yes (requires Claude CLI)
  ❯ No

Phase 6: Write files
  [if new repo + PR strategy: setup branch protection rules on default branch]
  [if xcli-actions branch + PR strategy: setup branch protection on xcli-actions branch]
```

Phase 3 applies regardless of local vs shared — even local-only users may want changes to `.xcli/` committed via PR to their project repo. The three strategies:

| Strategy              | What happens when sharing                                                   |
|-----------------------|-----------------------------------------------------------------------------|
| Push to default branch | `git push` directly to main/master (current behavior)                      |
| xcli-actions branch   | Push to a persistent `xcli-actions` branch in the target repo               |
| Pull request          | Create a feature branch `xcli/add-actions-{timestamp}`, push, open PR via `gh` |

Phase 5 asks explicitly instead of silently detecting. `detectAiCli()` is still called to show a warning if they select "Yes" but the Claude CLI isn't installed.

#### What's Removed

| Removed                                       | Why                                                 |
|-----------------------------------------------|-----------------------------------------------------|
| `detectRepoIdentity()` call during init       | User explicitly picks local or enters repo          |
| `detectXcliActionsRepo()` GitHub API probe    | User explicitly enters repo or creates one          |
| Smart option branching in `buildSourceOptions` | Single linear flow for all cases                   |
| `creating-repo` and `create-failed` phases    | Replaced by Phase 2's "create new repo" sub-flow    |
| `detectRepoIdentity()` in `cli.tsx` main      | Read `org` from config instead                      |
| `getGitUserName()` in `cli.tsx` main          | Read `userName` from config instead                 |
| `detectRepoIdentity()` in `useActions.ts`     | Read auto-navigate path from config instead         |

#### What's Kept

| Kept                      | Why                                                          |
|---------------------------|--------------------------------------------------------------|
| `detectAiCli()`           | Warn if user enables AI but Claude CLI isn't installed       |
| `validateRepo()` API call | Validates the entered repo exists when using existing repo   |
| `createXcliActionsRepo()` | Moved from auto-detection to explicit Phase 2 "create" path |
| `writeInitFiles()`        | Still writes .xcli/ directory and config                     |

### 2. Config Changes

Add share strategy, org/user identity, and auto-navigate path to config:

```ts
// src/types.ts

export interface SourceConfig {
  repo: string;
  ref?: string;
}

export interface ShareConfig {
  /** How changes are pushed to the target repo */
  strategy: "push" | "branch" | "pr";
  /** GitHub username for PR reviewer, only used when strategy = "pr" */
  reviewer?: string;
}

export interface XcliConfig {
  actionsDir?: string;
  env?: Record<string, string>;
  hooks?: { before?: string; after?: string };
  sources?: SourceConfig[];
  ai?: { enabled?: boolean };
  share?: ShareConfig;
  /** GitHub org name, written during init */
  org?: string;
  /** Git user name, written during init */
  userName?: string;
  /** Category path to auto-navigate to on startup (e.g. ["@org", "repo"]) */
  autoNavigate?: string[];
}
```

The share config is top-level (not nested under sources) because it applies to all sharing, regardless of which source repo is selected. There's only one share strategy per project.

`org`, `userName`, and `autoNavigate` are written once during init and read at runtime, replacing the `detectRepoIdentity()` / `getGitUserName()` calls scattered through the codebase.

### 3. Share Workflow Changes

Currently sharing is only triggered after AI generation (`generationResult` → `ShareScreen`). There's no way to share an action you wrote by hand or copied into `.xcli/actions/`. This needs to change — sharing should be accessible from the main menu for any local action.

#### New share entry point: keybinding from menu

Add an `s` keybinding in the menu. When the cursor is on a local action, `s` opens the share flow for that action. This reuses the existing `ShareScreen` component but enters it from the menu instead of from AI generation.

Changes:
- `src/hooks/useKeyboard.ts` — handle `s` key: if cursor is on a local action, push a `share` screen
- `src/types.ts` — add `{ type: "share"; actionIds: string[] }` to the `Screen` union
- `src/app.tsx` — render `ShareScreen` when current screen is `share`, pass the selected actions
- `src/components/StatusBar.tsx` — show `s share` hint in the status bar when sources are configured

The `ShareScreen` component already handles source selection, path selection, and the share call — no changes needed to its core logic beyond reading config for strategy.

#### Path selection in ShareScreen

The current `buildPathOptions` derives `existingDirs` from local action categories (top-level folders in `.xcli/actions/`). This is wrong for the share target — the relevant paths are the directories in the *destination* source repo, not the local ones.

Change `buildPathOptions` to scan the source repo's cached clone (`.xcli/.cache/sources/{owner}-{repo}-{ref}/`) for existing directories instead. This gives accurate path suggestions for where to place the shared action in the target repo.

The pick-path step becomes:

```
Destination path in {source-repo}:
  ❯ actions/@myorg/myname/          (default from config)
  ❯ actions/                        (root)
  ❯ actions/deploy/                 (existing dir in source repo)
  ❯ actions/database/               (existing dir in source repo)
  ❯ [type a custom path]█
```

- Existing directories are read from the cached source clone on disk (no network call)
- The default path is built from `config.org` and `config.userName` (previously from props)
- Custom text field stays as the last option
- Arrow keys to select, text input when on custom field — same UX as today

#### `src/ai/share.ts` → `src/core/share.ts`

Move from `src/ai/` to `src/core/` since sharing is no longer AI-specific.

Current: `shareToSource()` always does `git push` to main.

New: Branch based on `config.share.strategy`:

- **`push` (default, current behavior):** pull → copy → commit → `git push`
- **`branch`:**
  1. Checkout or create `xcli-actions` branch
  2. Copy files → commit
  3. `git push origin xcli-actions`
- **`pr`:**
  1. Pull latest default branch
  2. Create a timestamped branch: `xcli/add-actions-{timestamp}`
  3. Copy files → commit
  4. Push the branch
  5. Create PR via `gh pr create --title "..." --body "..." [--reviewer config.share.reviewer]`
  6. Return PR URL in `ShareResult`

```ts
export interface ShareResult {
  status: "success" | "error";
  error?: string;
  prUrl?: string;       // populated when strategy = "pr"
  branchName?: string;  // populated when strategy = "branch" or "pr"
}
```

#### `src/components/ShareScreen.tsx`

- After a successful PR share, display the PR URL so the user can click it.
- After a successful branch push, display the branch name.
- Read `org`/`userName` from config (via props or config already available) instead of separate props.
- No changes to the source/path selection flow — the strategy was decided during init.

### 4. Branch Protection Setup

When init creates a new repo (Phase 2 "create") or the user selects the `xcli-actions` branch strategy, and the push strategy is `pr`, automatically configure branch protection rules:

```bash
# For new repos with PR strategy — protect the default branch
gh api repos/{owner}/{repo}/branches/{default_branch}/protection \
  --method PUT \
  --field required_pull_request_reviews='{"required_approving_review_count":1}'

# For xcli-actions branch strategy with PR — protect the xcli-actions branch
gh api repos/{owner}/{repo}/branches/xcli-actions/protection \
  --method PUT \
  --field required_pull_request_reviews='{"required_approving_review_count":1}'
```

This happens during init (Phase 6 "write files") and is best-effort — if it fails (e.g. insufficient permissions), show a warning and continue.

### 5. Eliminating Runtime Auto-Detections

Replace all runtime `detectRepoIdentity()` / `getGitUserName()` calls with config reads:

#### `src/cli.tsx`

Before:
```ts
const [repoIdentity, gitUserName] = await Promise.all([
  detectRepoIdentity(cwd),
  getGitUserName(),
]);
const org = repoIdentity?.org;
const userName = gitUserName ?? undefined;
```

After:
```ts
const cfg = await loadConfig(xcliDir);
const org = cfg.org;
const userName = cfg.userName;
```

Remove the `org`/`userName` prop threading from `cli.tsx` → `renderInkApp` → `App` → `ShareScreen`. Instead, `ShareScreen` reads from config (already available via `useActions`).

#### `src/hooks/useActions.ts`

Before:
```ts
detectRepoIdentity(cwd).then((identity) => {
  if (!identity || autoNavigatedRef.current) return;
  const scopedPath = [`@${identity.org}`, identity.repo];
  // ...auto-navigate
});
```

After:
```ts
if (cfg.autoNavigate?.length) {
  const scopedPath = cfg.autoNavigate;
  // ...auto-navigate
}
```

No async call, no git subprocess — just a config read.

### 6. Config File Generation

Update `generateConfigFile()` in `src/core/init-wizard.ts` to write all new fields:

```ts
// Shared repo, PR strategy, with reviewer, AI enabled
export default {
  sources: [{ repo: "org/repo-name" }],
  share: {
    strategy: "pr",
    reviewer: "username",
  },
  ai: { enabled: true },
  org: "myorg",
  userName: "myname",
  autoNavigate: ["@myorg", "myrepo"],
};

// Shared repo, branch strategy, no AI
export default {
  sources: [{ repo: "org/repo-name" }],
  share: { strategy: "branch" },
  ai: { enabled: false },
  org: "myorg",
  userName: "myname",
};

// Shared repo, push strategy (default — omit share config)
export default {
  sources: [{ repo: "org/repo-name" }],
  org: "myorg",
  userName: "myname",
};

// Local only, push to default branch, AI enabled
export default {
  ai: { enabled: true },
};
```

## File Changes

| File                            | Change                                                                                                   |
|---------------------------------|----------------------------------------------------------------------------------------------------------|
| `src/types.ts`                  | Add `ShareConfig`, `share` screen type, add `share?`, `org?`, `userName?`, `autoNavigate?` to `XcliConfig` |
| `src/components/InitWizard.tsx` | Replace detection-branched flow with linear question sequence; add org selection for repo creation         |
| `src/core/init-wizard.ts`       | Remove `detectXcliActionsRepo`; add org listing via `gh api user/orgs`; update `generateConfigFile`; add branch protection setup |
| `src/ai/share.ts` → `src/core/share.ts` | Move out of `ai/`; add `branch` and `pr` strategies; return `prUrl`/`branchName` in `ShareResult` |
| `src/components/ShareScreen.tsx` | Display PR URL or branch name after share; read org/userName from config instead of props                |
| `src/app.tsx`                   | Remove `org`/`userName` props; render `ShareScreen` for `share` screen type                              |
| `src/cli.tsx`                   | Remove `detectRepoIdentity`/`getGitUserName` calls; read org/userName from config; remove prop threading |
| `src/hooks/useKeyboard.ts`     | Add `s` keybinding to share the currently selected local action                                           |
| `src/hooks/useActions.ts`       | Replace `detectRepoIdentity()` auto-navigate with `cfg.autoNavigate` config read                         |
| `src/components/StatusBar.tsx`  | Show `s share` hint when sources are configured                                                          |
| `src/core/git-utils.ts`         | No changes (kept for potential future use), but no longer imported by cli.tsx or useActions.ts            |

## Out of Scope

- Smart detection defaults (pre-filling answers based on git remote). Explicitly deferred — "we may add smart detection based on defaults, but not yet."
- Multiple share strategies per source repo (one strategy per project is enough for now)
- PR templates or customizable PR body
