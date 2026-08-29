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
}

type Marker = { sector: Sector; x: number; y: number };

export function MapView({ sectors, maxAltitude, mode, flyTo }: Props) {
  const { details, request } = useSectorDetails();
  const [active, setActive] = useState<Marker | null>(null);
  const mapRef = useRef<MapRef>(null);
  // Secteur affiché : on ne repositionne l'infobulle qu'au changement de
  // secteur, pas à chaque mousemove (évite le clignotement).
  const activeIdRef = useRef<number | null>(null);

  const close = useCallback(() => {
    activeIdRef.current = null;
    setActive(null);
  }, []);

  // Survol comme un clic : l'infobulle se fige et ne se ferme qu'à la croix
  // (ou en déplaçant la carte). Le survol du vide ne ferme rien.
  const show = useCallback(
    (info: PickingInfo<Sector>) => {
      const obj = info.object ?? null;
      if (!obj || activeIdRef.current === obj.id) return;
      activeIdRef.current = obj.id;
      setActive({ sector: obj, x: info.x, y: info.y });
      request(obj);
    },
    [request],
  );

  // Desktop : un clic sur la carte hors épingle ferme l'infobulle.
  const handleDeckClick = useCallback(
    (info: PickingInfo<Sector>) => {
      if (info.object) return;
      if (window.matchMedia("(pointer: fine)").matches) close();
    },
    [close],
  );

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

  const layers = useMemo(
    () => [sectorLayer({ sectors, maxAltitude, mode, onClick: show, onHover: show })],
    [sectors, maxAltitude, mode, show],
  );

  return (
    <div className="absolute inset-0">
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
        onMoveStart={close}
        attributionControl={false}
        mapStyle={MAP_STYLE}
        terrain={{ source: "terrain-dem", exaggeration: 1.35 }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Source id="terrain-dem" type="raster-dem" url={TERRAIN_TILES} tileSize={256} />
        <NavigationControl position="bottom-left" visualizePitch />
        <DeckOverlay interleaved layers={layers} onClick={handleDeckClick} />
      </Map>
      {active && (
        <SectorTooltip
          sector={active.sector}
          detail={details.get(active.sector.id)}
          x={active.x}
          y={active.y}
          pinned
          onClose={close}
        />
      )}
      <CreditsWidget />
    </div>
  );
}
