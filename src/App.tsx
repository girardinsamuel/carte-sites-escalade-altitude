import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapView, hasMapKey } from "./map/MapView";
import { FilterPanel } from "./ui/FilterPanel";
import { loadLocal, refreshFromApi } from "./data/loadSectors";
import type { DisplayMode, Sector } from "./data/types";
import type { Place } from "./data/geocode";

type Progress = { loaded: number; total: number } | null;

function deriveMax(sectors: Sector[]): number {
  if (!sectors.length) return 5000;
  const max = Math.max(...sectors.map((s) => s.elevation));
  return Math.ceil(max / 100) * 100;
}

export default function App() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [source, setSource] = useState<"local" | "api">("local");
  const [maxAltitude, setMaxAltitude] = useState(1500);
  const [mode, setMode] = useState<DisplayMode>("below");
  const [flyTo, setFlyTo] = useState<Place | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState<Progress>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sliderMax = useMemo(() => deriveMax(sectors), [sectors]);
  const aboveCount = useMemo(
    () => sectors.reduce((n, s) => (s.elevation > maxAltitude ? n + 1 : n), 0),
    [sectors, maxAltitude],
  );
  const belowCount = sectors.length - aboveCount;

  // Chargement initial depuis le snapshot statique.
  useEffect(() => {
    let cancelled = false;
    loadLocal()
      .then((data) => {
        if (!cancelled) setSectors(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(
            `${e instanceof Error ? e.message : e}. Cliquez sur « Rafraîchir » pour charger depuis l'API.`,
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRefresh = useCallback(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setRefreshing(true);
    setProgress(null);
    setError(null);
    refreshFromApi((loaded, total) => setProgress({ loaded, total }), ac.signal)
      .then((data) => {
        if (ac.signal.aborted) return;
        setSectors(data);
        setSource("api");
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setError(
          `Échec du rafraîchissement (${e instanceof Error ? e.message : e}). Données locales conservées.`,
        );
      })
      .finally(() => {
        if (!ac.signal.aborted) {
          setRefreshing(false);
          setProgress(null);
        }
      });
  }, []);

  const handleSelect = useCallback((sector: Sector) => {
    window.open(sector.url, "_blank", "noopener,noreferrer");
  }, []);

  if (!hasMapKey) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950 p-6 text-center text-white">
        <div className="max-w-md">
          <h1 className="text-lg font-semibold">Clé MapTiler manquante</h1>
          <p className="mt-2 text-sm text-white/60">
            Créez un fichier <code className="rounded bg-white/10 px-1">.env</code> à la
            racine avec&nbsp;:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-left text-xs">
            VITE_MAPTILER_KEY=votre_cle
          </pre>
          <p className="mt-3 text-xs text-white/40">
            Clé gratuite sur cloud.maptiler.com, puis relancez <code>npm run dev</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <MapView
        sectors={sectors}
        maxAltitude={maxAltitude}
        mode={mode}
        flyTo={flyTo}
        onSelect={handleSelect}
      />
      <FilterPanel
        onCitySelect={setFlyTo}
        maxAltitude={maxAltitude}
        sliderMax={sliderMax}
        onAltitudeChange={setMaxAltitude}
        mode={mode}
        onModeChange={setMode}
        belowCount={belowCount}
        aboveCount={aboveCount}
        totalCount={sectors.length}
        source={source}
        refreshing={refreshing}
        progress={progress}
        error={error}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
