import { Box, Text } from "ink";

export function StatusBar() {
  const hints = "↑↓/j/k navigate  / search  esc back  q quit";

  return (
    <Box marginTop={1} flexDirection="column">
      <Text dimColor>{hints}</Text>
    </Box>
  );
}
