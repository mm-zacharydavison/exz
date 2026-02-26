---
name: zcli
description: >-
  zcli is a script runner for this project. Discover available actions with
  zcli list --json, and run them with zcli run <action-id>.
user-invocable: false
---

# zcli — Project Script Runner

zcli manages and runs project-specific shell scripts stored in `.zcli/actions/`.

## Discovering Actions

```bash
zcli list --json
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

Use `--all` to include hidden actions: `zcli list --json --all`

Always use `zcli list --json` for the current set of actions — do not hardcode action lists.

## Running Actions

```bash
zcli run <action-id>
```

Runs the action and streams stdout/stderr directly. The process exits with the action's exit code.
Confirmation prompts are automatically skipped in non-TTY environments.

### Examples

```bash
zcli run hello
zcli run database/reset
```
