import { createApp } from "../server/index.mjs";
const database = process.env.DATABASE_URL
  ? await (
      await import("../server/postgres.mjs")
    ).openPostgresStore(process.env.DATABASE_URL)
  : undefined;
const app = await createApp({ database, aiOptions: { enabled: false } });
try {
  console.log(JSON.stringify(await app.snapshotProfiles()));
} finally {
  await app.dispose();
}
