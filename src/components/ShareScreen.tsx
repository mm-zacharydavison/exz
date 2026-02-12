import { Box, Text, useInput } from "ink";
import { useEffect, useRef, useState } from "react";
import { runAction } from "../core/runner.ts";
import type { Action, SourceConfig, XcliConfig } from "../types.ts";

type Step = "test-run" | "test-run-output" | "pick-source" | "pick-path";

interface ShareScreenProps {
  newActions: Action[];
  sources: SourceConfig[];
  org?: string;
  userName?: string;
  cwd: string;
  config?: XcliConfig;
  existingDirs: string[];
  onDone: (result?: { source?: SourceConfig; targetPath: string }) => void;
}

export function ShareScreen({
  newActions,
  sources,
  org,
  userName,
  cwd,
  config,
  existingDirs,
  onDone,
}: ShareScreenProps) {
  const afterTestRun: Step = sources.length > 0 ? "pick-source" : "pick-path";
  const initialStep: Step = newActions.length > 0 ? "test-run" : afterTestRun;

  const [step, setStep] = useState<Step>(initialStep);
  const stepRef = useRef(step);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedIndexRef = useRef(selectedIndex);
  const [selectedSource, setSelectedSource] = useState<SourceConfig | null>(
    null,
  );
  const selectedSourceRef = useRef(selectedSource);
  const [customPath, setCustomPath] = useState("");
  const customPathRef = useRef(customPath);

  // Test-run state
  const [testRunIndex, setTestRunIndex] = useState(0);
  const testRunIndexRef = useRef(testRunIndex);
  const [testRunLines, setTestRunLines] = useState<string[]>([]);
  const [testRunDone, setTestRunDone] = useState(false);
  const testRunDoneRef = useRef(testRunDone);
  const [testRunExitCode, setTestRunExitCode] = useState<number | null>(null);

  const defaultPath = buildDefaultPath(org, userName);

  const sourceOptions = [
    { label: "Keep in .xcli", value: undefined as string | undefined },
    ...sources.map((s) => ({ label: `Push to ${s.repo}`, value: s.repo })),
  ];

  const pathOptions = buildPathOptions(defaultPath, org, existingDirs);

  const updateStep = (s: Step) => {
    stepRef.current = s;
    setStep(s);
  };
  const updateIndex = (i: number) => {
    selectedIndexRef.current = i;
    setSelectedIndex(i);
  };
  const updateSource = (s: SourceConfig | null) => {
    selectedSourceRef.current = s;
    setSelectedSource(s);
  };
  const updateCustomPath = (p: string) => {
    customPathRef.current = p;
    setCustomPath(p);
  };
  const updateTestRunIndex = (i: number) => {
    testRunIndexRef.current = i;
    setTestRunIndex(i);
  };
  const updateTestRunDone = (d: boolean) => {
    testRunDoneRef.current = d;
    setTestRunDone(d);
  };

  const advancePastTestRun = () => {
    updateStep(afterTestRun);
    updateIndex(0);
  };

  const advanceToNextAction = () => {
    const nextIndex = testRunIndexRef.current + 1;
    if (nextIndex >= newActions.length) {
      advancePastTestRun();
    } else {
      updateTestRunIndex(nextIndex);
      updateStep("test-run");
      setTestRunLines([]);
      updateTestRunDone(false);
      setTestRunExitCode(null);
    }
  };

  const startTestRun = () => {
    updateStep("test-run-output");
  };

  // Run action only when user confirms (step = "test-run-output")
  useEffect(() => {
    if (step !== "test-run-output") return;
    if (testRunIndex >= newActions.length) return;

    const action = newActions[testRunIndex];
    if (!action) return;

    let aborted = false;

    setTestRunLines([]);
    testRunDoneRef.current = false;
    setTestRunDone(false);
    setTestRunExitCode(null);

    let handle: ReturnType<typeof runAction>;
    try {
      handle = runAction(action, { cwd, config });
    } catch {
      testRunDoneRef.current = true;
      setTestRunDone(true);
      setTestRunExitCode(-1);
      return;
    }

    const readStream = async (stream: ReadableStream<Uint8Array>) => {
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done || aborted) break;
          const text = decoder.decode(value);
          const newLines = text.split("\n").filter((l) => l.length > 0);
          if (newLines.length > 0) {
            setTestRunLines((prev) => [...prev, ...newLines]);
          }
        }
      } catch {
        // Stream closed
      }
    };

    readStream(handle.stdout);
    readStream(handle.stderr);

    handle.proc.exited.then((code) => {
      if (aborted) return;
      setTestRunExitCode(code);
      testRunDoneRef.current = true;
      setTestRunDone(true);
    });

    return () => {
      aborted = true;
      try {
        handle.proc.kill();
      } catch {
        // Already dead
      }
    };
  }, [step, testRunIndex, cwd, config, newActions]);

  useInput((input, key) => {
    const curStep = stepRef.current;
    const curIndex = selectedIndexRef.current;

    // Test-run prompt (before running)
    if (curStep === "test-run") {
      if (key.return) {
        startTestRun();
        return;
      }
      if (input === "s" || key.escape) {
        advancePastTestRun();
        return;
      }
      return;
    }

    // Test-run output (action is running or finished)
    if (curStep === "test-run-output") {
      if (input === "s" || key.escape) {
        advancePastTestRun();
        return;
      }
      if (key.return && testRunDoneRef.current) {
        advanceToNextAction();
        return;
      }
      return;
    }

    if (key.escape) {
      if (curStep === "pick-path") {
        if (sources.length > 0) {
          updateStep("pick-source");
          updateIndex(0);
          return;
        }
        onDone();
        return;
      }
      onDone();
      return;
    }

    // Pick-path step
    if (curStep === "pick-path") {
      const isOnCustom = curIndex === pathOptions.length - 1;

      if (isOnCustom) {
        if (key.return) {
          const path = customPathRef.current.trim();
          if (path) {
            const source = selectedSourceRef.current;
            onDone({ source: source ?? undefined, targetPath: path });
          }
          return;
        }
        if (key.backspace || key.delete) {
          updateCustomPath(customPathRef.current.slice(0, -1));
          return;
        }
        if (key.upArrow) {
          updateIndex(Math.max(0, curIndex - 1));
          return;
        }
        // Printable chars go into the text field
        if (!key.ctrl && !key.meta && input && !key.downArrow) {
          updateCustomPath(customPathRef.current + input);
          return;
        }
        return;
      }

      if (key.return) {
        const selected = pathOptions[curIndex];
        if (selected) {
          const source = selectedSourceRef.current;
          onDone({
            source: source ?? undefined,
            targetPath: selected.value,
          });
        }
        return;
      }

      if (key.upArrow || input === "k") {
        updateIndex(Math.max(0, curIndex - 1));
        return;
      }
      if (key.downArrow || input === "j") {
        updateIndex(Math.min(pathOptions.length - 1, curIndex + 1));
        return;
      }
      return;
    }

    // Pick-source step
    if (curStep === "pick-source") {
      if (key.return) {
        const selected = sourceOptions[curIndex];
        if (!selected?.value) {
          updateSource(null);
        } else {
          const source = sources.find((s) => s.repo === selected.value);
          updateSource(source ?? null);
        }
        updateIndex(0);
        updateStep("pick-path");
        return;
      }

      if (key.upArrow || input === "k") {
        updateIndex(Math.max(0, curIndex - 1));
        return;
      }
      if (key.downArrow || input === "j") {
        updateIndex(Math.min(sourceOptions.length - 1, curIndex + 1));
        return;
      }
    }
  });

  // Render test-run prompt (before running)
  if (step === "test-run") {
    const action = newActions[testRunIndex];
    if (!action) return null;

    const total = newActions.length;
    const current = testRunIndex + 1;

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>
            Test run ({current}/{total})
          </Text>
        </Box>

        <Text>
          {action.meta.emoji ? `${action.meta.emoji} ` : ""}
          {action.meta.name}
          {action.meta.description && (
            <Text dimColor> ({action.meta.description})</Text>
          )}
        </Text>

        <Box marginTop={1}>
          <Text dimColor>Press enter to run, s to skip</Text>
        </Box>
      </Box>
    );
  }

  // Render test-run output (action running or finished)
  if (step === "test-run-output") {
    const action = newActions[testRunIndex];
    if (!action) return null;

    const total = newActions.length;
    const current = testRunIndex + 1;

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>
            Test run ({current}/{total})
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text bold>
            {action.meta.emoji ? `${action.meta.emoji} ` : ""}
            {action.meta.name}
          </Text>
        </Box>

        {testRunLines.map((line, i) => (
          <Text key={`${i}`}>{line}</Text>
        ))}

        {!testRunDone && <Text dimColor>Running...</Text>}
        {testRunDone && testRunExitCode !== null && (
          <Box marginTop={1}>
            <Text color={testRunExitCode === 0 ? "green" : "red"}>
              {testRunExitCode === 0 ? "✓" : "✗"} exit code {testRunExitCode}
            </Text>
          </Box>
        )}

        <Box marginTop={1}>
          <Text dimColor>
            {testRunDone
              ? testRunIndex < newActions.length - 1
                ? "Press enter to continue, s to skip remaining"
                : "Press enter to continue"
              : "Running... press s to skip"}
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>New actions created:</Text>
      </Box>

      {newActions.map((action) => (
        <Box key={action.id}>
          <Text>
            {"  "}✦ {action.meta.emoji ? `${action.meta.emoji} ` : ""}
            {action.meta.name}
          </Text>
          <Text dimColor>{`  (${action.filePath})`}</Text>
        </Box>
      ))}

      {step === "pick-source" && (
        <Box marginTop={1} flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Share to:</Text>
          </Box>
          {sourceOptions.map((opt, i) => (
            <Text
              key={opt.label}
              color={i === selectedIndex ? "cyan" : undefined}
            >
              {i === selectedIndex ? "❯ " : "  "}
              {opt.label}
            </Text>
          ))}
        </Box>
      )}

      {step === "pick-path" && (
        <Box marginTop={1} flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Destination path:</Text>
          </Box>
          {pathOptions.map((opt, i) => {
            if (opt.value === "__custom__") {
              const isSelected = i === selectedIndex;
              return (
                <Box key="__custom__">
                  <Text color={isSelected ? "cyan" : undefined}>
                    {isSelected ? "❯ " : "  "}
                  </Text>
                  {customPath ? (
                    <Text color={isSelected ? "cyan" : undefined}>
                      {customPath}
                    </Text>
                  ) : (
                    <Text dimColor>actions/your/path</Text>
                  )}
                  {isSelected && <Text dimColor>█</Text>}
                </Box>
              );
            }
            return (
              <Text
                key={opt.label}
                color={i === selectedIndex ? "cyan" : undefined}
              >
                {i === selectedIndex ? "❯ " : "  "}
                {opt.label}
              </Text>
            );
          })}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          {step === "pick-path" && selectedIndex === pathOptions.length - 1
            ? "Type a path, enter to confirm, esc to go back"
            : "Press enter to confirm, esc to go back"}
        </Text>
      </Box>
    </Box>
  );
}

function buildDefaultPath(org?: string, userName?: string): string {
  if (!org) return "actions";
  const parts = ["actions", `@${org}`];
  if (userName) parts.push(userName);
  return parts.join("/");
}

function buildPathOptions(
  defaultPath: string,
  org?: string,
  existingDirs: string[] = [],
): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = [];
  const seen = new Set<string>();

  // Default org path (only when org exists)
  if (org && defaultPath !== "actions") {
    options.push({ label: defaultPath, value: defaultPath });
    seen.add(defaultPath);
  }

  // Root level
  if (!seen.has("actions")) {
    options.push({ label: "actions/", value: "actions" });
    seen.add("actions");
  }

  // Existing directories
  for (const dir of existingDirs) {
    const path = `actions/${dir}`;
    if (!seen.has(path)) {
      options.push({ label: `actions/${dir}/`, value: path });
      seen.add(path);
    }
  }

  // Custom text field (always last)
  options.push({ label: "__custom__", value: "__custom__" });

  return options;
}
