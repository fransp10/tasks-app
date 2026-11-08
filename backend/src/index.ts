import { app } from "./app";
import { config } from "./config";
import { migrate, pool, waitForDatabase } from "./db";

async function main() {
  console.log("Connecting to:", config.databaseUrl);
  await waitForDatabase();
  await migrate();

  const server = app.listen(config.port, () => {
    console.log(`[server] API listening on port ${config.port}`);
  });

  // When something stops the app politely (Ctrl+C sends SIGINT; process managers
  // and hosting platforms send SIGTERM on every redeploy), we stop accepting new
  // requests, let in-flight ones finish, and close the DB connections cleanly.
  const shutdown = (signal: string) => {
    console.log(`[server] ${signal} received, shutting down...`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1); // non-zero exit code = "I crashed" (process managers can restart it)
});
