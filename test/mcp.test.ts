import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  actionIdToToolName,
  ensureMcpConfig,
  toolNameToActionId,
} from "../src/core/mcp.ts";
import { fixturePath } from "./harness.ts";

describe("actionIdToToolName / toolNameToActionId", () => {
  test("converts slashes to double-dashes", () => {
    expect(actionIdToToolName("database/reset")).toBe("database--reset");
  });

  test("leaves simple names unchanged", () => {
    expect(actionIdToToolName("hello")).toBe("hello");
  });

  test("handles deeply nested IDs", () => {
    expect(actionIdToToolName("a/b/c")).toBe("a--b--c");
  });

  test("round-trips correctly", () => {
    const ids = ["hello", "database/reset", "dev/docker/up"];
    for (const id of ids) {
      expect(toolNameToActionId(actionIdToToolName(id))).toBe(id);
    }
  });
});

describe("ensureMcpConfig", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "kadai-mcp-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("creates .mcp.json when missing", async () => {
    await ensureMcpConfig(tempDir);

    const content = await Bun.file(join(tempDir, ".mcp.json")).json();
    expect(content.mcpServers).toBeDefined();
    expect(content.mcpServers.kadai).toBeDefined();
    expect(content.mcpServers.kadai.command).toBeString();
    expect(content.mcpServers.kadai.args).toContain("mcp");
  });

  test("merges into existing .mcp.json without clobbering", async () => {
    const existing = {
      mcpServers: {
        other: { command: "other-tool", args: ["serve"] },
      },
    };
    await Bun.write(
      join(tempDir, ".mcp.json"),
      JSON.stringify(existing, null, 2),
    );

    await ensureMcpConfig(tempDir);

    const content = await Bun.file(join(tempDir, ".mcp.json")).json();
    expect(content.mcpServers.other).toEqual({
      command: "other-tool",
      args: ["serve"],
    });
    expect(content.mcpServers.kadai).toBeDefined();
    expect(content.mcpServers.kadai.args).toContain("mcp");
  });

  test("is a no-op when kadai entry already exists", async () => {
    const existing = {
      mcpServers: {
        kadai: { command: "custom-kadai", args: ["mcp", "--custom"] },
      },
    };
    const json = JSON.stringify(existing, null, 2);
    await Bun.write(join(tempDir, ".mcp.json"), json);

    await ensureMcpConfig(tempDir);

    // File should be untouched — existing kadai config is preserved as-is
    const raw = await Bun.file(join(tempDir, ".mcp.json")).text();
    expect(raw).toBe(json);
  });
});

const CLI_ENTRY = join(import.meta.dir, "..", "src", "cli.tsx");

/** Spawn kadai mcp and perform the MCP handshake, returning a tools/list result. */
async function mcpToolsList(cwd: string): Promise<{
  tools: Array<{ name: string; description: string }>;
  proc: ReturnType<typeof Bun.spawn>;
}> {
  const proc = Bun.spawn(["bun", CLI_ENTRY, "mcp"], {
    cwd,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });

  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const readUntilJson = async (
    expectedId: number,
  ): Promise<Record<string, unknown>> => {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const { done, value } = await reader.read();
      if (done) {
        throw new Error(
          `stdout closed waiting for id=${expectedId}\nbuffer: ${buffer}`,
        );
      }
      buffer += decoder.decode(value);
      const lines = buffer.split("\n");
      for (let i = 0; i < lines.length - 1; i++) {
        const line = (lines[i] as string).trim();
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id === expectedId) return msg;
        } catch {
          // Not JSON, skip
        }
      }
      buffer = lines[lines.length - 1] as string;
    }
    throw new Error(`Timed out waiting for response id=${expectedId}`);
  };

  const send = (msg: Record<string, unknown>) => {
    proc.stdin.write(`${JSON.stringify(msg)}\n`);
    proc.stdin.flush();
  };

  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "0.0.1" },
    },
  });
  await readUntilJson(1);

  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list" });

  const response = await readUntilJson(2);
  if (response.error) {
    throw new Error(`MCP error: ${JSON.stringify(response.error)}`);
  }
  const result = response.result as {
    tools: Array<{ name: string; description: string }>;
  };

  return { tools: result.tools, proc };
}

describe("MCP server integration", () => {
  afterEach(async () => {
    // Clean up .mcp.json created by ensureMcpConfig during the test
    try {
      await unlink(join(fixturePath("basic-repo"), ".mcp.json"));
    } catch {
      // Already cleaned or never created
    }
  });

  test("responds to tools/list with actions from fixture", async () => {
    const { tools, proc } = await mcpToolsList(fixturePath("basic-repo"));

    expect(tools).toBeArray();
    expect(tools.length).toBeGreaterThan(0);

    const toolNames = tools.map((t) => t.name);
    // basic-repo has hello, greet, cleanup, secret-tool, database/reset
    expect(toolNames).toContain("hello");
    expect(toolNames).toContain("greet");
    expect(toolNames).toContain("database--reset");

    // Hidden action (.hidden) should not appear
    expect(toolNames).not.toContain(".hidden");

    proc.kill();
  }, 15000);

  test("starts and creates .mcp.json when no .kadai/ directory exists", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "kadai-mcp-no-kadai-"));

    try {
      const proc = Bun.spawn(["bun", CLI_ENTRY, "mcp"], {
        cwd: tempDir,
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });

      // Send initialize — the server should respond even with zero tools
      const initRequest = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test", version: "0.0.1" },
        },
      });
      proc.stdin.write(`${initRequest}\n`);
      proc.stdin.flush();

      // Read the initialize response
      const reader = proc.stdout.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const deadline = Date.now() + 10000;
      let initResponse: Record<string, unknown> | null = null;

      while (Date.now() < deadline) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value);
        const lines = buffer.split("\n");
        for (let i = 0; i < lines.length - 1; i++) {
          const line = (lines[i] as string).trim();
          if (!line) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.id === 1) {
              initResponse = msg;
              break;
            }
          } catch {
            // Not JSON
          }
        }
        if (initResponse) break;
        buffer = lines[lines.length - 1] as string;
      }

      expect(initResponse).not.toBeNull();
      expect((initResponse as Record<string, unknown>).result).toBeDefined();

      // .mcp.json should be created
      const mcpJson = await Bun.file(join(tempDir, ".mcp.json")).json();
      expect(mcpJson.mcpServers.kadai).toBeDefined();
      expect(mcpJson.mcpServers.kadai.args).toContain("mcp");

      proc.kill();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 15000);
});
