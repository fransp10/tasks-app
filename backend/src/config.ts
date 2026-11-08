// All configuration comes from environment variables.
//
// This is the "12-factor app" idea: the same code runs on your laptop and on a
// server; only the environment changes. Never hard-code passwords in code —
// they'd end up in git.

// Load backend/.env into process.env if the file exists (built into Node 20.12+,
// no "dotenv" package needed). On a server you'd usually set real env vars instead.
try {
  process.loadEnvFile();
} catch {
  // No .env file — fine, we fall back to real env vars / the defaults below.
}

export const config = {
  port: Number(process.env.PORT ?? 3000),

  // Format: postgres://USER:PASSWORD@HOST:PORT/DATABASE
  databaseUrl:
    process.env.DATABASE_URL ?? "postgres://app:app@localhost:5432/app",

  // Hosted databases (Render, Railway, Neon, Supabase...) usually require SSL.
  databaseSsl: process.env.DATABASE_SSL === "true",
};
