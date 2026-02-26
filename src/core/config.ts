import { join } from "node:path";
import type { MenuxConfig } from "../types.ts";

const DEFAULT_CONFIG: MenuxConfig = {
  actionsDir: "actions",
  env: {},
};

export async function loadConfig(menuxDir: string): Promise<MenuxConfig> {
  const configPath = join(menuxDir, "config.ts");
  const configFile = Bun.file(configPath);

  if (!(await configFile.exists())) {
    return { ...DEFAULT_CONFIG };
  }

  const mod = await import(configPath);
  const userConfig: MenuxConfig = mod.default ?? mod;

  return {
    actionsDir: userConfig.actionsDir ?? DEFAULT_CONFIG.actionsDir,
    env: userConfig.env ?? DEFAULT_CONFIG.env,
  };
}
