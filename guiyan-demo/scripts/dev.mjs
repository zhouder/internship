import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["--experimental-sqlite", "server/index.mjs"], {
    stdio: "inherit",
  }),
  spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "0.0.0.0"],
    { stdio: "inherit" },
  ),
];
for (const child of children)
  child.on("exit", (code) => {
    for (const other of children) if (other !== child) other.kill();
    process.exitCode = code || 0;
  });
process.on("SIGINT", () => children.forEach((c) => c.kill()));
process.on("SIGTERM", () => children.forEach((c) => c.kill()));
