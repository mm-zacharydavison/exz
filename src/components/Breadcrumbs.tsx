import { Box, Text } from "ink";

interface BreadcrumbsProps {
  path: string[];
}

export function Breadcrumbs({ path }: BreadcrumbsProps) {
  const parts = ["exz", ...path];
  return (
    <Box marginBottom={1}>
      <Text dimColor>{parts.join(" > ")}</Text>
    </Box>
  );
}
