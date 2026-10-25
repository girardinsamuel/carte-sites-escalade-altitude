import type { Sector } from "./types";
import { GLOBAL_RATINGS } from "./labels";

/**
 * Filtre « courses d'arêtes / corde courte » sur les itinéraires rocher haute
 * montagne. Les titres camptocamp sont multilingues : on cherche aussi les
 * équivalents allemands, italiens, anglais, espagnols…
 */

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const TITLE_PATTERNS: RegExp[] = [
  // arête / crête
  /arete/,
  /crete/,
  /grat\b/, // Grat, Westgrat, Nordostgrat…
  /\bridge\b/,
  /\bcresta\b/,
  /\barista\b/,
  /\bgreben\b/,
  // couloir
  /couloir/,
  /\bcanal(e|one)\b/,
  /rinne\b/, // Rinne, Westrinne…
  // voie normale
  /\bnormal/, // voie normale, via normale, Normalweg, normal route…
  // traversée
  /travers/, // traversée, traverse, traversata…
  /uberschreitung/,
];

/** Cotations globales strictement inférieures à AD+. */
const EASY_RATINGS = new Set(GLOBAL_RATINGS.slice(0, GLOBAL_RATINGS.indexOf("AD+")));

/** Le nom est « Sommet : Voie » — seul le titre de la voie est examiné. */
export function hasRidgeTitle(s: Sector): boolean {
  const sep = s.name.indexOf(" : ");
  const n = norm(sep >= 0 ? s.name.slice(sep + 3) : s.name);
  return TITLE_PATTERNS.some((re) => re.test(n));
}

/** Sans cotation connue, l'itinéraire est conservé. */
export function hasEasyRating(s: Sector): boolean {
  return s.globalRating != null && EASY_RATINGS.has(s.globalRating);
}
