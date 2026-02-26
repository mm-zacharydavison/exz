import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ─── Init result ──────────────────────────────────────────────────

export interface InitResult {
  xcliDir: string;
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
  const xcliDir = join(cwd, ".xcli");
  const actionsDir = join(xcliDir, "actions");
  mkdirSync(actionsDir, { recursive: true });

  // Sample action
  const sampleAction = join(actionsDir, "hello.sh");
  const sampleFile = Bun.file(sampleAction);
  let sampleCreated = false;
  if (!(await sampleFile.exists())) {
    await Bun.write(
      sampleAction,
      `#!/bin/bash
# xcli:name Hello World
# xcli:emoji 👋
# xcli:description A sample action — edit or delete this file

echo "Hello from xcli!"
echo "Add your own scripts to .xcli/actions/ to get started."
`,
    );
    sampleCreated = true;
  }

  // Config file
  const configContent = generateConfigFile();
  const configPath = join(xcliDir, "config.ts");
  await Bun.write(configPath, configContent);

  // Claude Code skill file — only if the repo uses Claude Code
  let skillCreated = false;
  const hasClaudeDir = existsSync(join(cwd, ".claude"));
  const hasClaudeMd = existsSync(join(cwd, "CLAUDE.md"));
  if (hasClaudeDir || hasClaudeMd) {
    const skillDir = join(cwd, ".claude", "skills", "xcli");
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
name: xcli
description: >-
  xcli is a script runner for this project. Discover available actions with
  xcli list --json, and run them with xcli run <action-id>.
user-invocable: false
---

# xcli — Project Script Runner

xcli manages and runs project-specific shell scripts stored in \`.xcli/actions/\`.

## Discovering Actions

\`\`\`bash
xcli list --json
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

Use \`--all\` to include hidden actions: \`xcli list --json --all\`

Always use \`xcli list --json\` for the current set of actions — do not hardcode action lists.

## Running Actions

\`\`\`bash
xcli run <action-id>
\`\`\`

Runs the action and streams stdout/stderr directly. The process exits with the action's exit code.
Confirmation prompts are automatically skipped in non-TTY environments.

### Examples

\`\`\`bash
xcli run hello
xcli run database/reset
\`\`\`

## Creating Actions

Create a script file in \`.xcli/actions/\`. Supported extensions: \`.sh\`, \`.bash\`, \`.ts\`, \`.js\`, \`.mjs\`, \`.py\`.

Add metadata as comments in the first 20 lines using \`# xcli:<key> <value>\` (for shell/python) or \`// xcli:<key> <value>\` (for JS/TS):

\`\`\`bash
#!/bin/bash
# xcli:name Deploy Staging
# xcli:emoji 🚀
# xcli:description Deploy the app to the staging environment
# xcli:confirm true

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
.xcli/actions/
  hello.sh              → id: "hello"
  database/
    migrate.sh          → id: "database/migrate"
    reset.ts            → id: "database/reset"
\`\`\`
`;
}
