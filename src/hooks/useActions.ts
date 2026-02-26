import { join } from "node:path";
import { useEffect, useRef, useState } from "react";
import { loadConfig } from "../core/config.ts";
import { loadActions } from "../core/loader.ts";
import type { Action, MenuxConfig } from "../types.ts";

interface UseActionsOptions {
  menuxDir: string;
}

export function useActions({ menuxDir }: UseActionsOptions) {
  const [actions, setActions] = useState<Action[]>([]);
  const [config, setConfig] = useState<MenuxConfig>({});
  const [loading, setLoading] = useState(true);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    (async () => {
      const cfg = await loadConfig(menuxDir);
      setConfig(cfg);

      const actionsDir = join(menuxDir, cfg.actionsDir ?? "actions");
      const localActions = await loadActions(actionsDir);

      setActions(localActions);
      setLoading(false);
    })();
  }, [menuxDir]);

  return { actions, actionsRef, config, loading };
}
