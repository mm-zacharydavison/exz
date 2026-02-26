// kadai:name Todo List
// kadai:emoji ✅
// kadai:description Inline todo list manager
import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { InkActionProps } from "../../../src/types.ts";

interface Todo {
  text: string;
  done: boolean;
}

const INITIAL_TODOS: Todo[] = [
  { text: "Buy groceries", done: false },
  { text: "Walk the dog", done: true },
  { text: "Write some code", done: false },
];

export default function TodoList({ onExit }: InkActionProps) {
  const [todos, setTodos] = useState<Todo[]>(INITIAL_TODOS);
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (input === "q" || key.escape) {
      onExit();
      return;
    }
    if (key.upArrow || input === "k") {
      setCursor((c) => Math.max(0, c - 1));
    }
    if (key.downArrow || input === "j") {
      setCursor((c) => Math.min(todos.length - 1, c + 1));
    }
    if (input === " " || key.return) {
      setTodos((prev) =>
        prev.map((t, i) => (i === cursor ? { ...t, done: !t.done } : t)),
      );
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>Todo List</Text>
      <Text dimColor>─────────</Text>
      {todos.map((todo, i) => (
        <Box key={todo.text}>
          <Text color={i === cursor ? "cyan" : undefined}>
            {i === cursor ? "❯ " : "  "}
            {todo.done ? "☑" : "☐"} {todo.text}
          </Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>↑↓ navigate  space toggle  q quit</Text>
      </Box>
    </Box>
  );
}
