import { describe, expect, test } from "bun:test";
import { buildMenuItems } from "../src/app.tsx";
import type { Action } from "../src/types.ts";

function makeAction(overrides: Partial<Action> & { id: string }): Action {
  return {
    meta: { name: overrides.id },
    filePath: `/fake/${overrides.id}.ts`,
    category: [],
    runtime: "bun",
    ...overrides,
  };
}

const NOW = Date.now();
const ONE_DAY = 24 * 60 * 60 * 1000;

describe("buildMenuItems — new actions section", () => {
  test("no new section when no actions are recent", () => {
    const actions = [
      makeAction({ id: "old-a", addedAt: NOW - 30 * ONE_DAY }),
      makeAction({ id: "old-b", addedAt: NOW - 14 * ONE_DAY }),
    ];
    const items = buildMenuItems(actions, []);
    expect(items.every((i) => i.type !== "separator")).toBe(true);
    expect(items.every((i) => !i.isNew)).toBe(true);
  });

  test("no new section when all actions are recent", () => {
    const actions = [
      makeAction({ id: "new-a", addedAt: NOW - 1 * ONE_DAY }),
      makeAction({ id: "new-b", addedAt: NOW - 2 * ONE_DAY }),
    ];
    const items = buildMenuItems(actions, []);
    expect(items.every((i) => i.type !== "separator")).toBe(true);
    // Items should still be marked isNew
    expect(items.every((i) => i.isNew)).toBe(true);
    // No duplicates
    expect(items.length).toBe(2);
  });

  test("new section appears when mix of new and old actions exist", () => {
    const actions = [
      makeAction({ id: "new-a", addedAt: NOW - 1 * ONE_DAY }),
      makeAction({ id: "old-b", addedAt: NOW - 30 * ONE_DAY }),
    ];
    const items = buildMenuItems(actions, []);
    expect(items[0]?.type).toBe("separator");
    expect(items[0]?.label).toBe("New");
  });

  test("divider separator appears between new section and main list", () => {
    const actions = [
      makeAction({ id: "new-a", addedAt: NOW - 1 * ONE_DAY }),
      makeAction({ id: "old-b", addedAt: NOW - 30 * ONE_DAY }),
    ];
    const items = buildMenuItems(actions, []);
    const separators = items.filter((i) => i.type === "separator");
    expect(separators.length).toBe(2);
    expect(separators[0]?.label).toBe("New");
    expect(separators[1]?.value).toBe("__sep_divider");
  });

  test("new actions appear in both new section and main list", () => {
    const actions = [
      makeAction({
        id: "new-a",
        meta: { name: "New Action" },
        addedAt: NOW - 1 * ONE_DAY,
      }),
      makeAction({
        id: "old-b",
        meta: { name: "Old Action" },
        addedAt: NOW - 30 * ONE_DAY,
      }),
    ];
    const items = buildMenuItems(actions, []);

    const actionItems = items.filter((i) => i.type === "action");
    const newActionCount = actionItems.filter(
      (i) => i.value === "new-a",
    ).length;
    expect(newActionCount).toBe(2);

    // Old action appears once
    const oldActionCount = actionItems.filter(
      (i) => i.value === "old-b",
    ).length;
    expect(oldActionCount).toBe(1);
  });

  test("both instances of new actions have isNew: true", () => {
    const actions = [
      makeAction({ id: "new-a", addedAt: NOW - 1 * ONE_DAY }),
      makeAction({ id: "old-b", addedAt: NOW - 30 * ONE_DAY }),
    ];
    const items = buildMenuItems(actions, []);
    const newItems = items.filter(
      (i) => i.type === "action" && i.value === "new-a",
    );
    expect(newItems.length).toBe(2);
    expect(newItems.every((i) => i.isNew)).toBe(true);
  });

  test("old actions have isNew falsy", () => {
    const actions = [
      makeAction({ id: "new-a", addedAt: NOW - 1 * ONE_DAY }),
      makeAction({ id: "old-b", addedAt: NOW - 30 * ONE_DAY }),
    ];
    const items = buildMenuItems(actions, []);
    const oldItems = items.filter((i) => i.value === "old-b");
    expect(oldItems.every((i) => !i.isNew)).toBe(true);
  });

  test("main list preserves normal sort order", () => {
    const actions = [
      makeAction({
        id: "charlie",
        meta: { name: "Charlie" },
        addedAt: NOW - 1 * ONE_DAY,
      }),
      makeAction({
        id: "alpha",
        meta: { name: "Alpha" },
        addedAt: NOW - 30 * ONE_DAY,
      }),
      makeAction({
        id: "bravo",
        meta: { name: "Bravo" },
        addedAt: NOW - 2 * ONE_DAY,
      }),
    ];
    const items = buildMenuItems(actions, []);

    // All action items: first batch is new section copies, then full main list
    const allActions = items.filter((i) => i.type === "action");
    // New section: bravo, charlie (2 new actions, sorted alphabetically)
    // Main list: alpha, bravo, charlie (3 total, sorted alphabetically)
    const mainList = allActions.slice(2);
    expect(mainList.map((i) => i.label)).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  test("new section works within category views", () => {
    const actions = [
      makeAction({
        id: "db/migrate",
        meta: { name: "Migrate" },
        category: ["db"],
        addedAt: NOW - 1 * ONE_DAY,
      }),
      makeAction({
        id: "db/seed",
        meta: { name: "Seed" },
        category: ["db"],
        addedAt: NOW - 30 * ONE_DAY,
      }),
    ];
    const items = buildMenuItems(actions, ["db"]);
    expect(items[0]?.type).toBe("separator");
    expect(items[0]?.label).toBe("New");

    const actionItems = items.filter((i) => i.type === "action");
    // Migrate appears twice (new section + main), Seed appears once
    expect(actionItems.filter((i) => i.value === "db/migrate").length).toBe(2);
    expect(actionItems.filter((i) => i.value === "db/seed").length).toBe(1);
  });

  test("categories are not duplicated in new section", () => {
    const actions = [
      makeAction({
        id: "db/migrate",
        meta: { name: "Migrate" },
        category: ["db"],
        addedAt: NOW - 1 * ONE_DAY,
      }),
      makeAction({
        id: "other",
        meta: { name: "Other" },
        addedAt: NOW - 30 * ONE_DAY,
      }),
    ];
    const items = buildMenuItems(actions, []);
    const categoryItems = items.filter((i) => i.type === "category");
    expect(categoryItems.length).toBe(1);
  });

  test("actions with no addedAt are not considered new", () => {
    const actions = [makeAction({ id: "no-date" })];
    const items = buildMenuItems(actions, []);
    expect(items.every((i) => i.type !== "separator")).toBe(true);
    expect(items.every((i) => !i.isNew)).toBe(true);
  });

  test("actions exactly 7 days old are not new", () => {
    const actions = [
      makeAction({ id: "boundary", addedAt: NOW - 7 * ONE_DAY }),
      makeAction({ id: "old", addedAt: NOW - 30 * ONE_DAY }),
    ];
    const items = buildMenuItems(actions, []);
    expect(items.every((i) => i.type !== "separator")).toBe(true);
  });
});
