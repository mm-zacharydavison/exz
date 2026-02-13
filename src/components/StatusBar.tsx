import { Box, Text } from "ink";

interface StatusBarProps {
  syncing?: boolean;
  aiEnabled?: boolean;
  hasSources?: boolean;
}

export function StatusBar({
  syncing,
  aiEnabled = true,
  hasSources = false,
}: StatusBarProps) {
  const parts = ["↑↓/j/k navigate", "/ search"];
  if (hasSources) parts.push("s share");
  if (aiEnabled) parts.push("n new (🤖)");
  parts.push("esc back", "q quit");
  const hints = parts.join("  ");

  return (
    <Box marginTop={1} flexDirection="column">
      <Text dimColor>{hints}</Text>
      {syncing && <Text dimColor>{"⟳ Syncing sources..."}</Text>}
    </Box>
  );
}
