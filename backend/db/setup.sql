-- One-time setup: creates the database user and database the app uses.
-- Run it as the "postgres" superuser (see README, step 2):
--
--   psql -U postgres -f db/setup.sql
--
-- You do NOT need to create tables here. The backend creates them itself
-- when it starts (see migrate() in src/db.ts).

CREATE USER app WITH PASSWORD 'app';
CREATE DATABASE app OWNER app;
