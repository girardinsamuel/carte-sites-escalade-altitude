#!/usr/bin/env node
// Snapshot des sites `climbing_outdoor` de camptocamp -> public/data/sectors.geojson
// Usage : npm run data

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import proj4 from "proj4";
import departements from "../src/data/departements.json" with { type: "json" };

const API = "https://api.camptocamp.org/waypoints";
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

function docToFeature(doc) {
  const geom = doc.geometry?.geom;
  if (!geom || typeof doc.elevation !== "number") return null;
  let coords;
  try {
    coords = JSON.parse(geom).coordinates;
  } catch {
    return null;
  }
  const [lon, lat] = toWgs84(coords[0], coords[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lon, lat] },
    properties: {
      id: doc.document_id,
      name: doc.locales?.[0]?.title?.trim() || `Secteur #${doc.document_id}`,
      elevation: doc.elevation,
      url: `https://www.camptocamp.org/waypoints/${doc.document_id}`,
      dep: depOf(doc),
    },
  };
}

async function main() {
  const features = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const res = await fetch(
      `${API}?wtyp=climbing_outdoor&limit=${PAGE}&offset=${offset}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) throw new Error(`API camptocamp: HTTP ${res.status}`);
    const json = await res.json();
    total = json.total ?? 0;

    for (const doc of json.documents ?? []) {
      const f = docToFeature(doc);
      if (f) features.push(f);
    }

    offset += PAGE;
    process.stdout.write(`\r  ${Math.min(offset, total)}/${total} waypoints…`);
    if (!json.documents?.length) break;
    await sleep(150);
  }

  const fc = {
    type: "FeatureCollection",
    generated: new Date().toISOString(),
    features,
  };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(fc));
  process.stdout.write(
    `\n✓ ${features.length} secteurs écrits dans ${OUT}\n`,
  );
}

main().catch((e) => {
  console.error("\n✗", e.message);
  process.exit(1);
});
