#!/usr/bin/env node
// Snapshot camptocamp -> public/data/sectors.geojson
//  - sites d'escalade : waypoints climbing_outdoor (+ détail par site pour
//    cotation et orientation, absentes de la liste)
//  - via ferrata      : itinéraires act=via_ferrata (altitude via route,
//    sinon repli sur les waypoints associés)
//  - grandes voies    : itinéraires act=rock_climbing regroupés par sommet / paroi
//  - commune (France) : géocodage inverse via geo.api.gouv.fr
// Usage : npm run data

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import proj4 from "proj4";
import departements from "../src/data/departements.json" with { type: "json" };
import { annotateSectorsFile } from "./ffme-match.mjs";

const PAGE = 100;
const OUT = fileURLToPath(new URL("../public/data/sectors.geojson", import.meta.url));

const toWgs84 = (x, y) => proj4("EPSG:3857", "EPSG:4326", [x, y]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const norm = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’´`]/g, "'")
    .trim();

const DEP_BY_NAME = new Map(departements.map((d) => [norm(d.nom), d.code]));
DEP_BY_NAME.set("reunion", "974");

function depOf(doc) {
  for (const a of doc.areas ?? []) {
    if (a.area_type !== "admin_limits") continue;
    const title =
      a.locales?.find((l) => l.lang === "fr")?.title ?? a.locales?.[0]?.title;
    const code = title ? DEP_BY_NAME.get(norm(title)) : undefined;
    if (code) return code;
  }
  return null;
}

function point(geom) {
  if (!geom) return null;
  let coords;
  try {
    coords = JSON.parse(geom).coordinates;
  } catch {
    return null;
  }
  const [lon, lat] = toWgs84(coords[0], coords[1]);
  return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
}

/** Massif : zone `range` du document. */
function massifOf(doc) {
  const a = doc.areas?.find((x) => x.area_type === "range");
  const title = (a?.locales?.find((l) => l.lang === "fr") ?? a?.locales?.[0])?.title;
  return title?.trim() || null;
}

/** "4c–7b", "7b", ou null. */
const ratingRange = (min, max) =>
  min && max && min !== max ? `${min}–${max}` : (max ?? min ?? null);

/** Propriétés présentes uniquement (allège le GeoJSON). */
const compact = (o) =>
  Object.fromEntries(
    Object.entries(o).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length)),
  );

const feature = (lon, lat, props) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lon, lat] },
  properties: compact(props),
});

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  return res.json();
}

async function getJsonRetry(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      return await getJson(url);
    } catch (e) {
      if (i >= tries) throw e;
      await sleep(1000 * i);
    }
  }
}

/** Exécute `fn` sur chaque élément avec au plus `size` appels simultanés. */
async function pool(items, size, fn) {
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

async function* paginate(baseUrl, label) {
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    // pl=fr : titres en français quand la traduction existe.
    const json = await getJson(`${baseUrl}&pl=fr&limit=${PAGE}&offset=${offset}`);
    total = json.total ?? 0;
    for (const doc of json.documents ?? []) yield doc;
    offset += PAGE;
    process.stdout.write(`\r  ${label} : ${Math.min(offset, total)}/${total}…`);
    if (!json.documents?.length) break;
    await sleep(150);
  }
  process.stdout.write("\n");
}

async function climbing() {
  const out = [];
  for await (const doc of paginate(
    "https://api.camptocamp.org/waypoints?wtyp=climbing_outdoor",
    "escalade",
  )) {
    const pt = point(doc.geometry?.geom);
    if (!pt || typeof doc.elevation !== "number") continue;
    out.push(
      feature(pt[0], pt[1], {
        id: doc.document_id,
        kind: "climbing",
        name: doc.locales?.[0]?.title?.trim() || `Secteur #${doc.document_id}`,
        elevation: doc.elevation,
        url: `https://www.camptocamp.org/waypoints/${doc.document_id}`,
        dep: depOf(doc),
        massif: massifOf(doc),
      }),
    );
  }

  let done = 0;
  await pool(out, 4, async (f) => {
    try {
      const d = await getJsonRetry(
        `https://api.camptocamp.org/waypoints/${f.properties.id}?l=fr`,
      );
      Object.assign(
        f.properties,
        compact({
          rating: ratingRange(d.climbing_rating_min, d.climbing_rating_max),
          orientations: d.orientations,
          routes: d.routes_quantity,
          // Détails affichés dans l'infobulle (l'API camptocamp refuse les
          // requêtes venant d'autres domaines : pas de chargement en direct).
          types: d.climbing_outdoor_types,
          rocks: d.rock_types,
          styles: d.climbing_styles,
          heightMax: d.height_max,
        }),
      );
    } catch {
      // détail indisponible : site conservé sans cotation ni orientation
    }
    if (++done % 50 === 0 || done === out.length)
      process.stdout.write(`\r  détails escalade : ${done}/${out.length}…`);
  });
  process.stdout.write("\n");
  return out;
}

/** Altitude de repli : plus haut waypoint associé à l'itinéraire. */
async function routeFallbackElevation(id) {
  try {
    const d = await getJson(`https://api.camptocamp.org/routes/${id}?l=fr`);
    const elevs = (d.associations?.waypoints ?? [])
      .map((w) => w.elevation)
      .filter((e) => typeof e === "number");
    return elevs.length ? Math.max(...elevs) : null;
  } catch {
    return null;
  }
}

async function routesForActivity(activity, kind, label) {
  const out = [];
  let missing = 0;
  for await (const doc of paginate(
    `https://api.camptocamp.org/routes?act=${activity}`,
    label,
  )) {
    const pt = point(doc.geometry?.geom);
    if (!pt) continue;
    let elevation = doc.elevation_max ?? doc.elevation_min ?? null;
    if (elevation == null) {
      elevation = await routeFallbackElevation(doc.document_id);
      await sleep(120);
    }
    if (typeof elevation !== "number") {
      missing++;
      continue;
    }
    const loc = doc.locales?.[0];
    const title = loc?.title?.trim();
    const name =
      loc?.title_prefix && title
        ? `${loc.title_prefix} : ${title}`
        : title || `Itinéraire #${doc.document_id}`;
    out.push(
      feature(pt[0], pt[1], {
        id: doc.document_id,
        kind,
        name,
        elevation,
        url: `https://www.camptocamp.org/routes/${doc.document_id}`,
        dep: depOf(doc),
        globalRating: doc.global_rating,
        rating:
          kind === "via_ferrata"
            ? doc.via_ferrata_rating
            : [doc.global_rating, doc.rock_free_rating].filter(Boolean).join(" · ") ||
              null,
        orientations: doc.orientations,
        massif: massifOf(doc),
      }),
    );
  }
  if (missing) console.log(`  (${missing} ${label} sans altitude, ignorées)`);
  return out;
}

/**
 * Commune (France, outre-mer compris) par géocodage inverse sur
 * geo.api.gouv.fr — absente des données camptocamp.
 */
async function addCommunes(features) {
  const fr = features.filter((f) => f.properties.dep);
  let done = 0;
  let failed = 0;
  await pool(fr, 6, async (f) => {
    const [lon, lat] = f.geometry.coordinates;
    try {
      const list = await getJsonRetry(
        `https://geo.api.gouv.fr/communes?lat=${lat}&lon=${lon}&fields=nom&format=json`,
      );
      if (list[0]?.nom) f.properties.commune = list[0].nom;
    } catch {
      failed++;
    }
    if (++done % 100 === 0 || done === fr.length)
      process.stdout.write(`\r  communes : ${done}/${fr.length}…`);
  });
  process.stdout.write("\n");
  if (failed) console.log(`  (${failed} communes non trouvées)`);
}

/** Clé de tri d'une cotation libre française (4c, 6a+, 7b…). */
function freeKey(g) {
  const m = /^(\d)([abc])?(\+)?/.exec(g ?? "");
  if (!m) return null;
  return Number(m[1]) * 10 + (m[2] ? "abc".indexOf(m[2]) * 3 : 0) + (m[3] ? 1 : 0);
}

const GLOBAL_ORDER = ["F", "F+", "PD-", "PD", "PD+", "AD-", "AD", "AD+", "D-", "D", "D+",
  "TD-", "TD", "TD+", "ED-", "ED", "ED+", "ED4", "ED5", "ED6", "ED7"];

/** Plus petite et plus grande valeur d'une liste selon une clé de tri. */
function extent(values, key) {
  const vs = values.filter((v) => v != null && key(v) != null);
  if (!vs.length) return null;
  vs.sort((a, b) => key(a) - key(b));
  return ratingRange(vs[0], vs[vs.length - 1]);
}

const normName = (s) => norm(s ?? "").replace(/[^a-z0-9]+/g, " ").trim();

function distKm([lon1, lat1], [lon2, lat2]) {
  const r = Math.PI / 180;
  const h =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * Voies d'escalade (act=rock_climbing) regroupées par sommet / paroi : une
 * entrée par point de départ commun (Mont Aiguille, Gerbier…), avec le nombre
 * de voies et la fourchette de cotations. Les voies déjà importées comme
 * rocher haute montagne, et les parois qui sont déjà des sites d'escalade,
 * sont écartées.
 */
async function rockRoutes(existingIds) {
  // 1. Voies, regroupées par nom de sommet (title_prefix) puis par proximité.
  const groups = new Map();
  let total = 0;
  for await (const doc of paginate(
    "https://api.camptocamp.org/routes?act=rock_climbing",
    "voies d'escalade",
  )) {
    if (doc.activities?.includes("mountain_climbing")) continue;
    const pt = point(doc.geometry?.geom);
    if (!pt) continue;
    const loc = doc.locales?.[0];
    const prefix = loc?.title_prefix?.trim() || loc?.title?.trim();
    if (!prefix) continue;
    total++;
    const key = normName(prefix);
    const clusters = groups.get(key) ?? [];
    let c = clusters.find((x) => distKm(x.pt, pt) <= 5);
    if (!c) {
      c = { name: prefix, pt, routes: [] };
      clusters.push(c);
      groups.set(key, clusters);
    }
    c.routes.push(doc);
  }
  const clusters = [...groups.values()].flat();
  console.log(`  ${total} voies en ${clusters.length} groupes`);

  // 2. Sommet principal de chaque groupe (fiche d'une de ses voies).
  let done = 0;
  await pool(clusters, 4, async (c) => {
    try {
      const d = await getJsonRetry(
        `https://api.camptocamp.org/routes/${c.routes[0].document_id}?l=fr`,
      );
      const w = (d.associations?.waypoints ?? []).find(
        (x) => String(x.document_id) === String(d.main_waypoint_id),
      );
      if (w) c.waypoint = w;
    } catch {
      // fiche indisponible : position et altitude tirées des voies
    }
    if (++done % 100 === 0 || done === clusters.length)
      process.stdout.write(`\r  sommets des voies : ${done}/${clusters.length}…`);
  });
  process.stdout.write("\n");

  // 3. Une entrée par sommet (plusieurs groupes peuvent partager le même).
  const bySummit = new Map();
  for (const c of clusters) {
    const id = c.waypoint ? Number(c.waypoint.document_id) : c.routes[0].document_id;
    if (existingIds.has(id)) continue; // déjà un site d'escalade
    const prev = bySummit.get(id);
    if (prev) prev.routes.push(...c.routes);
    else bySummit.set(id, { ...c, id });
  }

  const out = [];
  for (const g of bySummit.values()) {
    const w = g.waypoint;
    const wpt = w ? point(w.geometry?.geom) : null;
    const pts = g.routes.map((r) => point(r.geometry.geom));
    const [lon, lat] = wpt ?? [
      pts.reduce((s, p) => s + p[0], 0) / pts.length,
      pts.reduce((s, p) => s + p[1], 0) / pts.length,
    ];
    const elevs = g.routes.map((r) => r.elevation_max).filter((e) => typeof e === "number");
    const elevation = Number(w?.elevation) || (elevs.length ? Math.max(...elevs) : null);
    if (typeof elevation !== "number") continue;
    const free = extent(g.routes.map((r) => r.rock_free_rating), freeKey);
    const global = extent(g.routes.map((r) => r.global_rating), (v) => {
      const i = GLOBAL_ORDER.indexOf(v);
      return i < 0 ? null : i;
    });
    const heights = g.routes
      .map((r) => r.height_diff_difficulties ?? r.height_diff_up)
      .filter((h) => typeof h === "number");
    const orient = [...new Set(g.routes.flatMap((r) => r.orientations ?? []))];
    const ORDER = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    orient.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    const types = [...new Set(g.routes.map((r) => r.climbing_outdoor_type).filter(Boolean))];
    const wLoc = w?.locales?.find((l) => l.lang === "fr") ?? w?.locales?.[0];
    const src = w ?? g.routes[0];
    out.push(
      feature(lon, lat, {
        id: g.id,
        kind: "rock",
        name: wLoc?.title?.trim() || g.name,
        elevation,
        url: w
          ? `https://www.camptocamp.org/waypoints/${g.id}`
          : `https://www.camptocamp.org/routes/${g.id}`,
        dep: depOf(src) ?? depOf(g.routes[0]),
        massif: massifOf(src) ?? massifOf(g.routes[0]),
        rating: free ?? global,
        orientations: orient,
        routes: g.routes.length,
        heightMax: heights.length ? Math.max(...heights) : null,
        types,
      }),
    );
  }
  console.log(`  ${out.length} sommets / parois avec voies d'escalade`);
  return out;
}

async function main() {
  const features = [
    ...(await climbing()),
    ...(await routesForActivity("via_ferrata", "via_ferrata", "via ferrata")),
    ...(await routesForActivity(
      "mountain_climbing",
      "mountain",
      "rocher haute montagne",
    )),
  ];
  const ids = new Set(features.filter((f) => f.properties.kind === "climbing").map((f) => f.properties.id));
  features.push(...(await rockRoutes(ids)));
  await addCommunes(features);
  const fc = {
    type: "FeatureCollection",
    generated: new Date().toISOString(),
    features,
  };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(fc));
  const count = (k) => features.filter((f) => f.properties.kind === k).length;
  console.log(
    `✓ ${features.length} sites écrits (${count("climbing")} escalade, ` +
      `${count("via_ferrata")} via ferrata, ${count("mountain")} rocher haute montagne, ` +
      `${count("rock")} grandes voies) → ${OUT}`,
  );

  // Classement FFME : réappliqué depuis le cache de `npm run data:ffme`, s'il existe.
  try {
    const cache = fileURLToPath(new URL("./data/ffme-sne.json", import.meta.url));
    const { sites } = JSON.parse(await readFile(cache, "utf8"));
    await annotateSectorsFile(sites);
  } catch {
    console.log("  (pas de cache FFME : lancer `npm run data:ffme` pour le classement FFME)");
  }
}

main().catch((e) => {
  console.error("\n✗", e.message);
  process.exit(1);
});
