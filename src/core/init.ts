import { mkdirSync } from "node:fs";
import { join } from "node:path";

export async function initXcli(cwd: string): Promise<string> {
  const xcliDir = join(cwd, ".xcli");
  const actionsDir = join(xcliDir, "actions");

  mkdirSync(actionsDir, { recursive: true });

  // Create a sample hello-world action
  const sampleAction = join(actionsDir, "hello.sh");
  const sampleFile = Bun.file(sampleAction);
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
  }

  return xcliDir;
}
