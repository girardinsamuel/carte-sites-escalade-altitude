#!/usr/bin/env node
// Sites naturels d'escalade (SNE) de la FFME -> scripts/data/ffme-sne.json
//  - liste géolocalisée : endpoint de la carte interactive ffme.fr
//  - classement (« Type » : site sportif, terrain d'aventure…), nombre de voies,
//    cotations : lus sur la fiche de chaque site (une requête par site)
// Puis rattache chaque site camptocamp au site FFME correspondant
// (scripts/ffme-match.mjs) et met à jour public/data/sectors.geojson.
//
// Usage : npm run data:ffme            (reprend les fiches déjà lues)
//         npm run data:ffme -- --refresh  (relit toutes les fiches)

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { annotateSectorsFile } from "./ffme-match.mjs";

const OUT = fileURLToPath(new URL("./data/ffme-sne.json", import.meta.url));
const BASE = "https://www.ffme.fr";
// Le site refuse les clients sans User-Agent de navigateur.
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  "Accept-Language": "fr-FR,fr;q=0.9",
};
const WORKERS = 2;
const PAUSE_MS = 600;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, as = "text", tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
      return as === "json" ? res.json() : res.text();
    } catch (e) {
      if (i >= tries) throw e;
      await sleep(2000 * i);
    }
  }
}

const decode = (s) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&#0?39;|&rsquo;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Liste des SNE géolocalisés (carte interactive). */
async function listSites() {
  const markers = await get(
    `${BASE}/wp-admin/admin-ajax.php?action=get_markers&filters%5Besc_sne%5D%5B%5D=on`,
    "json",
  );
  return markers
    .filter((m) => m.html?.includes('class="title">SNE<'))
    .map((m) => ({
      id: Number(m.html.match(/sne-fiche\/(\d+)/)?.[1]),
      name: decode(m.name ?? ""),
      city: decode(m.city ?? ""),
      lat: Number(m.latitude),
      lon: Number(m.longitude),
    }))
    .filter((s) => s.id && Number.isFinite(s.lat) && Number.isFinite(s.lon));
}

/** Champs utiles d'une fiche SNE. */
function parseFiche(html) {
  const type = html.match(/Type\s*:\s*<strong[^>]*>([^<]*)<\/strong>/)?.[1];
  const routes = html.match(/Nombre de voies\s*:\s*(\d+)/)?.[1];
  const grades = html.match(/Nombre de voies\s*:\s*\d+\s*<\/div>\s*<p>([^<]*)<\/p>/)?.[1];
  const decouverte = html.match(/secteur découverte<\/div>\s*<p>([^<]*)<\/p>/)?.[1];
  const commune = html.match(/<div class="label">Commune<\/div>\s*<p>([^<]*)<\/p>/)?.[1];
  return {
    type: type ? decode(type) : null,
    routes: routes && Number(routes) > 0 ? Number(routes) : null,
    grades: grades ? decode(grades) || null : null,
    decouverte: decouverte ? decode(decouverte) === "Oui" : null,
    commune: commune ? decode(commune) : null,
  };
}

async function main() {
  const refresh = process.argv.includes("--refresh");
  let cache = new Map();
  if (!refresh) {
    try {
      const prev = JSON.parse(await readFile(OUT, "utf8"));
      cache = new Map(prev.sites.filter((s) => s.fetched).map((s) => [s.id, s]));
    } catch {
      // pas de cache : tout est lu
    }
  }

  const sites = await listSites();
  console.log(`  ${sites.length} sites FFME géolocalisés (${cache.size} fiches déjà lues)`);

  const save = () =>
    writeFile(OUT, JSON.stringify({ generated: new Date().toISOString(), sites: out }, null, 0));
  await mkdir(dirname(OUT), { recursive: true });

  const out = sites.map((s) => {
    const c = cache.get(s.id);
    return c ? { ...c, ...s } : s;
  });
  const todo = out.filter((s) => !s.fetched);
  let done = 0;
  let failed = 0;
  let next = 0;
  await Promise.all(
    Array.from({ length: WORKERS }, async () => {
      while (next < todo.length) {
        const s = todo[next++];
        try {
          Object.assign(s, parseFiche(await get(`${BASE}/sne-fiche/${s.id}/`)), { fetched: true });
        } catch {
          failed++;
        }
        if (++done % 25 === 0 || done === todo.length) {
          process.stdout.write(`\r  fiches : ${done}/${todo.length}…`);
          await save(); // reprise possible si interruption
        }
        await sleep(PAUSE_MS);
      }
    }),
  );
  if (todo.length) process.stdout.write("\n");
  await save();
  if (failed) console.log(`  (${failed} fiches non lues — relancer pour réessayer)`);

  const types = {};
  for (const s of out) if (s.type) types[s.type] = (types[s.type] ?? 0) + 1;
  console.log("  classements :", types);
  console.log(`✓ ${out.length} sites FFME → ${OUT}`);

  await annotateSectorsFile(out);
}

main().catch((e) => {
  console.error("\n✗", e.message);
  process.exit(1);
});
