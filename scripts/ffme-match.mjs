// Rattache les sites camptocamp aux sites naturels d'escalade FFME
// (scripts/data/ffme-sne.json) : proximité GPS + ressemblance des noms.
// Ajoute à chaque site rattaché : ffmeId, ffmeClass (classement FFME).
//
// Usage direct (sans relire les fiches) : node scripts/ffme-match.mjs

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SECTORS = fileURLToPath(new URL("../public/data/sectors.geojson", import.meta.url));
const CACHE = fileURLToPath(new URL("./data/ffme-sne.json", import.meta.url));

/** Mots sans intérêt pour comparer des noms de falaises. */
const STOP = new Set(
  ("le la les l de du des d et en au aux a sur sous un une site sites secteur secteurs " +
    "falaise falaises rocher rochers roche roches escalade ecole voie voies mur bloc blocs " +
    "the of saint st ste sainte").split(" "),
);

const norm = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokens = (s) => new Set(norm(s).split(" ").filter((t) => t.length > 1 && !STOP.has(t)));

/** Ressemblance de deux noms, 0 à 1 (mots communs, ou nom inclus dans l'autre). */
export function nameSim(a, b) {
  const na = norm(a).replace(/ /g, "");
  const nb = norm(b).replace(/ /g, "");
  if (na && nb && (na === nb || (Math.min(na.length, nb.length) >= 5 && (na.includes(nb) || nb.includes(na)))))
    return 1;
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / Math.min(ta.size, tb.size);
}

function distKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const h =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const MAX_KM = 3;

/**
 * Site FFME correspondant à un site camptocamp, ou null.
 * Accepté si les noms se ressemblent (proche), ou si les points sont quasi
 * confondus (secteur camptocamp d'une falaise FFME), ou même commune et proche.
 */
export function bestMatch(site, ffme, grid) {
  let best = null;
  let bestScore = -Infinity;
  const ci = Math.floor(site.lat / 0.05);
  const cj = Math.floor(site.lon / 0.05);
  for (let i = ci - 1; i <= ci + 1; i++)
    for (let j = cj - 1; j <= cj + 1; j++)
      for (const f of grid.get(`${i}|${j}`) ?? []) {
        const d = distKm(site.lat, site.lon, f.lat, f.lon);
        if (d > MAX_KM) continue;
        const sim = Math.max(nameSim(site.name, f.name), site.commune ? 0 : 0);
        const sameTown = site.commune && f.city && norm(site.commune) === norm(f.city);
        const ok =
          (sim >= 0.5 && d <= MAX_KM) ||
          (sim > 0 && d <= 1) ||
          d <= 0.15 ||
          (sameTown && d <= 0.4);
        if (!ok) continue;
        const score = sim * 2 - d + (sameTown ? 0.3 : 0);
        if (score > bestScore) {
          bestScore = score;
          best = f;
        }
      }
  return best;
}

export function buildGrid(ffme) {
  const grid = new Map();
  for (const f of ffme) {
    const k = `${Math.floor(f.lat / 0.05)}|${Math.floor(f.lon / 0.05)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(f);
  }
  return grid;
}

/** Annote public/data/sectors.geojson (sites d'escalade) avec le classement FFME. */
export async function annotateSectorsFile(ffmeSites) {
  const ffme = ffmeSites.filter((s) => s.type);
  const grid = buildGrid(ffme);
  const fc = JSON.parse(await readFile(SECTORS, "utf8"));
  let candidates = 0;
  let matched = 0;
  const used = new Set();
  for (const f of fc.features) {
    const p = f.properties;
    delete p.ffmeId;
    delete p.ffmeClass;
    if (p.kind !== "climbing" || !p.dep) continue;
    candidates++;
    const [lon, lat] = f.geometry.coordinates;
    const m = bestMatch({ name: p.name, commune: p.commune, lat, lon }, ffme, grid);
    if (!m) continue;
    p.ffmeId = m.id;
    p.ffmeClass = m.type;
    used.add(m.id);
    matched++;
  }
  await writeFile(SECTORS, JSON.stringify(fc));
  console.log(
    `✓ classement FFME : ${matched}/${candidates} sites d'escalade français rattachés ` +
      `(${used.size}/${ffme.length} sites FFME utilisés) → ${SECTORS}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { sites } = JSON.parse(await readFile(CACHE, "utf8"));
  await annotateSectorsFile(sites);
}
