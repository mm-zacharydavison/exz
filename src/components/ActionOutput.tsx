import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import { runAction } from "../core/runner.ts";
import type { Action, XcliConfig } from "../types.ts";

interface ActionOutputProps {
  action: Action;
  cwd: string;
  config?: XcliConfig;
  onDone?: () => void;
}

export function ActionOutput({ action, cwd, config }: ActionOutputProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    const handle = runAction(action, { cwd, config });

    const readStream = async (stream: ReadableStream<Uint8Array>) => {
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          const newLines = text.split("\n").filter((l) => l.length > 0);
          if (newLines.length > 0) {
            setLines((prev) => [...prev, ...newLines]);
          }
        }
      } catch {
        // Stream closed
      }
    };

    readStream(handle.stdout);
    readStream(handle.stderr);

    handle.proc.exited.then((code) => {
      setExitCode(code);
      setRunning(false);
    });

    return () => {
      try {
        handle.proc.kill();
      } catch {
        // Already dead
      }
    };
  }, [action.id, config, action, cwd]);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>
          {action.meta.emoji ? `${action.meta.emoji} ` : ""}
          {action.meta.name}
        </Text>
      </Box>
      {lines.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
      {running && <Text dimColor>Running...</Text>}
      {!running && exitCode !== null && (
        <Box marginTop={1}>
          <Text color={exitCode === 0 ? "green" : "red"}>
            {exitCode === 0 ? "✓" : "✗"} exit code {exitCode}
          </Text>
        </Box>
      )}
    </Box>
  );
}
