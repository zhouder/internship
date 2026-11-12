import { spawnSync } from "node:child_process";
if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL is required for PostgreSQL tests");
// The suite creates and removes its own isolated schema; public demo data is untouched.
const result = spawnSync(
  process.execPath,
  [
    "--experimental-sqlite",
    "--test",
    "tests/api.test.mjs",
    "tests/deepseek.test.mjs",
    "tests/ledger.test.mjs",
  ],
  {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      TEST_DATABASE_URL:
        process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
      DATABASE_URL: "",
      DEEPSEEK_API_KEY: "",
      AI_ENABLED: "0",
    },
    stdio: "inherit",
  },
);
process.exitCode = result.status ?? 1;
