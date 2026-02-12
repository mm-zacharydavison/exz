import fuzzysort from "fuzzysort";
import { Box, Text, useApp, useInput } from "ink";
import { useEffect, useRef, useState } from "react";
import { ActionOutput } from "./components/ActionOutput.tsx";
import { Breadcrumbs } from "./components/Breadcrumbs.tsx";
import { StatusBar } from "./components/StatusBar.tsx";
import { loadConfig } from "./core/config.ts";
import { loadActions } from "./core/loader.ts";
import type { Action, MenuItem, Screen, XcliConfig } from "./types.ts";

interface AppProps {
  cwd: string;
  xcliDir: string;
}

export function App({ cwd, xcliDir }: AppProps) {
  const { exit } = useApp();
  const [actions, setActions] = useState<Action[]>([]);
  const [config, setConfig] = useState<XcliConfig>({});
  const [stack, setStack] = useState<Screen[]>([{ type: "menu", path: [] }]);
  const [loading, setLoading] = useState(true);

  // Search state (persists across renders, managed via refs for synchronous access)
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const searchActiveRef = useRef(false);
  const searchQueryRef = useRef("");
  const selectedIndexRef = useRef(0);
  const stackRef = useRef(stack);
  const actionsRef = useRef(actions);

  // Keep refs in sync
  stackRef.current = stack;
  actionsRef.current = actions;

  // Stack is always non-empty (initialized with root menu, never popped below 1)
  const currentScreen = stack.at(-1) as Screen;

  useEffect(() => {
    (async () => {
      const cfg = await loadConfig(xcliDir);
      setConfig(cfg);

      const actionsDir = require("node:path").join(
        xcliDir,
        cfg.actionsDir ?? "actions",
      );
      const discovered = await loadActions(actionsDir);
      setActions(discovered);
      setLoading(false);
    })();
  }, [xcliDir]);

  const getMenuItems = (actionsList: Action[], path: string[]): MenuItem[] => {
    return buildMenuItems(actionsList, path);
  };

  const computeFiltered = (allItems: MenuItem[], query: string): MenuItem[] => {
    if (!query) return allItems;
    const results = fuzzysort.go(query, allItems, { key: "label" });
    return results.map((r) => r.obj);
  };

  const pushScreen = (screen: Screen) => {
    setStack((s) => {
      const next = [...s, screen];
      stackRef.current = next;
      return next;
    });
    // Reset search state on navigation
    searchActiveRef.current = false;
    searchQueryRef.current = "";
    selectedIndexRef.current = 0;
    setSearchActive(false);
    setSearchQuery("");
    setSelectedIndex(0);
  };

  const popScreen = () => {
    if (stackRef.current.length <= 1) {
      exit();
      return;
    }
    setStack((s) => {
      const next = s.slice(0, -1);
      stackRef.current = next;
      return next;
    });
    // Reset search state on navigation
    searchActiveRef.current = false;
    searchQueryRef.current = "";
    selectedIndexRef.current = 0;
    setSearchActive(false);
    setSearchQuery("");
    setSelectedIndex(0);
  };

  useInput((input, key) => {
    const screen = stackRef.current.at(-1) as Screen;

    // Output screen: only ESC to go back
    if (screen.type === "output") {
      if (key.escape) {
        popScreen();
      }
      return;
    }

    // Confirm screen: ENTER to confirm, ESC to cancel
    if (screen.type === "confirm") {
      if (key.return) {
        const actionId = screen.actionId;
        setStack((s) => {
          const next = [
            ...s.slice(0, -1),
            { type: "output" as const, actionId },
          ];
          stackRef.current = next;
          return next;
        });
      }
      if (key.escape) {
        popScreen();
      }
      return;
    }

    // Menu screen
    if (searchActiveRef.current) {
      if (key.escape) {
        searchActiveRef.current = false;
        searchQueryRef.current = "";
        selectedIndexRef.current = 0;
        setSearchActive(false);
        setSearchQuery("");
        setSelectedIndex(0);
        return;
      }
      if (key.return) {
        const menuPath = screen.path;
        const allItems = getMenuItems(actionsRef.current, menuPath);
        const filtered = computeFiltered(allItems, searchQueryRef.current);
        const idx = selectedIndexRef.current;
        const item = filtered[idx];
        if (item) {
          if (item.type === "category") {
            pushScreen({ type: "menu", path: [...menuPath, item.value] });
          } else {
            const action = actionsRef.current.find((a) => a.id === item.value);
            if (action?.meta.confirm) {
              pushScreen({ type: "confirm", actionId: item.value });
            } else {
              pushScreen({ type: "output", actionId: item.value });
            }
          }
        }
        return;
      }
      if (key.backspace || key.delete) {
        const newQuery = searchQueryRef.current.slice(0, -1);
        searchQueryRef.current = newQuery;
        selectedIndexRef.current = 0;
        setSearchQuery(newQuery);
        setSelectedIndex(0);
        return;
      }
      if (key.upArrow) {
        const newIdx = Math.max(0, selectedIndexRef.current - 1);
        selectedIndexRef.current = newIdx;
        setSelectedIndex(newIdx);
        return;
      }
      if (key.downArrow) {
        const menuPath = screen.path;
        const allItems = getMenuItems(actionsRef.current, menuPath);
        const filtered = computeFiltered(allItems, searchQueryRef.current);
        const newIdx = Math.min(
          filtered.length - 1,
          selectedIndexRef.current + 1,
        );
        selectedIndexRef.current = newIdx;
        setSelectedIndex(newIdx);
        return;
      }
      if (!key.ctrl && !key.meta && input) {
        const newQuery = searchQueryRef.current + input;
        searchQueryRef.current = newQuery;
        selectedIndexRef.current = 0;
        setSearchQuery(newQuery);
        setSelectedIndex(0);
      }
      return;
    }

    // Not in search mode
    if (input === "/") {
      searchActiveRef.current = true;
      searchQueryRef.current = "";
      selectedIndexRef.current = 0;
      setSearchActive(true);
      setSearchQuery("");
      setSelectedIndex(0);
      return;
    }
    if (input === "q") {
      exit();
      return;
    }
    if (key.escape) {
      popScreen();
      return;
    }
    if (key.return) {
      const menuPath = screen.path;
      const allItems = getMenuItems(actionsRef.current, menuPath);
      const item = allItems[selectedIndexRef.current];
      if (item) {
        if (item.type === "category") {
          pushScreen({ type: "menu", path: [...menuPath, item.value] });
        } else {
          const action = actionsRef.current.find((a) => a.id === item.value);
          if (action?.meta.confirm) {
            pushScreen({ type: "confirm", actionId: item.value });
          } else {
            pushScreen({ type: "output", actionId: item.value });
          }
        }
      }
      return;
    }
    if (key.upArrow || input === "k") {
      const newIdx = Math.max(0, selectedIndexRef.current - 1);
      selectedIndexRef.current = newIdx;
      setSelectedIndex(newIdx);
      return;
    }
    if (key.downArrow || input === "j") {
      const menuPath = screen.path;
      const allItems = getMenuItems(actionsRef.current, menuPath);
      const newIdx = Math.min(
        allItems.length - 1,
        selectedIndexRef.current + 1,
      );
      selectedIndexRef.current = newIdx;
      setSelectedIndex(newIdx);
      return;
    }
  });

  if (loading) {
    return <Text dimColor>Loading actions...</Text>;
  }

  if (currentScreen.type === "menu") {
    const menuPath = currentScreen.path;
    const menuItems = getMenuItems(actions, menuPath);
    const filteredItems = computeFiltered(menuItems, searchQuery);

    return (
      <Box flexDirection="column">
        <Breadcrumbs path={menuPath} />
        {searchActive && (
          <Box marginBottom={1}>
            <Text>/ {searchQuery}</Text>
            <Text dimColor>█</Text>
          </Box>
        )}
        {filteredItems.length === 0 && menuItems.length === 0 ? (
          <Text dimColor>No actions found</Text>
        ) : filteredItems.length === 0 ? (
          <Text dimColor>No matching items</Text>
        ) : (
          filteredItems.map((item, i) => (
            <Box key={item.value}>
              <Text color={i === selectedIndex ? "cyan" : undefined}>
                {i === selectedIndex ? "❯ " : "  "}
                {item.type === "category" ? "📁 " : ""}
                {item.type === "action" && item.emoji ? `${item.emoji} ` : ""}
                {item.label}
                {item.description ? ` — ${item.description}` : ""}
                {item.type === "category" ? " ▸" : ""}
              </Text>
            </Box>
          ))
        )}
        <StatusBar />
      </Box>
    );
  }

  if (currentScreen.type === "confirm") {
    const action = actions.find((a) => a.id === currentScreen.actionId);
    if (!action) return <Text color="red">Action not found</Text>;
    return (
      <Box flexDirection="column">
        <Text>
          Are you sure you want to run <Text bold>{action.meta.name}</Text>?
          Press enter to confirm, esc to cancel.
        </Text>
      </Box>
    );
  }

  if (currentScreen.type === "output") {
    const action = actions.find((a) => a.id === currentScreen.actionId);
    if (!action) return <Text color="red">Action not found</Text>;

    return (
      <Box flexDirection="column">
        <ActionOutput action={action} cwd={cwd} config={config} />
        <Box marginTop={1}>
          <Text dimColor>Press esc to go back</Text>
        </Box>
      </Box>
    );
  }

  return null;
}

function buildMenuItems(actions: Action[], path: string[]): MenuItem[] {
  const categories = new Set<string>();
  const items: MenuItem[] = [];

  if (path.length === 0) {
    // Root level: show categories AND all actions
    for (const action of actions) {
      if (action.category.length > 0) {
        const topCategory = action.category[0] as string;
        if (!categories.has(topCategory)) {
          categories.add(topCategory);
          items.push({
            type: "category",
            label: topCategory,
            value: topCategory,
          });
        }
      }
      items.push({
        type: "action",
        label: action.meta.name,
        emoji: action.meta.emoji,
        description: action.meta.description,
        value: action.id,
      });
    }
  } else {
    for (const action of actions) {
      const matchesPath = path.every((p, i) => action.category[i] === p);
      if (!matchesPath) continue;

      if (action.category.length === path.length) {
        items.push({
          type: "action",
          label: action.meta.name,
          emoji: action.meta.emoji,
          description: action.meta.description,
          value: action.id,
        });
      } else if (action.category.length > path.length) {
        const subCategory = action.category[path.length] as string;
        if (!categories.has(subCategory)) {
          categories.add(subCategory);
          items.push({
            type: "category",
            label: subCategory,
            value: subCategory,
          });
        }
      }
    }
  }

  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === "category" ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  return items;
}
