import { Box, Text } from "ink";
import type { WriteInitFilesResult } from "../../core/init-wizard.ts";

export function DoneView({ result }: { result: WriteInitFilesResult }) {
  return (
    <Box flexDirection="column">
      <Text>Created .xcli/config.ts</Text>
      {result.sampleCreated && <Text>Created .xcli/actions/hello.sh</Text>}
      {result.skillCreated && <Text>Created .claude/skills/xcli/SKILL.md</Text>}
      <Text>{"\n"}Done! Run xcli again to get started.</Text>
    </Box>
  );
}
