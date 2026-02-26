---
name: exz
description: >-
  exz is a script runner for this project. Discover available actions with
  exz list --json, and run them with exz run <action-id>.
user-invocable: false
---

# exz — Project Script Runner

exz manages and runs project-specific shell scripts stored in `.exz/actions/`.

## Discovering Actions

```bash
exz list --json
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

Use `--all` to include hidden actions: `exz list --json --all`

Always use `exz list --json` for the current set of actions — do not hardcode action lists.

## Running Actions

```bash
exz run <action-id>
```

Runs the action and streams stdout/stderr directly. The process exits with the action's exit code.
Confirmation prompts are automatically skipped in non-TTY environments.

### Examples

```bash
exz run hello
exz run database/reset
```
