---
name: kadai
description: >-
  kadai is a script runner for this project. Discover available actions with
  kadai list --json, and run them with kadai run <action-id>.
user-invocable: false
---

# kadai — Project Script Runner

kadai manages and runs project-specific shell scripts stored in `.kadai/actions/`.

**Important**: Always invoke kadai via `bunx kadai` or `npx kadai` since it is typically not installed globally. Prefer `bunx` if available, fall back to `npx`.

## Discovering Actions

```bash
bunx kadai list --json
# or
npx kadai list --json
```

Returns a JSON array of available actions:

```json
[
  {
    "id": "database/reset",
    "name": "Reset Database",
    "emoji": "🗑️",
    "description": "Drop and recreate the dev database",
    "category": ["database"],
    "runtime": "bash",
    "confirm": true
  }
]
```

Use `--all` to include hidden actions: `bunx kadai list --json --all` (or `npx kadai list --json --all`)

Always use `kadai list --json` (via `bunx` or `npx`) for the current set of actions — do not hardcode action lists.

## Running Actions

```bash
bunx kadai run <action-id>
# or
npx kadai run <action-id>
```

Runs the action and streams stdout/stderr directly. The process exits with the action's exit code.
Confirmation prompts are automatically skipped in non-TTY environments.

### Examples

```bash
bunx kadai run hello
bunx kadai run database/reset
# or with npx
npx kadai run hello
npx kadai run database/reset
```
