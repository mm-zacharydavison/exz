#!/usr/bin/env bun
import { Readable } from "node:stream";
import { render } from "ink";
import React from "react";
import { App } from "./app.tsx";
import { initXcli } from "./core/init.ts";
import { findXcliDir } from "./core/loader.ts";

const cwd = process.cwd();

let xcliDir = findXcliDir(cwd);
if (!xcliDir) {
  if (!process.stdin.isTTY) {
    // Non-interactive: error out
    process.stderr.write(
      "Error: No .xcli directory found. Create a .xcli/actions/ directory to get started.\n",
    );
    process.exit(1);
  }
  // Interactive: auto-initialize
  console.log("No .xcli directory found. Initializing...");
  xcliDir = await initXcli(cwd);
  console.log("Created .xcli/actions/ with a sample action.\n");
}

let stdinStream: NodeJS.ReadStream;

if (process.stdin.isTTY) {
  stdinStream = process.stdin;
} else {
  // When stdin is piped (e.g. in tests), process.stdin doesn't support raw mode,
  // and data can arrive in multi-character chunks. Ink's parseKeypress expects
  // each keypress to arrive as a separate read() call.
  //
  // Using objectMode so each push() is returned as a separate read() result,
  // preventing multiple characters from being concatenated into one chunk.
  const charStream = new Readable({
    objectMode: true,
    read() {},
  });

  Object.assign(charStream, {
    isTTY: true,
    setRawMode() {},
    ref() {},
    unref() {},
    setEncoding() {
      return charStream;
    },
  });

  // Parse input data into individual keypresses
  const parseKeypresses = (str: string): string[] => {
    const keys: string[] = [];
    let i = 0;
    while (i < str.length) {
      if (str[i] === "\x1b" && i + 1 < str.length && str[i + 1] === "[") {
        const escStart = i;
        i += 2;
        while (
          i < str.length &&
          str.charCodeAt(i) >= 0x30 &&
          str.charCodeAt(i) <= 0x3f
        )
          i++;
        while (
          i < str.length &&
          str.charCodeAt(i) >= 0x20 &&
          str.charCodeAt(i) <= 0x2f
        )
          i++;
        if (
          i < str.length &&
          str.charCodeAt(i) >= 0x40 &&
          str.charCodeAt(i) <= 0x7e
        )
          i++;
        keys.push(str.slice(escStart, i));
      } else if (
        str[i] === "\x1b" &&
        i + 1 < str.length &&
        str[i + 1] === "O"
      ) {
        keys.push(str.slice(i, i + 3));
        i += 3;
      } else {
        keys.push(str[i] as string);
        i++;
      }
    }
    return keys;
  };

  // Queue keypresses and deliver them one at a time across ticks,
  // ensuring each keypress gets its own 'readable' event cycle.
  const queue: string[] = [];
  let draining = false;

  const drainQueue = () => {
    if (queue.length === 0) {
      draining = false;
      return;
    }
    const key = queue.shift() as string;
    charStream.push(key);
    setImmediate(drainQueue);
  };

  process.stdin.on("data", (data: Buffer) => {
    const keys = parseKeypresses(data.toString());
    queue.push(...keys);
    if (!draining) {
      draining = true;
      drainQueue();
    }
  });

  process.stdin.on("end", () => {
    charStream.push(null);
  });

  stdinStream = charStream as unknown as NodeJS.ReadStream;
}

const instance = render(React.createElement(App, { cwd, xcliDir }), {
  stdin: stdinStream,
  stdout: process.stdout,
  stderr: process.stderr,
});

try {
  await instance.waitUntilExit();
  process.exit(0);
} catch {
  process.exit(1);
}
