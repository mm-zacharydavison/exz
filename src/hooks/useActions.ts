import { join } from "node:path";
import { useEffect, useRef, useState } from "react";
import { loadConfig } from "../core/config.ts";
import { loadActions } from "../core/loader.ts";
import { loadCachedSources, refreshSources } from "../core/sources.ts";
import type { Action, Screen, XcliConfig } from "../types.ts";

interface UseActionsOptions {
  xcliDir: string;
  setStack: React.Dispatch<React.SetStateAction<Screen[]>>;
  stackRef: React.MutableRefObject<Screen[]>;
}

export function useActions({ xcliDir, setStack, stackRef }: UseActionsOptions) {
  const [actions, setActions] = useState<Action[]>([]);
  const [config, setConfig] = useState<XcliConfig>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const autoNavigatedRef = useRef(false);

  useEffect(() => {
    const autoNavigate = (actionsList: Action[], cfg: XcliConfig) => {
      if (autoNavigatedRef.current || actionsList.length === 0) return;
      if (!cfg.autoNavigate?.length) return;

      const scopedPath = cfg.autoNavigate;
      const hasMatch = actionsList.some((a) =>
        scopedPath.every((p, i) => a.category[i] === p),
      );
      if (hasMatch) {
        autoNavigatedRef.current = true;
        const newStack: Screen[] = [
          { type: "menu", path: [] },
          { type: "menu", path: scopedPath },
        ];
        setStack(newStack);
        stackRef.current = newStack;
      }
    };

    (async () => {
      const cfg = await loadConfig(xcliDir);
      setConfig(cfg);

      const actionsDir = join(xcliDir, cfg.actionsDir ?? "actions");

      // 1. Load local actions (instant)
      const localActions = await loadActions(actionsDir);
      let allActions = [...localActions];

      // 2. Load cached external sources (instant, no network)
      if (cfg.sources?.length) {
        const cachedExternal = await loadCachedSources(xcliDir, cfg.sources);
        allActions = [...localActions, ...cachedExternal];
      }

      setActions(allActions);
      setLoading(false);

      // 3. Auto-navigate to scoped directory from config
      autoNavigate(allActions, cfg);

      // 4. Background refresh external sources
      if (cfg.sources?.length) {
        setSyncing(true);
        refreshSources(xcliDir, cfg.sources, (freshExternalActions) => {
          const merged = [...localActions, ...freshExternalActions];
          setActions(merged);
          actionsRef.current = merged;
          setSyncing(false);
          autoNavigate(merged, cfg);
        }).catch(() => {
          setSyncing(false);
        });
      }
    })();
  }, [xcliDir, setStack, stackRef]);

  return { actions, actionsRef, config, loading, syncing };
}
