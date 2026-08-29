import proj4 from "proj4";
import type { LoadProgress, Sector, SectorDetails, SiteKind } from "./types";
import { depCodeByName } from "./departements";

const WAYPOINTS = "https://api.camptocamp.org/waypoints";
const ROUTES = "https://api.camptocamp.org/routes";
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
  locales?: { title?: string; title_prefix?: string }[];
  geometry?: { geom?: string | null } | null;
  areas?: C2cArea[];
}

interface C2cRouteDoc extends C2cDoc {
  elevation_min?: number | null;
  elevation_max?: number | null;
}

function parsePoint(geom: string | null | undefined): [number, number] | null {
  if (!geom) return null;
  let coords: [number, number];
  try {
    coords = JSON.parse(geom).coordinates;
  } catch {
    return null;
  }
  const [lon, lat] = toWgs84(coords[0], coords[1]);
  return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
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

/** Waypoint `climbing_outdoor` → Sector, ou null si inexploitable. */
export function docToSector(doc: C2cDoc): Sector | null {
  if (typeof doc.elevation !== "number") return null;
  const pt = parsePoint(doc.geometry?.geom);
  if (!pt) return null;
  return {
    id: doc.document_id,
    kind: "climbing",
    name: doc.locales?.[0]?.title?.trim() || `Secteur #${doc.document_id}`,
    elevation: doc.elevation,
    lon: pt[0],
    lat: pt[1],
    url: `https://www.camptocamp.org/waypoints/${doc.document_id}`,
    dep: depOf(doc),
  };
}

/** Itinéraire camptocamp → Sector. `elevation` : fournie ou fallback. */
export function routeToSector(
  doc: C2cRouteDoc,
  kind: Exclude<SiteKind, "climbing">,
  fallbackElevation?: number,
): Sector | null {
  const pt = parsePoint(doc.geometry?.geom);
  if (!pt) return null;
  const elevation = doc.elevation_max ?? doc.elevation_min ?? fallbackElevation;
  if (typeof elevation !== "number") return null;
  const loc = doc.locales?.[0];
  const title = loc?.title?.trim();
  const name =
    loc?.title_prefix && title
      ? `${loc.title_prefix} : ${title}`
      : title || `Itinéraire #${doc.document_id}`;
  return {
    id: doc.document_id,
    kind,
    name,
    elevation,
    lon: pt[0],
    lat: pt[1],
    url: `https://www.camptocamp.org/routes/${doc.document_id}`,
    dep: depOf(doc),
  };
}

interface FetchOpts {
  signal?: AbortSignal;
  onProgress?: LoadProgress;
}

async function paginate<T>(
  baseUrl: string,
  map: (doc: T) => Sector | null,
  { signal, onProgress }: FetchOpts,
): Promise<Sector[]> {
  const out: Sector[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const res = await fetch(`${baseUrl}&limit=${PAGE}&offset=${offset}`, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`API camptocamp: HTTP ${res.status}`);
    const json = (await res.json()) as { total?: number; documents?: T[] };

    total = json.total ?? 0;
    for (const doc of json.documents ?? []) {
      const s = map(doc);
      if (s) out.push(s);
    }

    offset += PAGE;
    onProgress?.(Math.min(offset, total), total);
    if (!json.documents?.length) break;
  }
  return out;
}

/** Tous les sites `climbing_outdoor`. */
export function fetchClimbingWaypoints(opts: FetchOpts = {}): Promise<Sector[]> {
  return paginate<C2cDoc>(`${WAYPOINTS}?wtyp=climbing_outdoor`, docToSector, opts);
}

/** Itinéraires d'une activité (via ferrata, rocher haute montagne…). */
function fetchRoutesByActivity(
  activity: string,
  kind: Exclude<SiteKind, "climbing">,
  opts: FetchOpts = {},
): Promise<Sector[]> {
  return paginate<C2cRouteDoc>(
    `${ROUTES}?act=${activity}`,
    (doc) => routeToSector(doc, kind),
    opts,
  );
}

export const fetchViaFerrata = (opts?: FetchOpts) =>
  fetchRoutesByActivity("via_ferrata", "via_ferrata", opts);

export const fetchMountainRoutes = (opts?: FetchOpts) =>
  fetchRoutesByActivity("mountain_climbing", "mountain", opts);

/** Escalade + via ferrata + rocher haute montagne, avec progression cumulée. */
export async function fetchAllSites({
  signal,
  onProgress,
}: FetchOpts = {}): Promise<Sector[]> {
  const loaded = [0, 0, 0];
  const total = [0, 0, 0];
  const sum = (a: number[]) => a[0] + a[1] + a[2];
  const track =
    (i: number) =>
    (l: number, t: number) => {
      loaded[i] = l;
      total[i] = t;
      onProgress?.(sum(loaded), sum(total));
    };

  const [climbing, vf, mountain] = await Promise.all([
    fetchClimbingWaypoints({ signal, onProgress: track(0) }),
    fetchViaFerrata({ signal, onProgress: track(1) }),
    fetchMountainRoutes({ signal, onProgress: track(2) }),
  ]);
  return [...climbing, ...vf, ...mountain];
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
  via_ferrata_rating?: string | null;
  global_rating?: string | null;
  rock_free_rating?: string | null;
  height_diff_up?: number | null;
}

async function fetchDetail(path: string, signal?: AbortSignal): Promise<C2cDetail> {
  const res = await fetch(`https://api.camptocamp.org/${path}?l=fr`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`API camptocamp: HTTP ${res.status}`);
  return (await res.json()) as C2cDetail;
}

const EMPTY_DETAILS: SectorDetails = {
  types: [],
  orientations: [],
  rockTypes: [],
  climbingStyles: [],
  routesQuantity: null,
  ratingMin: null,
  ratingMax: null,
  heightMax: null,
  viaFerrataRating: null,
  globalRating: null,
};

/** Détail d'un secteur d'escalade (waypoint). */
export async function fetchWaypointDetails(
  id: number,
  signal?: AbortSignal,
): Promise<SectorDetails> {
  const d = await fetchDetail(`waypoints/${id}`, signal);
  return {
    ...EMPTY_DETAILS,
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

/** Détail d'un itinéraire (via ferrata, rocher haute montagne). */
export async function fetchRouteDetails(
  id: number,
  signal?: AbortSignal,
): Promise<SectorDetails> {
  const d = await fetchDetail(`routes/${id}`, signal);
  return {
    ...EMPTY_DETAILS,
    orientations: d.orientations ?? [],
    rockTypes: d.rock_types ?? [],
    heightMax: d.height_diff_up ?? null,
    ratingMax: d.rock_free_rating ?? null,
    viaFerrataRating: d.via_ferrata_rating ?? null,
    globalRating: d.global_rating ?? null,
  };
}
