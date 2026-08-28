import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { NavigationControl, Source, type MapRef } from "react-map-gl/maplibre";
import type { PickingInfo } from "@deck.gl/core";
import "maplibre-gl/dist/maplibre-gl.css";
import type { DisplayMode, Sector } from "../data/types";
import type { Place } from "../data/geocode";
import { SectorTooltip } from "../ui/SectorTooltip";
import { CreditsWidget } from "../ui/CreditsWidget";
import { sectorLayer } from "./sectorLayer";
import { DeckOverlay } from "./DeckOverlay";
import { useSectorDetails } from "./useSectorDetails";

const KEY = import.meta.env.VITE_MAPTILER_KEY;
export const hasMapKey = Boolean(KEY);

const MAP_STYLE = `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${KEY}`;
const TERRAIN_TILES = `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${KEY}`;

interface Props {
  sectors: Sector[];
  maxAltitude: number;
  mode: DisplayMode;
  flyTo: Place | null;
  onSelect: (sector: Sector) => void;
}

type Hover = { sector: Sector; x: number; y: number };

export function MapView({ sectors, maxAltitude, mode, flyTo, onSelect }: Props) {
  const { details, request } = useSectorDetails();
  const [hover, setHover] = useState<Hover | null>(null);
  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    const camera = { pitch: map.getPitch(), bearing: map.getBearing(), duration: 1600 };
    if (flyTo.bbox) {
      const [w, s, e, n] = flyTo.bbox;
      map.fitBounds([[w, s], [e, n]], { padding: 80, maxZoom: 12.5, ...camera });
    } else {
      map.flyTo({ center: flyTo.center, zoom: 11.5, ...camera });
    }
  }, [flyTo]);

  const handleHover = useCallback(
    (info: PickingInfo<Sector>) => {
      if (info.object) {
        setHover({ sector: info.object, x: info.x, y: info.y });
        request(info.object.id);
      } else {
        setHover(null);
      }
    },
    [request],
  );

  const layers = useMemo(
    () => [
      sectorLayer({ sectors, maxAltitude, mode, onClick: onSelect, onHover: handleHover }),
    ],
    [sectors, maxAltitude, mode, onSelect, handleHover],
  );

  return (
    <div className="absolute inset-0" onPointerLeave={() => setHover(null)}>
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: 2.5,
          latitude: 46.6,
          zoom: 5,
          pitch: 45,
          bearing: 0,
        }}
        maxPitch={80}
        mapStyle={MAP_STYLE}
        terrain={{ source: "terrain-dem", exaggeration: 1.35 }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Source id="terrain-dem" type="raster-dem" url={TERRAIN_TILES} tileSize={256} />
        <NavigationControl position="bottom-left" visualizePitch />
        <DeckOverlay interleaved layers={layers} />
      </Map>
      {hover && (
        <SectorTooltip
          sector={hover.sector}
          detail={details.get(hover.sector.id)}
          x={hover.x}
          y={hover.y}
        />
      )}
      <CreditsWidget />
    </div>
  );
}
