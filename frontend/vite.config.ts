import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Vite dev server (http://localhost:5173) forwards every request that
// starts with /api to the backend on port 3000. This is called a PROXY.
//
// Why? The browser only ever talks to ONE origin (localhost:5173), so you never
// have to deal with CORS, and the frontend code can just call fetch("/api/...").
//
// Heads-up: this proxy only exists while `npm run dev` is running.
// `npm run build` produces plain static files, and in production SOMETHING ELSE
// has to serve them and forward /api to the backend. Figuring out what is part
// of the containerization challenge in the README.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
