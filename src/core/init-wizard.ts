import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ─── Init result ──────────────────────────────────────────────────

export interface InitResult {
  exzDir: string;
}

// ─── Config file generation ───────────────────────────────────────

export function generateConfigFile(): string {
  const lines = ['  // actionsDir: "actions",', "  // env: {},"];

  return `export default {\n${lines.join("\n")}\n};\n`;
}

// ─── File writing (used by InitWizard component) ─────────────────

export interface WriteInitFilesResult {
  sampleCreated: boolean;
  skillCreated: boolean;
}

export async function writeInitFiles(
  cwd: string,
): Promise<WriteInitFilesResult> {
  const exzDir = join(cwd, ".exz");
  const actionsDir = join(exzDir, "actions");
  mkdirSync(actionsDir, { recursive: true });

  // Sample action
  const sampleAction = join(actionsDir, "hello.sh");
  const sampleFile = Bun.file(sampleAction);
  let sampleCreated = false;
  if (!(await sampleFile.exists())) {
    await Bun.write(
      sampleAction,
      `#!/bin/bash
# exz:name Hello World
# exz:emoji 👋
# exz:description A sample action — edit or delete this file

echo "Hello from exz!"
echo "Add your own scripts to .exz/actions/ to get started."
`,
    );
    sampleCreated = true;
  }

  // Config file
  const configContent = generateConfigFile();
  const configPath = join(exzDir, "config.ts");
  await Bun.write(configPath, configContent);

  // Claude Code skill file — only if the repo uses Claude Code
  let skillCreated = false;
  const hasClaudeDir = existsSync(join(cwd, ".claude"));
  const hasClaudeMd = existsSync(join(cwd, "CLAUDE.md"));
  if (hasClaudeDir || hasClaudeMd) {
    const skillDir = join(cwd, ".claude", "skills", "exz");
    const skillPath = join(skillDir, "SKILL.md");
    if (!(await Bun.file(skillPath).exists())) {
      mkdirSync(skillDir, { recursive: true });
      await Bun.write(skillPath, generateSkillFile());
      skillCreated = true;
    }
  }

  return { sampleCreated, skillCreated };
}

function generateSkillFile(): string {
  return `---
name: exz
description: >-
  exz is a script runner for this project. Discover available actions with
  exz list --json, and run them with exz run <action-id>.
user-invocable: false
---

# exz — Project Script Runner

exz manages and runs project-specific shell scripts stored in \`.exz/actions/\`.

## Discovering Actions

\`\`\`bash
exz list --json
\`\`\`

Returns a JSON array of available actions:

\`\`\`json
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
\`\`\`

Use \`--all\` to include hidden actions: \`exz list --json --all\`

Always use \`exz list --json\` for the current set of actions — do not hardcode action lists.

## Running Actions

\`\`\`bash
exz run <action-id>
\`\`\`

Runs the action and streams stdout/stderr directly. The process exits with the action's exit code.
Confirmation prompts are automatically skipped in non-TTY environments.

### Examples

\`\`\`bash
exz run hello
exz run database/reset
\`\`\`

## Creating Actions

Create a script file in \`.exz/actions/\`. Supported extensions: \`.sh\`, \`.bash\`, \`.ts\`, \`.js\`, \`.mjs\`, \`.py\`.

Add metadata as comments in the first 20 lines using \`# exz:<key> <value>\` (for shell/python) or \`// exz:<key> <value>\` (for JS/TS):

\`\`\`bash
#!/bin/bash
# exz:name Deploy Staging
# exz:emoji 🚀
# exz:description Deploy the app to the staging environment
# exz:confirm true

echo "Deploying..."
\`\`\`

Available metadata keys:

| Key           | Description                                 |
|---------------|---------------------------------------------|
| \`name\`        | Display name in menus                       |
| \`emoji\`       | Emoji prefix                                |
| \`description\` | Short description                           |
| \`confirm\`     | Require confirmation before running (true/false) |
| \`hidden\`      | Hide from default listing (true/false)      |

If \`name\` is omitted, it is inferred from the filename (e.g. \`deploy-staging.sh\` → "Deploy Staging").

Organize actions into categories using subdirectories:

\`\`\`
.exz/actions/
  hello.sh              → id: "hello"
  database/
    migrate.sh          → id: "database/migrate"
    reset.ts            → id: "database/reset"
\`\`\`
`;
}
