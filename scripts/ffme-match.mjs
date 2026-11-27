// Rattache les sites camptocamp aux sites naturels d'escalade FFME
// (scripts/data/ffme-sne.json) : proximité GPS + ressemblance des noms.
// Ajoute à chaque site rattaché : ffmeId, ffmeClass (classement FFME), et
// ffmeUnsure quand les noms ne se ressemblent qu'en partie (à vérifier).
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

/** Racine simple : pluriel et féminin confondus (roches/roche/roch, fleurie/fleuri). */
const stem = (t) => t.replace(/s$/, "").replace(/e$/, "");

const tokens = (s) => [
  ...new Set(
    norm(s)
      .split(" ")
      .filter((t) => t.length > 1 && !STOP.has(t))
      .map(stem),
  ),
];

/** Distance d'édition ≤ 1 (une lettre ajoutée, retirée ou changée). */
function oneEdit(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return (
    a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i)
  );
}

const sameToken = (x, y) => x === y || (x.length >= 5 && y.length >= 5 && oneEdit(x, y));

/**
 * Comparateur de noms, 0 à 1. Les mots sont pondérés par leur rareté dans
 * `corpus` : « calanques », « gorges », « verdon »… comptent peu, un nom
 * propre de falaise compte beaucoup. Tolère pluriels, féminins et fautes
 * d'une lettre ; un nom inclus dans l'autre vaut 1 s'il contient un mot rare.
 */
export function makeNameSim(corpus = []) {
  const df = new Map();
  for (const n of corpus) for (const t of tokens(n)) df.set(t, (df.get(t) ?? 0) + 1);
  const N = Math.max(corpus.length, 1);
  const weight = (t) => Math.log(1 + N / (df.get(t) ?? 1));
  const rare = Math.log(1 + N / 5);

  return (a, b) => {
    const ta = tokens(a);
    const tb = tokens(b);
    if (!ta.length || !tb.length) return 0;
    const [small, large] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
    const na = norm(a).replace(/ /g, "");
    const nb = norm(b).replace(/ /g, "");
    const shortest = na.length <= nb.length ? na : nb;
    if (
      shortest.length >= 5 &&
      (na.includes(nb) || nb.includes(na)) &&
      Math.max(...small.map(weight)) >= rare
    )
      return 1;
    const total = (ts) => ts.reduce((s, t) => s + weight(t), 0);
    let common = 0;
    for (const t of small) if (large.some((u) => sameToken(t, u))) common += weight(t);
    return Math.min(1, common / Math.min(total(ta), total(tb)));
  };
}

/** Comparateur sans pondération (tous les mots valent 1). */
export const nameSim = makeNameSim();

function distKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const h =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const MAX_KM = 3;
/** En dessous de cette ressemblance de noms, le rattachement est marqué « à vérifier ». */
export const SURE_SIM = 0.75;

/**
 * Site FFME correspondant à un site camptocamp, ou null : noms très proches
 * jusqu'à 3 km, assez proches jusqu'à 1 km, ou en partie communs jusqu'à
 * 400 m (secteurs d'une même falaise). Pas de rattachement à la seule
 * proximité (deux falaises voisines ont souvent des classements différents).
 */
export function bestMatch(site, grid, sim = nameSim) {
  let best = null;
  let bestScore = -Infinity;
  const ci = Math.floor(site.lat / 0.05);
  const cj = Math.floor(site.lon / 0.05);
  for (let i = ci - 1; i <= ci + 1; i++)
    for (let j = cj - 1; j <= cj + 1; j++)
      for (const f of grid.get(`${i}|${j}`) ?? []) {
        const d = distKm(site.lat, site.lon, f.lat, f.lon);
        if (d > MAX_KM) continue;
        const s = sim(site.name, f.name);
        if (!((s >= SURE_SIM && d <= MAX_KM) || (s >= 0.5 && d <= 1) || (s >= 0.35 && d <= 0.4))) continue;
        const score = s * 2 - d;
        if (score > bestScore) {
          bestScore = score;
          best = { ...f, sim: s };
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
  const sim = makeNameSim([
    ...ffme.map((s) => s.name),
    ...fc.features.filter((f) => f.properties.dep).map((f) => f.properties.name),
  ]);
  let candidates = 0;
  let matched = 0;
  let unsure = 0;
  const used = new Set();
  for (const f of fc.features) {
    const p = f.properties;
    delete p.ffmeId;
    delete p.ffmeClass;
    delete p.ffmeUnsure;
    if (p.kind !== "climbing" || !p.dep) continue;
    candidates++;
    const [lon, lat] = f.geometry.coordinates;
    const m = bestMatch({ name: p.name, lat, lon }, grid, sim);
    if (!m) continue;
    p.ffmeId = m.id;
    p.ffmeClass = m.type;
    if (m.sim < SURE_SIM) {
      p.ffmeUnsure = true;
      unsure++;
    }
    used.add(m.id);
    matched++;
  }
  await writeFile(SECTORS, JSON.stringify(fc));
  console.log(
    `✓ classement FFME : ${matched}/${candidates} sites d'escalade français rattachés ` +
      `dont ${unsure} à vérifier (${used.size}/${ffme.length} sites FFME utilisés) → ${SECTORS}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { sites } = JSON.parse(await readFile(CACHE, "utf8"));
  await annotateSectorsFile(sites);
}
