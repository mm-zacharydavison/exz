import { Box, Text, useApp } from "ink";
import { useState } from "react";
import { ActionOutput } from "./components/ActionOutput.tsx";
import { Breadcrumbs } from "./components/Breadcrumbs.tsx";
import { ShareScreen } from "./components/ShareScreen.tsx";
import { StatusBar } from "./components/StatusBar.tsx";
import { useActions } from "./hooks/useActions.ts";
import { useKeyboard } from "./hooks/useKeyboard.ts";
import { useNavigation } from "./hooks/useNavigation.ts";
import { useSearch } from "./hooks/useSearch.ts";
import type { Action, GenerationResult, MenuItem } from "./types.ts";

interface AppProps {
  cwd: string;
  xcliDir: string;
  onRequestHandover?: () => void;
  generationResult?: GenerationResult;
}

export function App({
  cwd,
  xcliDir,
  onRequestHandover,
  generationResult,
}: AppProps) {
  const { exit } = useApp();
  const [showShareScreen, setShowShareScreen] = useState(
    () => (generationResult?.newActions.length ?? 0) > 0,
  );

  const search = useSearch();
  const nav = useNavigation({ onExit: exit, onNavigate: search.resetSearch });
  const { actions, actionsRef, config, loading, syncing } = useActions({
    xcliDir,
    setStack: nav.setStack,
    stackRef: nav.stackRef,
  });

  const getMenuItems = (actionsList: Action[], path: string[]): MenuItem[] => {
    return buildMenuItems(actionsList, path);
  };

  const aiEnabled = config.ai?.enabled !== false;
  const hasSources = (config.sources?.length ?? 0) > 0;

  useKeyboard({
    stackRef: nav.stackRef,
    actionsRef,
    searchActiveRef: search.searchActiveRef,
    searchQueryRef: search.searchQueryRef,
    selectedIndexRef: search.selectedIndexRef,
    setSearchActive: search.setSearchActive,
    setSearchQuery: search.setSearchQuery,
    setSelectedIndex: search.setSelectedIndex,
    setStack: nav.setStack,
    resetSearch: search.resetSearch,
    pushScreen: nav.pushScreen,
    popScreen: nav.popScreen,
    exit,
    getMenuItems,
    computeFiltered: search.computeFiltered,
    onRequestHandover,
    aiEnabled,
    hasSources,
    isActive: !showShareScreen && nav.currentScreen.type !== "share",
  });

  if (loading) {
    return <Text dimColor>Loading actions...</Text>;
  }

  // Share screen from AI generation result
  if (showShareScreen && generationResult) {
    return (
      <ShareScreen
        newActions={generationResult.newActions}
        sources={config.sources ?? []}
        cwd={cwd}
        config={config}
        xcliDir={xcliDir}
        onDone={() => setShowShareScreen(false)}
      />
    );
  }

  // Share screen from menu 's' keybinding
  if (nav.currentScreen.type === "share") {
    const shareActions = nav.currentScreen.actionIds
      .map((id) => actions.find((a) => a.id === id))
      .filter((a): a is Action => a !== undefined);

    if (shareActions.length === 0) {
      nav.popScreen();
      return null;
    }

    return (
      <ShareScreen
        newActions={shareActions}
        sources={config.sources ?? []}
        cwd={cwd}
        config={config}
        xcliDir={xcliDir}
        onDone={() => nav.popScreen()}
      />
    );
  }

  if (nav.currentScreen.type === "menu") {
    const menuPath = nav.currentScreen.path;
    const menuItems = getMenuItems(actions, menuPath);
    const filteredItems = search.computeFiltered(menuItems, search.searchQuery);

    return (
      <Box flexDirection="column">
        <Breadcrumbs path={menuPath} />
        {search.searchActive && (
          <Box marginBottom={1}>
            <Text>/ {search.searchQuery}</Text>
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
              <Text color={i === search.selectedIndex ? "cyan" : undefined}>
                {i === search.selectedIndex ? "❯ " : "  "}
                {item.type === "category" ? "📁 " : ""}
                {item.type === "action" && item.emoji ? `${item.emoji} ` : ""}
                {item.label}
                {item.type === "category" ? " ▸" : ""}
              </Text>
              {item.description && <Text dimColor> ({item.description})</Text>}
              {item.source && <Text dimColor>{` ${item.source}`}</Text>}
            </Box>
          ))
        )}
        <StatusBar
          syncing={syncing}
          aiEnabled={aiEnabled}
          hasSources={hasSources}
        />
      </Box>
    );
  }

  if (nav.currentScreen.type === "confirm") {
    const { actionId } = nav.currentScreen;
    const action = actions.find((a) => a.id === actionId);
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

  if (nav.currentScreen.type === "output") {
    const { actionId } = nav.currentScreen;
    const action = actions.find((a) => a.id === actionId);
    if (!action) return <Text color="red">Action not found</Text>;

    return (
      <Box flexDirection="column">
        <ActionOutput action={action} cwd={cwd} config={config} />
        <Box marginTop={1}>
          <Text dimColor>Press enter or esc to go back</Text>
        </Box>
      </Box>
    );
  }

  return null;
}

export function buildMenuItems(actions: Action[], path: string[]): MenuItem[] {
  const categories = new Set<string>();
  const items: MenuItem[] = [];

  if (path.length === 0) {
    // Root level: show category folders and root-level actions only
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
      } else {
        items.push({
          type: "action",
          label: action.meta.name,
          emoji: action.meta.emoji,
          description: action.meta.description,
          value: action.id,
          source:
            action.source?.type !== "local" ? action.source?.label : undefined,
        });
      }
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
          source:
            action.source?.type !== "local" ? action.source?.label : undefined,
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
    // Categories first
    if (a.type !== b.type) return a.type === "category" ? -1 : 1;
    // Local actions before external
    const aExternal = a.source ? 1 : 0;
    const bExternal = b.source ? 1 : 0;
    if (aExternal !== bExternal) return aExternal - bExternal;
    return a.label.localeCompare(b.label);
  });

  return items;
}
