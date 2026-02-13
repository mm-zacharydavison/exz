# Plan: Recently Added Actions Section

## Goal

Show actions added in the past 7 days in a dedicated "New" section at the top of the CLI menu, marked with a ✨ emoji.

## Design Decisions

**How to determine "recently added"**: Use file `birthtimeMs` from `stat()` (when the file was created on disk). Fall back to `mtimeMs` if birthtime is unavailable (some Linux filesystems). This is simple, requires no persistence layer, and works across local and cached external sources.

**How to display**: Add a `separator` MenuItem type for section headers, and an `isNew` flag on action MenuItems. New actions appear at the top of each menu level in a "New" section, **and also remain in their normal position** in the main list below. Both instances display the ✨ emoji, regardless of whether the action already has a custom emoji. The main list is never de-duped — it always shows the full set of actions in their normal sort order.

**Search behavior**: Separators are excluded from fuzzy search results and keyboard navigation. New actions are still searchable by their label. During search, de-duplicate results so each action only appears once (with `isNew` preserved).

## Changes

### 1. `src/types.ts` — Extend `Action` and `MenuItem`

Add `addedAt` to `Action`:

```ts
export interface Action {
  // ... existing fields ...
  /** Timestamp (ms) when this action file was created */
  addedAt?: number;
}
```

Add `separator` type and `isNew` flag to `MenuItem`:

```ts
export interface MenuItem {
  type: "action" | "category" | "separator";
  label: string;
  emoji?: string;
  description?: string;
  value: string;
  source?: string;
  /** Whether this action was added within the past 7 days */
  isNew?: boolean;
}
```

### 2. `src/core/loader.ts` — Read file birthtime during scan

In `scanDirectory`, after the existing `Promise.all([extractMetadata, readShebang])`, also `stat()` the file and capture `birthtimeMs` (falling back to `mtimeMs`):

```ts
import { stat } from "node:fs/promises";

// Inside scanDirectory, alongside meta and shebang:
const [meta, shebang, fileStat] = await Promise.all([
  extractMetadata(fullPath),
  readShebang(fullPath),
  stat(fullPath),
]);

const addedAt = fileStat.birthtimeMs > 0 ? fileStat.birthtimeMs : fileStat.mtimeMs;

actions.push({
  // ... existing fields ...
  addedAt,
});
```

### 3. `src/app.tsx` — Update `buildMenuItems` to create "New" section

Add a helper to check recency:

```ts
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isRecentlyAdded(action: Action): boolean {
  if (!action.addedAt) return false;
  return Date.now() - action.addedAt < SEVEN_DAYS_MS;
}
```

In `buildMenuItems`, after building and sorting the items list:

1. Identify which action items are new based on their backing `Action.addedAt`.
2. Mark all new items with `isNew: true` (both in the "New" section and in the main list).
3. If any new items exist, prepend: a separator `{ type: "separator", label: "New", value: "__sep_new" }`, then copies of the new items.
4. The main list is **not** de-duped — new actions appear in both the "New" section at the top and in their normal sorted position below.
5. Only add the "New" section at root level and within category views (not during search).

### 4. `src/app.tsx` — Update menu rendering

Handle the separator type and `isNew` flag in the render loop. The ✨ emoji is rendered in a **fixed-width column to the left** of the item content, so that labels stay aligned whether or not the item is new. When any new items exist in the current view, all items get a `newIndicator` column — new items show `✨`, others show equivalent whitespace (`   `):

```tsx
// Determine if any items in the current list are new (to know whether to reserve the column)
const hasAnyNew = filteredItems.some((item) => item.isNew);

{filteredItems.map((item, i) => {
  if (item.type === "separator") {
    return (
      <Box key={item.value} marginTop={i > 0 ? 1 : 0}>
        <Text dimColor bold>{item.label}</Text>
      </Box>
    );
  }
  return (
    <Box key={item.value}>
      <Text color={i === search.selectedIndex ? "cyan" : undefined}>
        {i === search.selectedIndex ? "❯ " : "  "}
      </Text>
      {hasAnyNew && (
        <Text>{item.isNew ? "✨ " : "   "}</Text>
      )}
      <Text color={i === search.selectedIndex ? "cyan" : undefined}>
        {item.type === "category" ? "📁 " : ""}
        {item.type === "action" && item.emoji ? `${item.emoji} ` : ""}
        {item.label}
        {item.type === "category" ? " ▸" : ""}
      </Text>
      {item.description && <Text dimColor> ({item.description})</Text>}
      {item.source && <Text dimColor>{` ${item.source}`}</Text>}
    </Box>
  );
})}
```

Visual result (the ✨ column keeps all labels aligned):
```
New
  ✨ 🚀 Deploy to staging    (push to staging)
  ✨ 📦 Build release
  📁 database ▸
     🚀 Deploy to staging    (push to staging)
     📦 Build release
     🔄 Reset DB
```

### 5. `src/hooks/useSearch.ts` — Filter out separators from search results

When a search query is active, strip out separators and de-duplicate items before fuzzy matching. Since new actions appear twice in the full list (once in the "New" section, once in the main list), search results should only return each action once. De-duplicate by `value` (action ID), keeping the instance with `isNew: true` so the ✨ emoji is preserved:

```ts
const computeFiltered = (allItems: MenuItem[], query: string): MenuItem[] => {
  if (!query) return allItems;
  // Remove separators and de-duplicate (new section + main list both have the item)
  const seen = new Set<string>();
  const searchable = allItems.filter((item) => {
    if (item.type === "separator") return false;
    if (seen.has(item.value)) return false;
    seen.add(item.value);
    return true;
  });
  const results = fuzzysort.go(query, searchable, { key: "label" });
  return results.map((r) => r.obj);
};
```

### 6. `src/hooks/useKeyboard.ts` — Skip separators in navigation

When incrementing/decrementing `selectedIndex`, skip over any separator items. Add a helper that finds the next/previous non-separator index:

```ts
function nextSelectableIndex(items: MenuItem[], current: number, direction: 1 | -1): number {
  let next = current + direction;
  while (next >= 0 && next < items.length && items[next].type === "separator") {
    next += direction;
  }
  return Math.max(0, Math.min(items.length - 1, next));
}
```

### 7. Tests

#### `test/loader.test.ts` — Verify `addedAt` is populated

- Assert that loaded actions have a numeric `addedAt` field.
- Assert that `addedAt` is reasonably close to `Date.now()` for a freshly created fixture file.

#### `test/menu.test.ts` (new or extend existing) — Verify menu structure

- Given actions where some have `addedAt` within 7 days and others older, assert that `buildMenuItems` returns a separator + new items at the top, followed by the **full** list (including the new items again in their normal position, with `isNew: true`).
- Given no recent actions, assert no separator is present and the list is unchanged.
- Given all recent actions, assert separator is present, all items appear in the "New" section, and all items also appear in the main list below with `isNew: true`.
- Assert new items in the main list have `isNew: true` and the ✨ emoji renders for both instances.

#### `test/search.test.ts` (or extend existing) — Verify search de-duplicates and excludes separators

- Assert that `computeFiltered` with a query never returns separator items.
- Assert that a new action appearing twice in the full list only appears once in search results, with `isNew: true` preserved.

## File Summary

| File                       | Change                                          |
|:---------------------------|:------------------------------------------------|
| `src/types.ts`             | Add `addedAt` to `Action`, `separator` + `isNew` to `MenuItem` |
| `src/core/loader.ts`       | `stat()` each file, populate `addedAt`          |
| `src/app.tsx`              | Partition new/regular items, render separator + ✨ emoji |
| `src/hooks/useSearch.ts`   | Filter separators from fuzzy search             |
| `src/hooks/useKeyboard.ts` | Skip separators during keyboard navigation      |
| `test/loader.test.ts`      | Test `addedAt` field                            |
| `test/menu.test.ts`        | Test new section partitioning                   |
