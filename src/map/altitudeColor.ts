type RGB = [number, number, number];

/** Stops de couleur du plus bas (vallée) au plus haut (haute montagne). */
const STOPS: { at: number; color: RGB }[] = [
  { at: 0, color: [56, 176, 0] }, // vert
  { at: 800, color: [255, 214, 10] }, // jaune
  { at: 1600, color: [255, 140, 0] }, // orange
  { at: 2600, color: [230, 57, 70] }, // rouge
  { at: 3800, color: [237, 242, 251] }, // neige
];

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/** Couleur d'un secteur selon son altitude (RGB 0-255). */
export function altitudeColor(elevation: number): RGB {
  if (elevation <= STOPS[0].at) return STOPS[0].color;
  if (elevation >= STOPS[STOPS.length - 1].at) return STOPS[STOPS.length - 1].color;
  for (let i = 1; i < STOPS.length; i++) {
    const prev = STOPS[i - 1];
    const next = STOPS[i];
    if (elevation <= next.at) {
      const t = (elevation - prev.at) / (next.at - prev.at);
      return [
        lerp(prev.color[0], next.color[0], t),
        lerp(prev.color[1], next.color[1], t),
        lerp(prev.color[2], next.color[2], t),
      ];
    }
  }
  return STOPS[STOPS.length - 1].color;
}

export const LEGEND_STOPS = STOPS;
