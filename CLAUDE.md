# CLAUDE.md

NOT-RELEASED

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install              # Install dependencies
bun test                 # Run all tests
bun test test/loader.test.ts  # Run a single test file
bun run check            # TypeScript type-check + Biome lint
bun run lint             # Biome lint only
bun run lint:fix         # Biome auto-fix
bun src/cli.tsx          # Run the CLI locally
```

## What This Project Is

exz is an interactive terminal tool for discovering and running shell scripts stored in `.exz/actions/`. It provides a menu-driven UI with fuzzy search and supports multiple script runtimes (bash, TypeScript, Python, JS). Actions are local-only — no external sources, no AI generation.

## Architecture

**Entry point**: `src/cli.tsx` — finds `.exz` dir (searching upward from cwd), runs init wizard if missing, then renders the Ink app and exits when done.

**Core modules** (`src/core/`):
- `loader.ts` — Recursively scans `.exz/actions/` for scripts (up to 4 levels deep), extracts metadata, builds action list. Also fetches git-based "added at" timestamps for the "New" indicator.
- `runner.ts` — Executes actions via `Bun.spawn()` with three-tier command resolution: shebang → runtime chain → fallback. Injects config env vars.
- `config.ts` — Loads `.exz/config.ts` (`actionsDir`, `env`)
- `metadata.ts` — Parses comment frontmatter (`# exz:name`, `// exz:emoji`, etc.) from the first 20 lines. Falls back to inferring name from filename.
- `init-wizard.ts` — Creates `.exz/actions/` dir, sample action, and config file.

**UI layer** (`src/app.tsx` + `src/components/` + `src/hooks/`):
- React/Ink terminal app with screen stack navigation (menu → confirm → output)
- Hooks: `useActions` (load actions), `useNavigation` (screen stack), `useSearch` (fuzzy search via fuzzysort), `useKeyboard` (input handling)
- `buildMenuItems()` in `app.tsx` builds the hierarchical menu with categories, sorting, and "New" section

**Types**: `src/types.ts` — All shared interfaces (`Action`, `ActionMeta`, `MenuItem`, `Screen`, `ExzConfig`, `Runtime`)

## Testing

Tests use `bun:test` with `ink-testing-library` for component tests. `test/harness.ts` provides a CLI spawning harness for integration tests. Fixture repos live in `test/fixtures/`.

## Code Style

- Biome for formatting (2-space indent, double quotes) and linting
- TypeScript strict mode, JSX with automatic React runtime
- Bun as sole runtime — no Node.js, no express, no webpack
