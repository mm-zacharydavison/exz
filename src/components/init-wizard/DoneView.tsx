import { Box, Text } from "ink";
import type { WriteInitFilesResult } from "../../core/init-wizard.ts";

export function DoneView({ result }: { result: WriteInitFilesResult }) {
  return (
    <Box flexDirection="column">
      <Text>Created .zcli/config.ts</Text>
      {result.sampleCreated && <Text>Created .zcli/actions/hello.sh</Text>}
      {result.skillCreated && <Text>Created .claude/skills/zcli/SKILL.md</Text>}
      <Text>{"\n"}Done! Run zcli again to get started.</Text>
    </Box>
  );
}
