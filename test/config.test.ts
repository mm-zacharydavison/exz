import { afterEach, describe, test } from "bun:test";
import { type CLISession, fixturePath, Keys, spawnCLI } from "./harness";

describe("configuration", () => {
  let cli: CLISession;

  afterEach(() => {
    cli?.kill();
  });

  test("loads environment variables from config.ts", async () => {
    cli = spawnCLI({ cwd: fixturePath("config-repo") });
    // Navigate to echo-env action and run it
    await cli.waitForText("Echo Environment");
    cli.type("/");
    cli.type("Echo Environment");
    cli.press(Keys.ENTER);
    // Script should have access to env vars defined in config
    await cli.waitForText("APP_ENV=testing");
    await cli.waitForText("DATABASE_URL=postgres://localhost:5432/test_db");
  });

  test("uses default config when no config.ts exists", async () => {
    cli = spawnCLI({ cwd: fixturePath("basic-repo") });
    // Should launch normally without a config.ts file
    await cli.waitForText("Hello World");
  });

  test("config env vars override process env", async () => {
    cli = spawnCLI({
      cwd: fixturePath("config-repo"),
      env: { APP_ENV: "production" },
    });
    await cli.waitForText("Echo Environment");
    cli.type("/");
    cli.type("Echo Environment");
    cli.press(Keys.ENTER);
    // Config env should win over process env
    await cli.waitForText("APP_ENV=testing");
  });
});
