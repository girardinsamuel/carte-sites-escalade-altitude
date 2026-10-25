import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapView, hasMapKey } from "./map/MapView";
import { FilterPanel, type FilterPanelProps } from "./ui/FilterPanel";
import { SectorList, type Bounds } from "./ui/SectorList";
import { loadLocal, mergeClimbingDetails, refreshFromApi } from "./data/loadSectors";
import { hasEasyRating, hasRidgeTitle } from "./data/shortRope";
import type { DisplayMode, Sector, SiteKind, ViewMode } from "./data/types";
import type { Place } from "./data/geocode";

const ALL_KINDS: SiteKind[] = ["climbing", "via_ferrata", "mountain"];

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
  const [view, setView] = useState<ViewMode>("map");
  const [mapBounds, setMapBounds] = useState<Bounds | null>(null);
  const [focus, setFocus] = useState<{ sector: Sector } | null>(null);
  const [franceOnly, setFranceOnly] = useState(true);
  const [visibleKinds, setVisibleKinds] = useState<SiteKind[]>(ALL_KINDS);
  const [selectedDeps, setSelectedDeps] = useState<string[]>([]);
  const [excludeRidgeTitles, setExcludeRidgeTitles] = useState(false);
  const [excludeEasyRating, setExcludeEasyRating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState<Progress>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Curseur d'altitude calibré sur le jeu complet (stable quel que soit le filtre).
  const sliderMax = useMemo(() => deriveMax(sectors), [sectors]);

  const depCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sectors) if (s.dep) m.set(s.dep, (m.get(s.dep) ?? 0) + 1);
    return m;
  }, [sectors]);

  const kindCounts = useMemo(() => {
    const m = new Map<SiteKind, number>();
    for (const s of sectors) m.set(s.kind, (m.get(s.kind) ?? 0) + 1);
    return m;
  }, [sectors]);

  // Nombre d'itinéraires rocher HM concernés par chaque critère « corde courte ».
  const shortRopeCounts = useMemo(() => {
    let title = 0;
    let rating = 0;
    for (const s of sectors) {
      if (s.kind !== "mountain") continue;
      if (hasRidgeTitle(s)) title++;
      if (hasEasyRating(s)) rating++;
    }
    return { title, rating };
  }, [sectors]);

  const filteredSectors = useMemo(() => {
    let list = sectors.filter((s) => visibleKinds.includes(s.kind));
    if (excludeRidgeTitles)
      list = list.filter((s) => s.kind !== "mountain" || !hasRidgeTitle(s));
    if (excludeEasyRating)
      list = list.filter((s) => s.kind !== "mountain" || !hasEasyRating(s));
    if (franceOnly) list = list.filter((s) => s.dep != null);
    if (selectedDeps.length > 0)
      list = list.filter((s) => s.dep != null && selectedDeps.includes(s.dep));
    return list;
  }, [sectors, visibleKinds, excludeRidgeTitles, excludeEasyRating, franceOnly, selectedDeps]);

  const aboveCount = useMemo(
    () => filteredSectors.reduce((n, s) => (s.elevation > maxAltitude ? n + 1 : n), 0),
    [filteredSectors, maxAltitude],
  );
  const belowCount = filteredSectors.length - aboveCount;

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
        setSectors((prev) => mergeClimbingDetails(data, prev));
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

  const selectCity = useCallback((place: Place) => {
    setView((v) => (v === "list" ? "split" : v));
    setFlyTo(place);
  }, []);

  // Nouvel objet à chaque appel : re-cliquer la même ligne rouvre l'infobulle.
  const select = useCallback((s: Sector) => setFocus({ sector: s }), []);

  const locate = useCallback(
    (s: Sector) => {
      if (view === "list") {
        setView("split");
        // Laisse la carte reprendre sa taille avant de la déplacer.
        setTimeout(() => select(s), 150);
      } else {
        select(s);
      }
    },
    [view, select],
  );

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

  const panelProps: FilterPanelProps = {
    view,
    onViewChange: setView,
    onCitySelect: selectCity,
    visibleKinds,
    onVisibleKindsChange: setVisibleKinds,
    kindCounts,
    excludeRidgeTitles,
    onExcludeRidgeTitlesChange: setExcludeRidgeTitles,
    excludeEasyRating,
    onExcludeEasyRatingChange: setExcludeEasyRating,
    shortRopeCounts,
    franceOnly,
    onFranceOnlyChange: setFranceOnly,
    selectedDeps,
    onDepsChange: setSelectedDeps,
    depCounts,
    maxAltitude,
    sliderMax,
    onAltitudeChange: setMaxAltitude,
    mode,
    onModeChange: setMode,
    belowCount,
    aboveCount,
    totalCount: filteredSectors.length,
    datasetCount: sectors.length,
    source,
    refreshing,
    progress,
    error,
    onRefresh: handleRefresh,
  };

  return (
    <div className="flex h-full w-full flex-col bg-slate-950 sm:flex-row">
      {view === "list" && <FilterPanel docked {...panelProps} />}

      {/* La carte reste montée (caméra conservée), masquée en vue liste. */}
      <div
        className={
          view === "list"
            ? "hidden"
            : `relative min-h-0 min-w-0 ${view === "split" ? "h-[45%] sm:h-auto sm:flex-1" : "flex-1"}`
        }
      >
        <MapView
          sectors={filteredSectors}
          maxAltitude={maxAltitude}
          mode={mode}
          flyTo={flyTo}
          focus={focus}
          onBoundsChange={setMapBounds}
        />
        {view !== "list" && <FilterPanel {...panelProps} />}
        {view === "split" && (
          <button
            type="button"
            onClick={() => setView("list")}
            aria-label="Fermer la carte"
            title="Fermer la carte"
            className="absolute bottom-16 right-2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-900/80 text-white shadow-lg backdrop-blur-md transition hover:bg-slate-800 sm:bottom-auto sm:right-4 sm:top-4"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>

      {view !== "map" && (
        <div
          className={`min-h-0 min-w-0 flex-1 border-white/10 ${
            view === "split" ? "border-t sm:w-[min(46rem,50%)] sm:flex-none sm:border-l sm:border-t-0" : ""
          }`}
        >
          <SectorList
            sectors={filteredSectors}
            maxAltitude={maxAltitude}
            mode={mode}
            mapBounds={view === "split" ? mapBounds : null}
            onLocate={locate}
            onSelect={view === "split" ? select : undefined}
            selectedId={focus?.sector.id ?? null}
            onClose={() => setView("map")}
          />
        </div>
      )}
    </div>
  );
}
