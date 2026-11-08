import { Router } from "express";
import { pool } from "../db";

export const tasksRouter = Router();

// What a task looks like when it leaves the API.
type Task = { id: number; title: string; done: boolean; createdAt: Date };

// Postgres uses snake_case, JavaScript uses camelCase.
// `AS "createdAt"` renames the column in the result so the frontend gets camelCase.
const COLUMNS = `id, title, done, created_at AS "createdAt"`;

// URL params are always strings ("42"); turn them into a positive integer or null.
function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/tasks -> list all tasks, newest first
tasksRouter.get("/", async (_req, res) => {
  const result = await pool.query<Task>(
    `SELECT ${COLUMNS} FROM tasks ORDER BY created_at DESC`,
  );
  res.json(result.rows);
});

tasksRouter.get("/stats", async (_req, res) => {
  const obj = await pool.query(
    `SELECT COUNT(*) AS total, 
    COUNT(*) FILTER (WHERE done) AS done 
    FROM tasks`,
  );
  res.status(200).json(obj.rows[0]);
});

// POST /api/tasks  body: { "title": "Buy milk" }  -> create a task
tasksRouter.post("/", async (req, res) => {
  const title =
    typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (title.length < 1 || title.length > 200) {
    res.status(400).json({ error: "title must be 1-200 characters" });
    return;
  }

  // $1 is a query PARAMETER: the pg driver sends the value separately from the SQL.
  // Never build SQL by gluing strings together, e.g. `VALUES ('${title}')` —
  // that's exactly how SQL injection attacks work.
  const result = await pool.query<Task>(
    `INSERT INTO tasks (title) VALUES ($1) RETURNING ${COLUMNS}`,
    [title],
  );
  res.status(201).json(result.rows[0]); // 201 = Created
});

// PATCH /api/tasks/:id  body: { "done": true }  -> mark done / not done
tasksRouter.patch("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const title = req.body?.title;
  const done = req.body?.done;

  if (id === null || typeof done !== "boolean") {
    res.status(400).json({ error: "need a numeric id and a boolean 'done'" });
    return;
  }

  const result = await pool.query<Task>(
    `UPDATE tasks
    SET title = COALESCE($1, title),
    done  = COALESCE($2, done)
    WHERE id = $3 RETURNING ${COLUMNS}`,
    [title, done, id],
  );
  if (result.rowCount === 0) {
    res.status(404).json({ error: "task not found" });
    return;
  }
  res.json(result.rows[0]);
});

// DELETE /api/tasks/:id -> delete a task
tasksRouter.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "id must be a positive integer" });
    return;
  }

  const result = await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
  if (result.rowCount === 0) {
    res.status(404).json({ error: "task not found" });
    return;
  }
  res.status(204).end(); // 204 = No Content (success, nothing to send back)
});
