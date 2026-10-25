/** Libellés FR des valeurs d'énumération camptocamp. */

import type { SiteKind } from "./types";

export const KIND_LABEL: Record<SiteKind, string> = {
  climbing: "Sites d'escalade",
  via_ferrata: "Via ferrata",
  mountain: "Rocher haute montagne",
};

export const KIND_SHORT: Record<SiteKind, string> = {
  climbing: "Escalade",
  via_ferrata: "Via ferrata",
  mountain: "Rocher HM",
};

/** Cotations globales camptocamp, de la plus facile à la plus difficile. */
export const GLOBAL_RATINGS = [
  "F", "F+", "PD-", "PD", "PD+", "AD-", "AD", "AD+", "D-", "D", "D+",
  "TD-", "TD", "TD+", "ED-", "ED", "ED+", "ED4", "ED5", "ED6", "ED7",
];

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
