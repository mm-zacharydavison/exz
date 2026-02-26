import { join } from "node:path";
import type { ZcliConfig } from "../types.ts";

const DEFAULT_CONFIG: ZcliConfig = {
  actionsDir: "actions",
  env: {},
};

export async function loadConfig(zcliDir: string): Promise<ZcliConfig> {
  const configPath = join(zcliDir, "config.ts");
  const configFile = Bun.file(configPath);

  if (!(await configFile.exists())) {
    return { ...DEFAULT_CONFIG };
  }

  const mod = await import(configPath);
  const userConfig: ZcliConfig = mod.default ?? mod;

  return {
    actionsDir: userConfig.actionsDir ?? DEFAULT_CONFIG.actionsDir,
    env: userConfig.env ?? DEFAULT_CONFIG.env,
  };
}
