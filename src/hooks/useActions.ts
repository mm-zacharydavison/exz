import { join } from "node:path";
import { useEffect, useRef, useState } from "react";
import { loadConfig } from "../core/config.ts";
import { loadActions } from "../core/loader.ts";
import type { Action, ExzConfig } from "../types.ts";

interface UseActionsOptions {
  exzDir: string;
}

export function useActions({ exzDir }: UseActionsOptions) {
  const [actions, setActions] = useState<Action[]>([]);
  const [config, setConfig] = useState<ExzConfig>({});
  const [loading, setLoading] = useState(true);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    (async () => {
      const cfg = await loadConfig(exzDir);
      setConfig(cfg);

      const actionsDir = join(exzDir, cfg.actionsDir ?? "actions");
      const localActions = await loadActions(actionsDir);

      setActions(localActions);
      setLoading(false);
    })();
  }, [exzDir]);

  return { actions, actionsRef, config, loading };
}
