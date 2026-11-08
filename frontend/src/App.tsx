import { useEffect, useState } from "react";
import { api, type Task } from "./api";

type Health = "checking" | "ok" | "down";

const HEALTH_LABEL: Record<Health, string> = {
  checking: "Checking API…",
  ok: "API + database OK",
  down: "API or database unreachable",
};

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<Health>("checking");

  // Load the tasks once, when the page opens.
  useEffect(() => {
    api
      .listTasks()
      .then(setTasks)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Ping /api/health every 5 seconds. Try stopping the backend or PostgreSQL
  // while the page is open and watch the badge turn red.
  useEffect(() => {
    const check = () =>
      api
        .health()
        .then(() => setHealth("ok"))
        .catch(() => setHealth("down"));
    check();
    const timer = setInterval(check, 5000);
    return () => clearInterval(timer); // cleanup when the component unmounts
  }, []);

  async function addTask() {
    if (!title.trim()) return;
    try {
      const task = await api.createTask(title);
      setTasks((prev) => [task, ...prev]);
      setTitle("");
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function toggleTask(task: Task) {
    try {
      const updated = await api.setDone(task.id, !task.done);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function removeTask(id: number) {
    try {
      await api.deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const remaining = tasks.filter((t) => !t.done).length;

  return (
    <main className="container">
      <header className="header">
        <h1>Tasks</h1>
        <span className={`status status-${health}`}>
          <span className="dot" aria-hidden="true" />
          {HEALTH_LABEL[health]}
        </span>
      </header>

      <form
        className="add-form"
        onSubmit={(e) => {
          e.preventDefault(); // stop the browser from reloading the page
          void addTask();
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          maxLength={200}
          aria-label="New task"
        />
        <button type="submit" disabled={!title.trim()}>
          Add
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="muted">No tasks yet. Add one above. It gets saved in PostgreSQL.</p>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.id} className={task.done ? "done" : ""}>
              <label>
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => void toggleTask(task)}
                />
                <span>{task.title}</span>
              </label>
              <button
                className="delete"
                onClick={() => void removeTask(task.id)}
                aria-label={`Delete "${task.title}"`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <footer className="muted">
        {remaining} of {tasks.length} left · React → Vite proxy → Express → PostgreSQL
      </footer>
    </main>
  );
}
