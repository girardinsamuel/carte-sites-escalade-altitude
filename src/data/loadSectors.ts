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
  }));
}

/** Rafraîchit les données en direct depuis l'API camptocamp. */
export async function refreshFromApi(
  onProgress?: LoadProgress,
  signal?: AbortSignal,
): Promise<Sector[]> {
  return fetchAllSites({ signal, onProgress });
}
