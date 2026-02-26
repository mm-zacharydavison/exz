// kadai:name System Info
// kadai:emoji 🖥️
// kadai:description Fullscreen system information dashboard
// kadai:fullscreen true
import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import type { InkActionProps } from "../../../src/types.ts";

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

function formatBytes(bytes: number): string {
  const gb = bytes / 1024 / 1024 / 1024;
  return `${gb.toFixed(1)} GB`;
}

interface SystemData {
  platform: string;
  arch: string;
  nodeVersion: string;
  bunVersion: string;
  cpus: number;
  totalMem: string;
  freeMem: string;
  uptime: string;
  cwd: string;
  pid: number;
}

function gatherSystemData(cwd: string): SystemData {
  const os = require("node:os");
  return {
    platform: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    nodeVersion: process.version,
    bunVersion: typeof Bun !== "undefined" ? Bun.version : "N/A",
    cpus: os.cpus().length,
    totalMem: formatBytes(os.totalmem()),
    freeMem: formatBytes(os.freemem()),
    uptime: formatUptime(os.uptime()),
    cwd,
    pid: process.pid,
  };
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Box width={16}>
        <Text dimColor>{label}</Text>
      </Box>
      <Text>{value}</Text>
    </Box>
  );
}

export default function SystemInfo({ cwd, onExit }: InkActionProps) {
  const [data, setData] = useState<SystemData | null>(null);
  const [tick, setTick] = useState(0);

  useInput((input, key) => {
    if (input === "q" || key.escape) {
      onExit();
    }
    if (input === "r") {
      setTick((t) => t + 1);
    }
  });

  useEffect(() => {
    setData(gatherSystemData(cwd));
  }, [cwd, tick]);

  if (!data) {
    return <Text dimColor>Loading...</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text bold>System Information</Text>
      <Text dimColor>{"═".repeat(40)}</Text>
      <Box flexDirection="column" marginTop={1}>
        <Row label="Platform" value={data.platform} />
        <Row label="Architecture" value={data.arch} />
        <Row label="Bun" value={data.bunVersion} />
        <Row label="Node" value={data.nodeVersion} />
        <Row label="CPUs" value={String(data.cpus)} />
        <Row label="Total Memory" value={data.totalMem} />
        <Row label="Free Memory" value={data.freeMem} />
        <Row label="Uptime" value={data.uptime} />
        <Row label="Working Dir" value={data.cwd} />
        <Row label="PID" value={String(data.pid)} />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>r refresh  q quit</Text>
      </Box>
    </Box>
  );
}
