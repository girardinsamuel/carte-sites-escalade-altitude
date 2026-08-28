const KEY = import.meta.env.VITE_MAPTILER_KEY;

export interface Place {
  id: string;
  /** Nom court de la ville. */
  name: string;
  /** Libellé complet avec contexte (région, pays). */
  label: string;
  center: [number, number];
  bbox?: [number, number, number, number];
}

interface Feature {
  id: string | number;
  text?: string;
  place_name?: string;
  center: [number, number];
  bbox?: [number, number, number, number];
}

/** Autocomplétion de villes via l'API de géocodage MapTiler. */
export async function geocodeCities(
  query: string,
  signal?: AbortSignal,
): Promise<Place[]> {
  const url =
    `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json` +
    `?key=${KEY}&language=fr&limit=6&types=municipality,municipal_district,locality`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Géocodage: HTTP ${res.status}`);
  const json = (await res.json()) as { features?: Feature[] };

  return (json.features ?? []).map((f) => ({
    id: String(f.id),
    name: f.text ?? f.place_name ?? "?",
    label: f.place_name ?? f.text ?? "?",
    center: f.center,
    bbox: f.bbox,
  }));
}
