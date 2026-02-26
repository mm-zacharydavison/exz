---
name: xcli
description: >-
  xcli is a script runner for this project. Discover available actions with
  xcli list --json, and run them with xcli run <action-id>.
user-invocable: false
---

# xcli — Project Script Runner

xcli manages and runs project-specific shell scripts stored in `.xcli/actions/`.

## Discovering Actions

```bash
xcli list --json
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

Use `--all` to include hidden actions: `xcli list --json --all`

Always use `xcli list --json` for the current set of actions — do not hardcode action lists.

## Running Actions

```bash
xcli run <action-id>
```

Runs the action and streams stdout/stderr directly. The process exits with the action's exit code.
Confirmation prompts are automatically skipped in non-TTY environments.

### Examples

```bash
xcli run hello
xcli run database/reset
```
