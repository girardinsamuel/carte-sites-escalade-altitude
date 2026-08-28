import { useState, type ReactNode } from "react";
import type { DisplayMode } from "../data/types";
import type { Place } from "../data/geocode";
import { AltitudeSlider } from "./AltitudeSlider";
import { CitySearch } from "./CitySearch";
import { DepartementFilter } from "./DepartementFilter";
import { ModeToggle } from "./ModeToggle";
import { Legend } from "./Legend";

const BADGE = {
  sky: "bg-sky-500/20 text-sky-100 ring-sky-400/30",
  emerald: "bg-emerald-500/20 text-emerald-100 ring-emerald-400/30",
  amber: "bg-amber-500/20 text-amber-100 ring-amber-400/30",
} as const;

function Badge({ color, children }: { color: keyof typeof BADGE; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${BADGE[color]}`}
    >
      {children}
    </span>
  );
}

interface Props {
  onCitySelect: (place: Place) => void;
  franceOnly: boolean;
  onFranceOnlyChange: (v: boolean) => void;
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
  franceOnly,
  onFranceOnlyChange,
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

  const altitudeBadge =
    mode === "below"
      ? `Alt ≤ ${maxAltitude} m`
      : mode === "above"
        ? `Alt > ${maxAltitude} m`
        : `> ${maxAltitude} m en rouge`;

  const depBadge =
    selectedDeps.length === 0
      ? null
      : `Dép. ${selectedDeps.slice(0, 5).join(", ")}${
          selectedDeps.length > 5 ? ` +${selectedDeps.length - 5}` : ""
        }`;
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

      {collapsed && (
        <div className="mt-2 flex flex-wrap gap-1 pr-8">
          <Badge color="sky">{altitudeBadge}</Badge>
          {franceOnly && <Badge color="emerald">France</Badge>}
          {depBadge && <Badge color="amber">{depBadge}</Badge>}
        </div>
      )}

      <div className={collapsed ? "hidden" : ""}>
        <div className="my-4 h-px bg-white/10" />

        <CitySearch
          onSelect={(place) => {
            onCitySelect(place);
            // Sur mobile, on replie le panneau pour dégager la carte.
            if (window.matchMedia("(max-width: 639px)").matches) setCollapsed(true);
          }}
        />

        <div className="my-4 h-px bg-white/10" />

        <label className="flex items-center gap-2 text-xs font-medium text-white/80">
          <input
            type="checkbox"
            checked={franceOnly}
            onChange={(e) => onFranceOnlyChange(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-sky-500"
          />
          Sites en France
        </label>

        <div className="mt-3">
          <DepartementFilter
            selected={selectedDeps}
            counts={depCounts}
            onChange={onDepsChange}
          />
        </div>

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
