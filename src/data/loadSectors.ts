import type { LoadProgress, Sector, SiteKind } from "./types";
import { fetchAllSites } from "./c2c";

interface SectorFeatureCollection {
  features: {
    geometry: { coordinates: [number, number] };
    properties: {
      id: number;
      kind?: SiteKind;
      name: string;
      elevation: number;
      url: string;
      dep?: string | null;
      globalRating?: string | null;
      rating?: string | null;
      orientations?: string[] | null;
      massif?: string | null;
    };
  }[];
}

/** Charge le snapshot GeoJSON statique généré par `npm run data`. */
export async function loadLocal(): Promise<Sector[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/sectors.geojson`);
  if (!res.ok) {
    throw new Error(
      `sectors.geojson introuvable (HTTP ${res.status}). Lancez d'abord \`npm run data\`.`,
    );
  }
  const fc = (await res.json()) as SectorFeatureCollection;
  return fc.features.map((f) => ({
    id: f.properties.id,
    kind: f.properties.kind ?? "climbing",
    name: f.properties.name,
    elevation: f.properties.elevation,
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    url: f.properties.url,
    dep: f.properties.dep ?? undefined,
    globalRating: f.properties.globalRating ?? undefined,
    rating: f.properties.rating ?? undefined,
    orientations: f.properties.orientations ?? undefined,
    massif: f.properties.massif ?? undefined,
  }));
}

/** Rafraîchit les données en direct depuis l'API camptocamp. */
export async function refreshFromApi(
  onProgress?: LoadProgress,
  signal?: AbortSignal,
): Promise<Sector[]> {
  return fetchAllSites({ signal, onProgress });
}

/**
 * La liste des waypoints ne fournit ni cotation ni orientation (une requête
 * par site serait nécessaire) : on les reprend du jeu précédent (snapshot).
 */
export function mergeClimbingDetails(fresh: Sector[], previous: Sector[]): Sector[] {
  const prev = new Map(previous.map((s) => [s.id, s]));
  return fresh.map((s) => {
    if (s.kind !== "climbing") return s;
    const p = prev.get(s.id);
    return p ? { ...s, rating: p.rating, orientations: p.orientations } : s;
  });
}
