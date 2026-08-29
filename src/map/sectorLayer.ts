import { IconLayer } from "@deck.gl/layers";
import { DataFilterExtension, type DataFilterExtensionProps } from "@deck.gl/extensions";
import type { PickingInfo } from "@deck.gl/core";
import type { DisplayMode, Sector } from "../data/types";
import { altitudeColor } from "./altitudeColor";

const svgUri = (body: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">${body}</svg>`,
  )}`;

// Escalade : goutte + trou rond.
const PIN_SVG = svgUri(
  '<path fill="#fff" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>',
);
// Via ferrata : goutte + barreaux d'échelle évidés.
const VF_SVG = svgUri(
  '<path fill="#fff" fill-rule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM8.6 6.6h6.8v1.7H8.6zm0 3.4h6.8v1.7H8.6z"/>',
);
// Rocher haute montagne : goutte + sommet triangulaire évidé.
const MTN_SVG = svgUri(
  '<path fill="#fff" fill-rule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM12 5.4l3.8 6.4H8.2z"/>',
);

const mkIcon = (url: string) => ({ url, width: 48, height: 48, anchorY: 48, mask: true });
const PIN_ICON = mkIcon(PIN_SVG);
const VF_ICON = mkIcon(VF_SVG);
const MTN_ICON = mkIcon(MTN_SVG);

const dataFilter = new DataFilterExtension({ filterSize: 1 });

/** Rouge foncé pour les secteurs au-dessus de la limite en mode `highlight`. */
const DARK_RED: [number, number, number] = [120, 20, 28];
const ALT_MAX = 1_000_000;

interface Options {
  sectors: Sector[];
  /** Altitude limite choisie au curseur. */
  maxAltitude: number;
  mode: DisplayMode;
  onClick: (info: PickingInfo<Sector>) => void;
  onHover: (info: PickingInfo<Sector>) => void;
}

export function sectorLayer({ sectors, maxAltitude, mode, onClick, onHover }: Options) {
  // Filtre altitude sur GPU : bouger le curseur ne recrée pas la couche.
  const filterRange: [number, number] =
    mode === "above"
      ? [maxAltitude + 1, ALT_MAX]
      : mode === "below"
        ? [-1, maxAltitude]
        : [-1, ALT_MAX]; // highlight : tout est affiché

  return new IconLayer<Sector, DataFilterExtensionProps<Sector>>({
    id: "sectors",
    data: sectors,
    getPosition: (d) => [d.lon, d.lat, d.elevation],
    getIcon: (d) =>
      d.kind === "via_ferrata" ? VF_ICON : d.kind === "mountain" ? MTN_ICON : PIN_ICON,
    getColor: (d) => {
      const [r, g, b] =
        mode === "highlight" && d.elevation > maxAltitude
          ? DARK_RED
          : altitudeColor(d.elevation);
      return [r, g, b, 255];
    },
    getSize: 30,
    sizeMinPixels: 14,
    sizeMaxPixels: 44,
    billboard: true,
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 120],
    onClick,
    onHover,
    getFilterValue: (d) => d.elevation,
    filterRange,
    extensions: [dataFilter],
    updateTriggers: { getColor: [mode, maxAltitude] },
  });
}
