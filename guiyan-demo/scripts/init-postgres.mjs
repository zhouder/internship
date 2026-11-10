import { openPostgresStore } from "../server/postgres.mjs";
const db = await openPostgresStore(process.env.DATABASE_URL);
try {
  const users = await db.prepare("SELECT COUNT(*) AS n FROM users").get();
  const resources = await db
    .prepare("SELECT COUNT(*) AS n FROM resources")
    .get();
  console.log(
    `PostgreSQL ready: ${users.n} demo users, ${resources.n} resources. Existing data preserved.`,
  );
} finally {
  await db.close();
}
