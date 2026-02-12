import { Box, Text } from "ink";

export function StatusBar() {
  return (
    <Box marginTop={1}>
      <Text dimColor>{"↑↓/j/k navigate  / search  esc back  q quit"}</Text>
    </Box>
  );
}
