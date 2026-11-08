// Every call to the backend lives in this one file.
//
// Notice the URLs are RELATIVE ("/api/tasks", not "http://localhost:3000/api/tasks").
// The browser sends them to whichever server served this page. In dev that's
// Vite on :5173, which proxies them to Express on :3000 (see vite.config.ts).

export type Task = {
  id: number;
  title: string;
  done: boolean;
  createdAt: string; // dates arrive as ISO strings in JSON
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    // The backend sends errors as { "error": "..." }
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }

  // 204 No Content has no body to parse
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  health: () => request<{ status: string; db: string }>("/health"),

  listTasks: () => request<Task[]>("/tasks"),

  createTask: (title: string) =>
    request<Task>("/tasks", { method: "POST", body: JSON.stringify({ title }) }),

  setDone: (id: number, done: boolean) =>
    request<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ done }) }),

  deleteTask: (id: number) => request<void>(`/tasks/${id}`, { method: "DELETE" }),
};
