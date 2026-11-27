import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // En local, /api est servi par `npm run dev:api` (sur Vercel : fonctions api/).
  server: { proxy: { "/api": `http://localhost:${process.env.API_PORT ?? 3001}` } },
});
