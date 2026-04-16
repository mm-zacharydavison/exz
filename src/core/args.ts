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
      if (rest.length === 0 || rest[0]!.startsWith("-")) {
        return { type: "error", message: "Usage: kadai run <action ID>" };
      }

      if (rest.length === 1) {
        return { type: "run", actionId: rest[0]! };
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
          ids.push(rest[i]!);
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
      if (command.startsWith("-")) {
        return {
          type: "error",
          message: `Unknown flag: ${command}. Available commands: list, run, sync, mcp, --version, --rerun`,
        };
      }
      return { type: "run", actionId: command };
  }
}
