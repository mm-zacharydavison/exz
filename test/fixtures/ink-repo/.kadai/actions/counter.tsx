// kadai:name Counter
// kadai:description A simple counter component
import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { InkActionProps } from "../../../../src/types.ts";

export default function Counter({ onExit }: InkActionProps) {
  const [count, setCount] = useState(0);

  useInput((input, key) => {
    if (input === "+" || key.upArrow) {
      setCount((c) => c + 1);
    }
    if (input === "-" || key.downArrow) {
      setCount((c) => c - 1);
    }
    if (input === "q" || key.escape) {
      onExit();
    }
  });

  return (
    <Box flexDirection="column">
      <Text>Counter: {count}</Text>
      <Text dimColor>Press +/- to change, q to quit</Text>
    </Box>
  );
}
