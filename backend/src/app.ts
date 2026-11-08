import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { pool } from "./db";
import { tasksRouter } from "./routes/tasks";

export const app = express();

// Parse JSON request bodies into req.body
app.use(express.json());

// Tiny request logger, so you can watch every request hit the API in your terminal.
// Health checks may be called every few seconds by monitoring tools, so we skip
// them to keep the logs readable.
app.use((req, res, next) => {
  if (req.path === "/api/health") return next();
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      `${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`,
    );
  });
  next();
});

// Health check: a cheap URL that tells the outside world "I'm alive".
// Hosting platforms and monitoring tools call endpoints like this to decide
// whether the app is working. It checks the DB too, so "healthy" means
// "this API can actually do its job".
app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "ok" });
  } catch {
    res.status(503).json({ status: "error", db: "unreachable" });
  }
});

app.use("/api/tasks", tasksRouter);

// Any other /api/... path
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not found" });
});

// Error handler (the 4 arguments are how Express recognises it).
// Express 5 automatically sends errors thrown inside async route handlers here,
// so a failed query becomes a clean 500 response instead of crashing the server.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // Errors like malformed JSON carry their own 4xx status; everything else is a 500.
  const status = (err as { status?: number }).status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status < 500 ? (err as Error).message : "internal server error",
  });
});
