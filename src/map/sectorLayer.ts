import { IconLayer } from "@deck.gl/layers";
import { DataFilterExtension, type DataFilterExtensionProps } from "@deck.gl/extensions";
import type { PickingInfo } from "@deck.gl/core";
import type { DisplayMode, Sector } from "../data/types";
import { altitudeColor } from "./altitudeColor";

const PIN_SVG = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">' +
    '<path fill="#fff" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>' +
    "</svg>",
)}`;

const dataFilter = new DataFilterExtension({ filterSize: 1 });

/** Rouge foncé pour les secteurs au-dessus de la limite en mode `highlight`. */
const DARK_RED: [number, number, number] = [120, 20, 28];
const ALT_MAX = 1_000_000;

interface Options {
  sectors: Sector[];
  /** Altitude limite choisie au curseur. */
  maxAltitude: number;
  mode: DisplayMode;
  onClick: (sector: Sector) => void;
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
    getIcon: () => ({ url: PIN_SVG, width: 48, height: 48, anchorY: 48, mask: true }),
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
    onClick: (info: PickingInfo<Sector>) => {
      if (info.object) onClick(info.object);
    },
    onHover,
    getFilterValue: (d) => d.elevation,
    filterRange,
    extensions: [dataFilter],
    updateTriggers: { getColor: [mode, maxAltitude] },
  });
}
