import { join } from "node:path";
import { useEffect, useRef, useState } from "react";
import { loadConfig } from "../core/config.ts";
import { loadActions } from "../core/loader.ts";
import type { Action, XcliConfig } from "../types.ts";

interface UseActionsOptions {
  xcliDir: string;
}

export function useActions({ xcliDir }: UseActionsOptions) {
  const [actions, setActions] = useState<Action[]>([]);
  const [config, setConfig] = useState<XcliConfig>({});
  const [loading, setLoading] = useState(true);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    (async () => {
      const cfg = await loadConfig(xcliDir);
      setConfig(cfg);

      const actionsDir = join(xcliDir, cfg.actionsDir ?? "actions");
      const localActions = await loadActions(actionsDir);

      setActions(localActions);
      setLoading(false);
    })();
  }, [xcliDir]);

  return { actions, actionsRef, config, loading };
}
