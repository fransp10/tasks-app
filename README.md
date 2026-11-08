# Full-stack starter: React + Express + PostgreSQL

A deliberately small **Tasks** app (add, tick off, delete) whose only job is to show how a frontend, a backend and a database fit together. Once it runs, the second half of this README is a step-by-step challenge to **containerize and deploy it yourself**, with hints hidden behind spoilers.

| Layer    | Tech                                  | Runs on                 |
| -------- | ------------------------------------- | ----------------------- |
| Frontend | React 19 + Vite + TypeScript          | http://localhost:5173   |
| Backend  | Express 5 + TypeScript + `pg` driver  | http://localhost:3000   |
| Database | PostgreSQL                            | localhost:5432          |

---

## 1. How the pieces talk to each other

```
  ┌───────────┐        ┌──────────────────┐        ┌──────────────────┐        ┌──────────────┐
  │  Browser  │ ─────▶ │ Vite dev server  │ ─/api─▶│   Express API    │ ─SQL─▶ │  PostgreSQL  │
  │           │ ◀───── │ :5173            │ ◀───── │   :3000          │ ◀───── │  :5432       │
  └───────────┘        │ serves the React │        │ routes, checks   │        │ stores rows  │
                       │ code + proxies   │        │ input, runs SQL  │        │ on disk      │
                       └──────────────────┘        └──────────────────┘        └──────────────┘
```

**What happens when you click "Add":**

1. React calls `fetch("/api/tasks", { method: "POST", body: '{"title":"Buy milk"}' })` (`frontend/src/api.ts`).
2. The URL is relative, so the browser sends it to the server that served the page: Vite on `:5173`.
3. Vite sees the `/api` prefix and **proxies** the request to `http://localhost:3000` (`frontend/vite.config.ts`). The browser never knows a second server exists, which is why there's no CORS setup anywhere.
4. Express matches `POST /api/tasks`, validates the title, and runs `INSERT INTO tasks (title) VALUES ($1)` using a connection from the pool (`backend/src/routes/tasks.ts`).
5. Postgres writes the row to disk and returns it (`RETURNING ...`).
6. Express sends it back as JSON with status `201 Created`.
7. React adds it to state, and the list re-renders.

---

## 2. Project structure

```
fullstack-starter/
├── backend/
│   ├── src/
│   │   ├── index.ts         ← entry point: connect DB → create tables → start server
│   │   ├── app.ts           ← Express app: middleware, health check, error handler
│   │   ├── config.ts        ← reads env vars (PORT, DATABASE_URL...)
│   │   ├── db.ts            ← connection pool, retry logic, table creation
│   │   └── routes/tasks.ts  ← the CRUD endpoints
│   ├── db/setup.sql         ← one-time: creates the DB user + database
│   ├── .env.example         ← copy to .env
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx         ← mounts React into index.html
│   │   ├── App.tsx          ← the whole UI
│   │   ├── api.ts           ← every backend call lives here
│   │   └── styles.css
│   ├── index.html
│   ├── vite.config.ts       ← dev server + /api proxy
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

---

## 3. Run it locally

**You need:** Node.js 22 (anything ≥ 20.12 works) and PostgreSQL (any recent version).

### Step 1: Install and start PostgreSQL

| OS | How |
| --- | --- |
| Windows | Download the installer from postgresql.org. It asks you to set a password for the `postgres` superuser, so remember it. It installs as a service that starts automatically. |
| macOS | `brew install postgresql@17` then `brew services start postgresql@17` |
| Ubuntu/Debian | `sudo apt install postgresql` (starts automatically) |

> Don't want to install Postgres? Create a database on a hosted provider (e.g. Neon or Supabase), paste its connection string into `DATABASE_URL` in step 3, set `DATABASE_SSL=true`, and skip step 2.

### Step 2: Create the database user and database

From the `backend/` folder:

```bash
# Windows (use "SQL Shell (psql)" from the Start menu, or add Postgres's bin folder to PATH)
psql -U postgres -f db/setup.sql

# macOS with Homebrew (your Mac username is the superuser, not "postgres")
psql postgres -f db/setup.sql

# Linux
sudo -u postgres psql < db/setup.sql
```

This creates a user `app` with password `app` and a database `app`. You **don't** create tables by hand: the backend does that on startup (`migrate()` in `src/db.ts`).

### Step 3: Start the backend (terminal 1)

```bash
cd backend
cp .env.example .env        # works in PowerShell too
npm install
npm run dev
```

You should see:

```
[db] connected
[db] schema is up to date
[server] API listening on port 3000
```

Test it: open http://localhost:3000/api/health and you should get `{"status":"ok","db":"ok"}`.

### Step 4: Start the frontend (terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The badge in the corner should be green. Add some tasks, then refresh the page; they're still there because they live in Postgres.

> 💡 Commit the `package-lock.json` files that `npm install` creates. They pin exact dependency versions, and you'll want them later (look up `npm ci`).

---

## 4. Explore it

### Call the API directly (no frontend needed)

(On Windows, run these in Git Bash, or type `curl.exe` instead of `curl` in PowerShell.)

```bash
curl http://localhost:3000/api/tasks
curl -X POST http://localhost:3000/api/tasks -H "Content-Type: application/json" -d '{"title":"From curl"}'
curl -X PATCH http://localhost:3000/api/tasks/1 -H "Content-Type: application/json" -d '{"done":true}'
curl -X DELETE http://localhost:3000/api/tasks/1
curl -X POST http://localhost:3000/api/tasks -H "Content-Type: application/json" -d '{"title":""}'   # → 400
```

| Method | Path              | Body                  | Returns            |
| ------ | ----------------- | --------------------- | ------------------ |
| GET    | `/api/health`     |                       | `200` or `503`     |
| GET    | `/api/tasks`      |                       | `200` + list       |
| POST   | `/api/tasks`      | `{ "title": "..." }`  | `201` + new task   |
| PATCH  | `/api/tasks/:id`  | `{ "done": true }`    | `200` + task       |
| DELETE | `/api/tasks/:id`  |                       | `204` (no body)    |

### Look inside the database

```bash
psql postgres://app:app@localhost:5432/app
```

```sql
\dt                       -- list tables
\d tasks                  -- show the tasks table's columns
SELECT * FROM tasks;      -- the rows your UI created
\q                        -- quit
```

### Run the backend the "production" way

`npm run dev` runs TypeScript directly with `tsx` and restarts on every save. In production you compile once and run plain JavaScript:

```bash
cd backend
npm run build      # TypeScript → JavaScript in dist/
npm start          # node dist/index.js
```

Same for the frontend: `npm run build` creates a `dist/` folder of plain HTML/JS/CSS. Look inside it. That folder is your whole frontend in production. (Remember this for Level 3 below.)

### Break things on purpose

- Stop the backend (Ctrl+C) with the page open → badge turns red within 5 s. Notice the graceful-shutdown log line.
- Stop PostgreSQL while the backend runs → `/api/health` returns `503`, adding a task shows an error, and the backend **doesn't crash**. Start Postgres again and it recovers by itself (that's the connection pool).
- Start the backend while Postgres is stopped → watch it retry, then start Postgres within ~30 s.
- Send garbage: `curl -X POST localhost:3000/api/tasks -H "Content-Type: application/json" -d '{oops'` → clean `400`, not a crash.

### Small coding exercises

1. **Add a `priority` column.** Add it to the `CREATE TABLE` in `db.ts` and restart. It doesn't appear. Why? (Read the comment above `migrate()`.) Fix it with an `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, then look up what migration tools like `node-pg-migrate` or Drizzle do about this problem.
2. **Add `GET /api/stats`** returning `{ total, done }` using one SQL query (`COUNT(*) FILTER (WHERE done)`), and show it in the footer.
3. **Edit a task's title**: extend `PATCH` to accept `title` too.

---

## 5. 🐳 Your challenge: containerize and deploy it

You've got a working app. Now make it run in containers, then on a real server. Each level has a **goal**, **questions to figure out**, and a **"done when"** check. Hints are hidden; try first, peek when stuck.

### Already in the code to help you

These were added on purpose. You'll see why each matters once things run in containers:

- **All config comes from env vars** (`config.ts`): one image, many environments.
- **`GET /api/health`**: something you can point a health check at.
- **DB connection retry** (`waitForDatabase()`): containers don't start in a neat order.
- **SIGTERM handling** (`index.ts`): what stopping a container actually sends.

---

### Level 1: Put the database in a container

**Goal:** Postgres runs in Docker, and your *local* backend (`npm run dev`) talks to it.

**Figure out:**
- Which image? How do you tell it what user/password/database to create?
- How do you make port 5432 inside the container reachable from your machine? (Your installed Postgres already uses 5432. Stop it or pick another port.)
- Delete the container and start a fresh one. Where did your tasks go? How do you stop that happening?

**Done when:** you can delete and recreate the DB container and your tasks are still there.

<details>
<summary>Hint 1</summary>

The official `postgres` image on Docker Hub documents a few `POSTGRES_*` environment variables. Pass them with `-e`. Publish a port with `-p HOST:CONTAINER`.
</details>

<details>
<summary>Hint 2</summary>

A container's filesystem is thrown away with the container. Look up **Docker volumes** and find out which folder inside the container Postgres stores its data in (it's on the image's Docker Hub page).
</details>

---

### Level 2: Containerize the backend

**Goal:** write `backend/Dockerfile`, build an image, run it, and get `{"status":"ok","db":"ok"}` from it.

**Figure out:**
- Node can't run `.ts` files directly. What has to happen at build time vs. at run time? Does the running container need TypeScript at all?
- Should your local `node_modules` be copied into the image? (Hint: what if you're on Windows/macOS and the container is Linux?)
- Inside the container, `DATABASE_URL` says `localhost`. Why does that fail now, when it worked in Level 1?

**Done when:** `curl localhost:3000/api/health` returns ok, served from the container.

<details>
<summary>Hint 1: the Dockerfile basics</summary>

You'll need `FROM`, `WORKDIR`, `COPY`, `RUN`, `CMD`. Start from an official `node` image (the `-alpine` variants are small). Copy `package*.json` and install dependencies *before* copying `src/`. Search "Docker layer caching" to learn why the order matters.
</details>

<details>
<summary>Hint 2: keeping junk out</summary>

Create a `.dockerignore`. It works like `.gitignore` but for `COPY`. Think about `node_modules`, `dist`, and `.env`.
</details>

<details>
<summary>Hint 3: localhost</summary>

Inside a container, `localhost` means *that container itself*, not your computer. Look up **user-defined bridge networks**: containers on the same network can reach each other **by container name**.
</details>

<details>
<summary>Hint 4: making it small</summary>

Search "Docker multi-stage build". Stage 1 has everything needed to compile, and stage 2 only gets the compiled `dist/` and production dependencies (`npm ci --omit=dev`). Compare image sizes with `docker images` before and after.
</details>

---

### Level 3: Containerize the frontend

**Goal:** a container that serves the built React app on http://localhost:8080, where adding tasks works.

**Figure out:**
- What exactly does `npm run build` produce? Does the final container need Node.js?
- The Vite proxy only exists in `npm run dev`. In production, **who forwards `/api/...` to the backend?**
- What should happen if someone opens `http://localhost:8080/some/page` directly? (Matters once you add a router.)

**Done when:** the app works at :8080, and the backend container has **no** published port at all. All traffic goes through the frontend container.

<details>
<summary>Hint 1</summary>

The build output is static files. Any web server can serve them, and **nginx** is the classic choice (official `nginx` image).
</details>

<details>
<summary>Hint 2</summary>

nginx can also act as a **reverse proxy**: look up `location /api/ { proxy_pass ...; }`. This replaces what Vite's proxy did in dev, and it's why the frontend code never needed to change.
</details>

<details>
<summary>Hint 3</summary>

Multi-stage again: build with a `node` image, then copy only the `dist/` folder into an `nginx` image. For the "direct URL" question, look up nginx `try_files`.
</details>

---

### Level 4: One command for everything (Docker Compose)

**Goal:** `docker compose up --build` from a fresh clone starts all three, in the right order.

**Figure out:**
- How does the backend wait until Postgres is *actually ready*, not just "started"?
- Which services need published ports? Which ones should **never** be reachable from outside?
- Where do passwords go so they're not in git?

**Done when:** `docker compose down` followed by `docker compose up` keeps your tasks, and `docker compose down -v` deletes them (and you understand why).

<details>
<summary>Hint 1</summary>

In Compose, the **service name** is the hostname. If the database service is called `db`, the backend connects to `db:5432`. You get a shared network for free.
</details>

<details>
<summary>Hint 2</summary>

`depends_on` alone only waits for a container to *start*. Look up `depends_on` with `condition: service_healthy` plus a `healthcheck`. Postgres ships a `pg_isready` command, and your backend already has `/api/health`.
</details>

<details>
<summary>Hint 3</summary>

Compose automatically reads a `.env` file next to `docker-compose.yml` and substitutes `${VARIABLES}`. Commit a `.env.example`, not the `.env`.
</details>

---

### Level 5: Deploy it to the internet

**Goal:** a friend can open your app on their phone.

**Figure out:**
- Where will it run? (A small Linux VPS is the most educational option, because you control everything.)
- How do you get your code onto it, and how do you update it after a change?
- Which ports should be open to the whole internet? (Answer: as few as possible.)
- How do you get HTTPS?

**Done when:** it's reachable at a public address, you can ship an update with one or two commands, and the database port is **not** reachable from outside.

<details>
<summary>Hint 1: the VPS route</summary>

SSH into the server → install Docker → `git clone` your repo → create `.env` with a strong password → `docker compose up -d --build`. Updating is `git pull` and the same command again.
</details>

<details>
<summary>Hint 2: security gotcha</summary>

Ports published by Docker can bypass a firewall like `ufw`. Either don't publish the DB port at all, or bind it to localhost only (`127.0.0.1:5432:5432`). Check from your laptop that `SERVER_IP:5432` is closed.
</details>

<details>
<summary>Hint 3: HTTPS</summary>

Point a domain at the server and look at **Caddy**. It gets and renews HTTPS certificates automatically and can sit in front of your frontend container as one more Compose service.
</details>

<details>
<summary>Hint 4: managed platforms instead</summary>

Platforms like Render, Railway or Fly.io can build from your Dockerfiles. You'd typically use their managed Postgres (set `DATABASE_URL` + `DATABASE_SSL=true`, which the backend already supports) and deploy the backend and frontend as separate services. Notice what changes about "who forwards `/api`" when they're no longer on the same Docker network.
</details>

---

## Troubleshooting

| Problem | Likely cause / fix |
| --- | --- |
| `ECONNREFUSED ...:5432` | PostgreSQL isn't running. Start the service. |
| `password authentication failed for user "app"` | `db/setup.sql` wasn't run, or the password in `.env` doesn't match. |
| `role "postgres" does not exist` (macOS) | Homebrew uses your Mac username as superuser: `psql postgres -f db/setup.sql`. |
| `process.loadEnvFile is not a function` | Node is too old. Install Node 22 LTS. |
| `EADDRINUSE :3000` / `:5173` | Something else uses that port. Stop it, or change `PORT` in `.env` (and the proxy target in `vite.config.ts`). |
| Badge is red, backend looks fine | The backend must be running in another terminal *while* `npm run dev` runs in `frontend/`. |
