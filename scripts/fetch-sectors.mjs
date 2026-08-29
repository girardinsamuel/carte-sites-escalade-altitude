#!/usr/bin/env node
// Snapshot camptocamp -> public/data/sectors.geojson
//  - sites d'escalade : waypoints climbing_outdoor
//  - via ferrata      : itinéraires act=via_ferrata (altitude via route,
//    sinon repli sur les waypoints associés)
// Usage : npm run data

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import proj4 from "proj4";
import departements from "../src/data/departements.json" with { type: "json" };

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

const feature = (lon, lat, props) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lon, lat] },
  properties: props,
});

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  return res.json();
}

async function* paginate(baseUrl, label) {
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const json = await getJson(`${baseUrl}&limit=${PAGE}&offset=${offset}`);
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
      }),
    );
  }
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
      }),
    );
  }
  if (missing) console.log(`  (${missing} ${label} sans altitude, ignorées)`);
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
      `${count("via_ferrata")} via ferrata, ${count("mountain")} rocher haute montagne) → ${OUT}`,
  );
}

main().catch((e) => {
  console.error("\n✗", e.message);
  process.exit(1);
});
