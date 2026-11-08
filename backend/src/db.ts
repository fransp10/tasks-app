import { Pool } from "pg";
import { config } from "./config";

// A Pool keeps a handful of open connections to Postgres and lends one out
// for each query. Opening a brand-new connection per request would be slow.
export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
});

// If the database restarts or the network drops, idle connections in the pool
// emit an "error" event. Without this listener Node treats it as unhandled and
// the whole server crashes. With it, we log and the pool reconnects on the next query.
pool.on("error", (err) => {
  console.error("[db] idle connection error:", err.message);
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// When a whole system boots at once (a server restart, a deploy...), the API can
// start before the database is ready to accept connections. Instead of crashing
// on the first failed attempt, retry for a while.
export async function waitForDatabase(
  retries = 15,
  delayMs = 2000,
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query("SELECT 1");
      console.log("[db] connected");
      return;
    } catch (err) {
      console.log(
        `[db] not ready yet (attempt ${attempt}/${retries}): ${(err as Error).message}`,
      );
      await sleep(delayMs);
    }
  }
  throw new Error("Could not connect to the database");
}

// A tiny "migration": make sure the tables we need exist.
// "IF NOT EXISTS" makes it safe to run on every startup.
//
// Limitation (on purpose, see the README exercises): CREATE TABLE IF NOT EXISTS
// does nothing if the table is already there, so adding a column here later
// will NOT change an existing database. Real projects use a migration tool
// (node-pg-migrate, Drizzle, Prisma, Knex) that records which changes ran.
export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      title       TEXT        NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
      done        BOOLEAN     NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );`);

  await pool.query(
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5) ;`,
  );
  console.log("[db] schema is up to date");
}
