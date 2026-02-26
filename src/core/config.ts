import { join } from "node:path";
import type { ExzConfig } from "../types.ts";

const DEFAULT_CONFIG: ExzConfig = {
  actionsDir: "actions",
  env: {},
};

export async function loadConfig(exzDir: string): Promise<ExzConfig> {
  const configPath = join(exzDir, "config.ts");
  const configFile = Bun.file(configPath);

  if (!(await configFile.exists())) {
    return { ...DEFAULT_CONFIG };
  }

  const mod = await import(configPath);
  const userConfig: ExzConfig = mod.default ?? mod;

  return {
    actionsDir: userConfig.actionsDir ?? DEFAULT_CONFIG.actionsDir,
    env: userConfig.env ?? DEFAULT_CONFIG.env,
  };
}
