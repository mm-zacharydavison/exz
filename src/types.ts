export interface ActionMeta {
  /** Display name shown in menus */
  name: string;
  /** Emoji displayed before the name in menus */
  emoji?: string;
  /** Short description shown alongside the name */
  description?: string;
  /**
   * Require user confirmation before running
   * @default false
   */
  confirm?: boolean;
  /**
   * Hide from menu (still searchable)
   * @default false
   */
  hidden?: boolean;
  /**
   * Use alternate screen buffer when rendering (ink actions only)
   * @default false
   */
  fullscreen?: boolean;
}

export interface Action {
  /**
   * Unique path-based ID
   * @example "database/reset"
   */
  id: string;
  /** Parsed metadata from frontmatter, exports, or filename inference */
  meta: ActionMeta;
  /** Absolute path to the script file */
  filePath: string;
  /**
   * Category hierarchy derived from directory path
   * @example ["database"]
   * @example []
   */
  category: string[];
  /** How to execute the script, determined by file extension */
  runtime: Runtime;
  /**
   * Parsed shebang line from the script, if present
   * @example "#!/usr/bin/env zsh"
   */
  shebang?: string;
  /** Timestamp (ms) when this action file was created */
  addedAt?: number;
}

/**
 * Execution strategy mapped from file extension
 * @example ".ts" → "bun"
 * @example ".sh" → "bash"
 * @example ".py" → "python"
 */
export type Runtime = "bun" | "node" | "bash" | "python" | "executable" | "ink";

export interface MenuItem {
  /** Whether this item represents an action, navigable category, or section separator */
  type: "action" | "category" | "separator";
  /** Display text for the menu item */
  label: string;
  /** Emoji prefix for action items */
  emoji?: string;
  /** Description shown alongside the label */
  description?: string;
  /** Action ID or category name used for selection */
  value: string;
  /** Whether this action was added within the past 7 days */
  isNew?: boolean;
}

export type Screen =
  /** Menu listing actions/categories at a given path */
  | { type: "menu"; path: string[] }
  /** Confirmation prompt before running an action */
  | { type: "confirm"; actionId: string }
  /** In-process Ink component rendered within kadai */
  | { type: "ink-component"; actionId: string };

export interface InkActionProps {
  /** Working directory the action runs in */
  cwd: string;
  /** Environment variables from kadai config */
  env: Record<string, string>;
  /** Additional arguments passed to the action */
  args: string[];
  /** Call this to return to the kadai menu */
  onExit: () => void;
}

export interface KadaiConfig {
  /**
   * Subdirectory name under `.kadai/` containing actions
   * @default "actions"
   */
  actionsDir?: string;
  /** Environment variables injected into all action processes */
  env?: Record<string, string>;
}
