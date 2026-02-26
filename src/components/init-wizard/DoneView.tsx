import { Box, Text } from "ink";
import type { WriteInitFilesResult } from "../../core/init-wizard.ts";

export function DoneView({ result }: { result: WriteInitFilesResult }) {
  return (
    <Box flexDirection="column">
      <Text>Created .exz/config.ts</Text>
      {result.sampleCreated && <Text>Created .exz/actions/hello.sh</Text>}
      {result.skillCreated && <Text>Created .claude/skills/exz/SKILL.md</Text>}
      <Text>{"\n"}Done! Run exz again to get started.</Text>
    </Box>
  );
}
