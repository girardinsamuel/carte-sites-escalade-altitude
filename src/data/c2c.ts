import proj4 from "proj4";
import type { LoadProgress, Sector, SectorDetails } from "./types";
import { depCodeByName } from "./departements";

const API = "https://api.camptocamp.org/waypoints";
const PAGE = 100;

/** camptocamp stocke la géométrie en EPSG:3857 (Web Mercator). */
function toWgs84(x: number, y: number): [number, number] {
  const [lon, lat] = proj4("EPSG:3857", "EPSG:4326", [x, y]) as [number, number];
  return [lon, lat];
}

interface C2cArea {
  area_type?: string;
  locales?: { lang?: string; title?: string }[];
}

interface C2cDoc {
  document_id: number;
  elevation?: number | null;
  locales?: { title?: string }[];
  geometry?: { geom?: string | null } | null;
  areas?: C2cArea[];
}

/** Code de département depuis les zones `admin_limits` du document. */
export function depOf(doc: C2cDoc): string | undefined {
  for (const a of doc.areas ?? []) {
    if (a.area_type !== "admin_limits") continue;
    const title =
      a.locales?.find((l) => l.lang === "fr")?.title ?? a.locales?.[0]?.title;
    const code = title ? depCodeByName(title) : undefined;
    if (code) return code;
  }
  return undefined;
}

/** Transforme un document brut de l'API en Sector, ou null si inexploitable. */
export function docToSector(doc: C2cDoc): Sector | null {
  const geom = doc.geometry?.geom;
  if (!geom || typeof doc.elevation !== "number") return null;
  let coords: [number, number];
  try {
    coords = JSON.parse(geom).coordinates;
  } catch {
    return null;
  }
  const [lon, lat] = toWgs84(coords[0], coords[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return {
    id: doc.document_id,
    name: doc.locales?.[0]?.title?.trim() || `Secteur #${doc.document_id}`,
    elevation: doc.elevation,
    lon,
    lat,
    url: `https://www.camptocamp.org/waypoints/${doc.document_id}`,
    dep: depOf(doc),
  };
}

interface FetchOpts {
  signal?: AbortSignal;
  onProgress?: LoadProgress;
}

/** Récupère tous les sites `climbing_outdoor` en paginant l'API camptocamp. */
export async function fetchClimbingWaypoints(
  { signal, onProgress }: FetchOpts = {},
): Promise<Sector[]> {
  const out: Sector[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const url = `${API}?wtyp=climbing_outdoor&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`API camptocamp: HTTP ${res.status}`);
    const json = (await res.json()) as { total?: number; documents?: C2cDoc[] };

    total = json.total ?? 0;
    for (const doc of json.documents ?? []) {
      const sector = docToSector(doc);
      if (sector) out.push(sector);
    }

    offset += PAGE;
    onProgress?.(Math.min(offset, total), total);
    if (!json.documents?.length) break;
  }

  return out;
}

interface C2cDetail {
  climbing_outdoor_types?: string[] | null;
  orientations?: string[] | null;
  rock_types?: string[] | null;
  climbing_styles?: string[] | null;
  routes_quantity?: number | null;
  climbing_rating_min?: string | null;
  climbing_rating_max?: string | null;
  height_max?: number | null;
}

/** Détail d'un secteur (orientation, type, cotations…), chargé à la demande. */
export async function fetchWaypointDetails(
  id: number,
  signal?: AbortSignal,
): Promise<SectorDetails> {
  const res = await fetch(`https://api.camptocamp.org/waypoints/${id}?l=fr`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`API camptocamp: HTTP ${res.status}`);
  const d = (await res.json()) as C2cDetail;
  return {
    types: d.climbing_outdoor_types ?? [],
    orientations: d.orientations ?? [],
    rockTypes: d.rock_types ?? [],
    climbingStyles: d.climbing_styles ?? [],
    routesQuantity: d.routes_quantity ?? null,
    ratingMin: d.climbing_rating_min ?? null,
    ratingMax: d.climbing_rating_max ?? null,
    heightMax: d.height_max ?? null,
  };
}
