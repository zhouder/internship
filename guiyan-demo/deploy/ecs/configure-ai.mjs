// Root-only maintenance command. Read the credential from stdin, never argv.
import {
  readFileSync,
  writeFileSync,
  renameSync,
  chmodSync,
  unlinkSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
if (process.getuid?.() !== 0) throw Error("Run as root");
let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
  if (Buffer.byteLength(input) > 4096)
    throw Error("Configuration input too large");
}
const value = JSON.parse(input),
  key = String(value.apiKey || "").trim();
if (!/^sk-[a-zA-Z0-9_-]{16,256}$/.test(key))
  throw Error("Invalid API key format");
const file = "/etc/guiyan/demo.env";
const settings = {
  DEEPSEEK_API_KEY: key,
  DEEPSEEK_BASE_URL: "https://api.deepseek.com",
  DEEPSEEK_MODEL: "deepseek-flash",
  AI_ENABLED: "1",
  AI_DAILY_LIMIT: "200",
  AI_USER_DAILY_LIMIT: "40",
  AI_USER_MINUTE_LIMIT: "6",
  DEEPSEEK_TIMEOUT_MS: "40000",
};
const existing = readFileSync(file, "utf8")
  .split(/\r?\n/)
  .filter(
    (line) =>
      !Object.keys(settings).some((name) => line.startsWith(name + "=")),
  );
const content =
  existing.filter(Boolean).join("\n") +
  "\n" +
  Object.entries(settings)
    .map(([name, value]) => name + "=" + value)
    .join("\n") +
  "\n";
const temporary = file + "." + randomBytes(5).toString("hex") + ".tmp";
try {
  writeFileSync(temporary, content, { mode: 0o600, flag: "wx" });
  renameSync(temporary, file);
  chmodSync(file, 0o600);
} finally {
  try {
    unlinkSync(temporary);
  } catch {}
}
console.log(
  "DeepSeek configuration saved in protected server environment; credential hidden.",
);
