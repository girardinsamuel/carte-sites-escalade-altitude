#!/usr/bin/env node
// Sert les fonctions de api/ en local (comme Vercel), pour `npm run dev`.
// Usage : npm run dev:api   (DATABASE_URL lue dans .env)
// Vite redirige /api vers ce serveur (vite.config.ts).

import { createServer } from "node:http";

const PORT = Number(process.env.API_PORT ?? 3001);

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const name = url.pathname.replace(/^\/api\//, "").replace(/[^a-z0-9-]/gi, "");
  let mod;
  try {
    mod = await import(`../api/${name}.js`);
  } catch {
    res.writeHead(404).end("introuvable");
    return;
  }
  let raw = "";
  for await (const chunk of req) raw += chunk;
  req.body = raw ? JSON.parse(raw) : undefined;
  // Mini-équivalent des helpers de réponse Vercel.
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (data) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(data));
    return res;
  };
  await mod.default(req, res);
}).listen(PORT, () => console.log(`API locale : http://localhost:${PORT}/api/…`));
