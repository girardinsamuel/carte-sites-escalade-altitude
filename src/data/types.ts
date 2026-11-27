/** Type de site : escalade, via ferrata, ou rocher haute montagne. */
export type SiteKind = "climbing" | "via_ferrata" | "mountain";

/** Un site (escalade ou via ferrata) prêt à afficher, dérivé de camptocamp. */
export interface Sector {
  id: number;
  kind: SiteKind;
  name: string;
  /** Altitude en mètres — pilote le filtre du curseur. */
  elevation: number;
  lon: number;
  lat: number;
  /** URL de la fiche camptocamp.org. */
  url: string;
  /** Code du département français (ex. "05"), si connu. */
  dep?: string;
  /** Cotation globale d'alpinisme (F, PD, AD…), pour les itinéraires. */
  globalRating?: string;
  /** Cotation affichable : « 5a–7b », « K3 », « TD · 6a »… */
  rating?: string;
  orientations?: string[];
  /** Massif camptocamp (zone de type `range`). */
  massif?: string;
  /** Commune (France uniquement, géocodage inverse au snapshot). */
  commune?: string;
  /** Nombre de voies (sites d'escalade, champ `routes_quantity`). */
  routes?: number;
  /** Classement FFME du site naturel d'escalade rattaché (`npm run data:ffme`). */
  ffmeClass?: string;
  /** Identifiant de la fiche SNE FFME rattachée. */
  ffmeId?: number;
  /** Rattachement FFME moins sûr (noms partiellement communs) : à vérifier. */
  ffmeUnsure?: boolean;
}

export type LoadProgress = (loaded: number, total: number) => void;

/** Caractéristiques détaillées d'un secteur (endpoint /waypoints/{id}). */
export interface SectorDetails {
  types: string[]; // climbing_outdoor_types : single, multi, bloc, psicobloc, deep_water
  orientations: string[]; // N, NE, E, SE, S, SW, W, NW
  rockTypes: string[];
  climbingStyles: string[];
  routesQuantity: number | null;
  ratingMin: string | null;
  ratingMax: string | null;
  heightMax: number | null;
  /** Cotation via ferrata (K1–K6), si applicable. */
  viaFerrataRating?: string | null;
  /** Cotation globale d'alpinisme (F, PD, AD, D, TD…), si applicable. */
  globalRating?: string | null;
}

/**
 * Mode d'affichage vis-à-vis de l'altitude limite :
 * - `below`      : uniquement les secteurs sous la limite
 * - `above`      : uniquement les secteurs au-dessus de la limite
 * - `highlight`  : tous les secteurs, ceux au-dessus de la limite en rouge foncé
 */
export type DisplayMode = "below" | "above" | "highlight";

/** Vue principale : carte seule, carte + liste, ou liste seule. */
export type ViewMode = "map" | "split" | "list";
