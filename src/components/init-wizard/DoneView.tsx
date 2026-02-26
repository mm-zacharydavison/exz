import { Box, Text } from "ink";
import type { WriteInitFilesResult } from "../../core/init-wizard.ts";

export function DoneView({ result }: { result: WriteInitFilesResult }) {
  return (
    <Box flexDirection="column">
      <Text>Created .menux/config.ts</Text>
      {result.sampleCreated && <Text>Created .menux/actions/hello.sh</Text>}
      {result.skillCreated && <Text>Created .claude/skills/menux/SKILL.md</Text>}
      <Text>{"\n"}Done! Run menux again to get started.</Text>
    </Box>
  );
}
