import fuzzysort from "fuzzysort";
import { Box, Text, useInput } from "ink";
import { useRef, useState } from "react";
import type { MenuItem } from "../types.ts";

interface MenuScreenProps {
  items: MenuItem[];
  onSelect: (item: MenuItem) => void;
  onBack: () => void;
  onQuit: () => void;
}

export function MenuScreen({
  items,
  onSelect,
  onBack,
  onQuit,
}: MenuScreenProps) {
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Refs keep current values accessible inside the useInput handler
  // even when React hasn't re-rendered yet (due to batched updates).
  const searchActiveRef = useRef(false);
  const searchQueryRef = useRef("");
  const selectedIndexRef = useRef(0);

  const computeFiltered = (query: string): MenuItem[] => {
    if (!query) return items;
    const results = fuzzysort.go(query, items, { key: "label" });
    return results.map((r) => r.obj);
  };

  const filteredItems = computeFiltered(searchQuery);

  useInput((input, key) => {
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
        const currentFiltered = computeFiltered(searchQueryRef.current);
        const idx = selectedIndexRef.current;
        const item = currentFiltered[idx];
        if (item) {
          searchActiveRef.current = false;
          searchQueryRef.current = "";
          selectedIndexRef.current = 0;
          setSearchActive(false);
          setSearchQuery("");
          setSelectedIndex(0);
          onSelect(item);
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
        const currentFiltered = computeFiltered(searchQueryRef.current);
        const newIdx = Math.min(
          currentFiltered.length - 1,
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
      onQuit();
      return;
    }
    if (key.escape) {
      onBack();
      return;
    }
    if (key.return) {
      const item = filteredItems[selectedIndexRef.current];
      if (item) onSelect(item);
      return;
    }
    if (key.upArrow || input === "k") {
      const newIdx = Math.max(0, selectedIndexRef.current - 1);
      selectedIndexRef.current = newIdx;
      setSelectedIndex(newIdx);
      return;
    }
    if (key.downArrow || input === "j") {
      const newIdx = Math.min(
        filteredItems.length - 1,
        selectedIndexRef.current + 1,
      );
      selectedIndexRef.current = newIdx;
      setSelectedIndex(newIdx);
      return;
    }
  });

  return (
    <Box flexDirection="column">
      {searchActive && (
        <Box marginBottom={1}>
          <Text>/ {searchQuery}</Text>
          <Text dimColor>█</Text>
        </Box>
      )}
      {filteredItems.length === 0 ? (
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
    </Box>
  );
}
