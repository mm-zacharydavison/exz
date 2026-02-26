---
name: menux
description: >-
  menux is a script runner for this project. Discover available actions with
  menux list --json, and run them with menux run <action-id>.
user-invocable: false
---

# menux — Project Script Runner

menux manages and runs project-specific shell scripts stored in `.menux/actions/`.

## Discovering Actions

```bash
menux list --json
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

Use `--all` to include hidden actions: `menux list --json --all`

Always use `menux list --json` for the current set of actions — do not hardcode action lists.

## Running Actions

```bash
menux run <action-id>
```

Runs the action and streams stdout/stderr directly. The process exits with the action's exit code.
Confirmation prompts are automatically skipped in non-TTY environments.

### Examples

```bash
menux run hello
menux run database/reset
```
