/** Libellés FR des valeurs d'énumération camptocamp. */

const TYPE_LABELS: Record<string, string> = {
  single: "Couenne / falaise",
  multi: "Grande voie",
  bloc: "Bloc",
  psicobloc: "Psicobloc",
  deep_water: "Deep water",
};

export function typeLabel(v: string): string {
  return TYPE_LABELS[v] ?? v;
}

const STYLE_LABELS: Record<string, string> = {
  slab: "Dalle",
  vertical: "Vertical",
  overhang: "Dévers",
  roof: "Toit",
  wall: "Mur",
  crack: "Fissure",
  pillar: "Pilier",
};

export function styleLabel(v: string): string {
  return STYLE_LABELS[v] ?? cap(v);
}

export function cap(v: string): string {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/** "4c–7b", "7b", ou null si aucune cotation. */
export function ratingRange(min: string | null, max: string | null): string | null {
  if (min && max && min !== max) return `${min}–${max}`;
  return max ?? min ?? null;
}
