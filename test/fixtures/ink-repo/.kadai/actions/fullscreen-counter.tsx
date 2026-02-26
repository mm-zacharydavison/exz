// kadai:name Fullscreen Counter
// kadai:description A fullscreen counter component
// kadai:fullscreen true
import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { InkActionProps } from "../../../../src/types.ts";

export default function FullscreenCounter({ onExit }: InkActionProps) {
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
      <Text>Fullscreen Counter: {count}</Text>
      <Text dimColor>Press +/- to change, q to quit</Text>
    </Box>
  );
}
