import { join } from "node:path";
import { useEffect, useRef, useState } from "react";
import { loadConfig } from "../core/config.ts";
import { loadActions } from "../core/loader.ts";
import type { Action, ZcliConfig } from "../types.ts";

interface UseActionsOptions {
  zcliDir: string;
}

export function useActions({ zcliDir }: UseActionsOptions) {
  const [actions, setActions] = useState<Action[]>([]);
  const [config, setConfig] = useState<ZcliConfig>({});
  const [loading, setLoading] = useState(true);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    (async () => {
      const cfg = await loadConfig(zcliDir);
      setConfig(cfg);

      const actionsDir = join(zcliDir, cfg.actionsDir ?? "actions");
      const localActions = await loadActions(actionsDir);

      setActions(localActions);
      setLoading(false);
    })();
  }, [zcliDir]);

  return { actions, actionsRef, config, loading };
}
