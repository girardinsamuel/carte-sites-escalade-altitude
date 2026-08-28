/** Un secteur d'escalade prêt à afficher (dérivé d'un waypoint camptocamp). */
export interface Sector {
  id: number;
  name: string;
  /** Altitude en mètres — pilote le filtre du curseur. */
  elevation: number;
  lon: number;
  lat: number;
  /** URL de la fiche camptocamp.org. */
  url: string;
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
}

/**
 * Mode d'affichage vis-à-vis de l'altitude limite :
 * - `below`      : uniquement les secteurs sous la limite
 * - `above`      : uniquement les secteurs au-dessus de la limite
 * - `highlight`  : tous les secteurs, ceux au-dessus de la limite en rouge foncé
 */
export type DisplayMode = "below" | "above" | "highlight";
