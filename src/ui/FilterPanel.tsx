import { useState } from "react";
import type { DisplayMode } from "../data/types";
import type { Place } from "../data/geocode";
import { AltitudeSlider } from "./AltitudeSlider";
import { CitySearch } from "./CitySearch";
import { DepartementFilter } from "./DepartementFilter";
import { ModeToggle } from "./ModeToggle";
import { Legend } from "./Legend";

interface Props {
  onCitySelect: (place: Place) => void;
  selectedDeps: string[];
  onDepsChange: (codes: string[]) => void;
  depCounts: Map<string, number>;
  /** Altitude limite choisie au curseur. */
  maxAltitude: number;
  /** Borne haute du curseur (altitude la plus élevée du jeu de données). */
  sliderMax: number;
  onAltitudeChange: (v: number) => void;
  mode: DisplayMode;
  onModeChange: (m: DisplayMode) => void;
  belowCount: number;
  aboveCount: number;
  /** Nombre de secteurs après filtre département. */
  totalCount: number;
  /** Taille du jeu de données complet. */
  datasetCount: number;
  source: "local" | "api";
  refreshing: boolean;
  progress: { loaded: number; total: number } | null;
  error: string | null;
  onRefresh: () => void;
}

export function FilterPanel({
  onCitySelect,
  selectedDeps,
  onDepsChange,
  depCounts,
  maxAltitude,
  sliderMax,
  onAltitudeChange,
  mode,
  onModeChange,
  belowCount,
  aboveCount,
  totalCount,
  datasetCount,
  source,
  refreshing,
  progress,
  error,
  onRefresh,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const summary =
    mode === "below"
      ? `${belowCount} / ${totalCount} secteurs à ≤ ${maxAltitude} m`
      : mode === "above"
        ? `${aboveCount} / ${totalCount} secteurs à > ${maxAltitude} m`
        : `${totalCount} secteurs · ${aboveCount} au-dessus de ${maxAltitude} m en rouge`;
  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-10 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-white shadow-2xl backdrop-blur-md">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Afficher les filtres" : "Masquer les filtres"}
        aria-expanded={!collapsed}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-800/80 text-white shadow-lg transition hover:bg-slate-700"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={collapsed ? "" : "rotate-180"}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <h1 className="pr-8 text-sm font-semibold tracking-tight">
        Carte des sites d'escalade / altitude
      </h1>
      <p className="mt-0.5 text-xs text-white/50">
        Données camptocamp.org · {datasetCount} sites
      </p>

      <div className={collapsed ? "hidden" : ""}>
        <div className="my-4 h-px bg-white/10" />

        <CitySearch onSelect={onCitySelect} />

        <div className="my-4 h-px bg-white/10" />

        <DepartementFilter
          selected={selectedDeps}
          counts={depCounts}
          onChange={onDepsChange}
        />

        <div className="my-4 h-px bg-white/10" />

        <AltitudeSlider value={maxAltitude} max={sliderMax} onChange={onAltitudeChange} />

        <p className="mt-3 text-xs tabular-nums text-white/70">{summary}</p>

        <div className="my-4 h-px bg-white/10" />

        <ModeToggle value={mode} onChange={onModeChange} />

        <div className="my-4 h-px bg-white/10" />

        <Legend />

        <div className="my-4 h-px bg-white/10" />

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="w-full rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing
            ? progress
              ? `Chargement… ${progress.loaded}/${progress.total}`
              : "Chargement…"
            : "Rafraîchir depuis camptocamp"}
        </button>
        <p className="mt-2 text-center text-[10px] text-white/40">
          Source actuelle : {source === "api" ? "API en direct" : "snapshot local"}
        </p>
        {error && (
          <p className="mt-2 rounded-md bg-red-500/15 px-2 py-1.5 text-[11px] text-red-200">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
