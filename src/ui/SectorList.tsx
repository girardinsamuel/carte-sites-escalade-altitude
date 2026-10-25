import { useEffect, useMemo, useRef, useState } from "react";
import type { DisplayMode, Sector, SiteKind } from "../data/types";
import { GLOBAL_RATINGS, KIND_SHORT } from "../data/labels";
import { downloadCsv } from "../data/csv";
import { markerColor } from "../map/altitudeColor";
import { KindGlyph } from "./KindGlyph";

/** [ouest, sud, est, nord] */
export type Bounds = [number, number, number, number];

const ROW_H = 28;
const OVERSCAN = 12;
/** Colonnes après « Nom » : alt, type, cotation, orient., massif, actions. */
const REST_COLS = "3rem 4.5rem 5rem 4rem";
/** Largeur minimale des colonnes hors « Nom » (gaps et marges compris). */
const REST_MIN_PX = 470;
const NAME_MIN = 120;
const NAME_MAX = 900;
const NAME_W_KEY = "sectorList.nameWidth";

/**
 * Sans largeur choisie, « Nom » prend l'espace libre ; après redimensionnement
 * elle est fixe et c'est « Massif » qui absorbe le reste.
 */
const gridColumns = (nameW: number | null) =>
  nameW
    ? `${nameW}px ${REST_COLS} minmax(5rem,1fr) 3rem`
    : `minmax(9rem,1fr) ${REST_COLS} minmax(5rem,7.5rem) 3rem`;

function readNameWidth(): number | null {
  try {
    const v = Number(localStorage.getItem(NAME_W_KEY));
    return v >= NAME_MIN && v <= NAME_MAX ? v : null;
  } catch {
    return null;
  }
}

function saveNameWidth(w: number | null) {
  try {
    if (w == null) localStorage.removeItem(NAME_W_KEY);
    else localStorage.setItem(NAME_W_KEY, String(w));
  } catch {
    // stockage indisponible : largeur non mémorisée
  }
}

type SortKey = "name" | "elevation" | "kind" | "rating" | "massif";
type Sort = { key: SortKey; dir: 1 | -1 };

const COLUMNS: { key: SortKey | null; label: string; right?: boolean }[] = [
  { key: "name", label: "Nom" },
  { key: "elevation", label: "Alt.", right: true },
  { key: "kind", label: "Type" },
  { key: "rating", label: "Cotation" },
  { key: null, label: "Orient." },
  { key: "massif", label: "Massif" },
  { key: null, label: "" },
];

const KIND_ORDER: SiteKind[] = ["climbing", "via_ferrata", "mountain"];
const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Clé de tri de la cotation : groupée par type, puis par difficulté. */
function ratingKey(s: Sector): string | undefined {
  if (!s.rating) return undefined;
  const k = KIND_ORDER.indexOf(s.kind);
  if (s.kind === "mountain" && s.globalRating) {
    const i = GLOBAL_RATINGS.indexOf(s.globalRating);
    return `${k}|${String(i).padStart(2, "0")}|${s.rating}`;
  }
  return `${k}|${s.rating}`;
}

function sortValue(s: Sector, key: SortKey): string | number | undefined {
  switch (key) {
    case "name":
      return s.name;
    case "elevation":
      return s.elevation;
    case "kind":
      return KIND_ORDER.indexOf(s.kind);
    case "rating":
      return ratingKey(s);
    case "massif":
      return s.massif;
  }
}

function compare(a: Sector, b: Sector, { key, dir }: Sort): number {
  const va = sortValue(a, key);
  const vb = sortValue(b, key);
  // Valeurs manquantes toujours en fin de liste.
  if (va == null) return vb == null ? 0 : 1;
  if (vb == null) return -1;
  const c =
    typeof va === "number" && typeof vb === "number"
      ? va - vb
      : collator.compare(String(va), String(vb));
  return (c || collator.compare(a.name, b.name)) * dir;
}

const inBounds = (s: Sector, [w, so, e, n]: Bounds) =>
  s.lat >= so && s.lat <= n && (w <= e ? s.lon >= w && s.lon <= e : s.lon >= w || s.lon <= e);

interface Props {
  /** Sites après filtres type / département / corde courte. */
  sectors: Sector[];
  maxAltitude: number;
  mode: DisplayMode;
  /** Emprise visible de la carte (mode carte + liste), sinon null. */
  mapBounds: Bounds | null;
  onLocate: (s: Sector) => void;
  /** Clic sur une ligne (carte visible uniquement) : infobulle sur l'épingle. */
  onSelect?: (s: Sector) => void;
  selectedId: number | null;
  onClose: () => void;
}

export function SectorList({
  sectors,
  maxAltitude,
  mode,
  mapBounds,
  onLocate,
  onSelect,
  selectedId,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "name", dir: 1 });
  const [onlyVisible, setOnlyVisible] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(600);
  const [nameW, setNameW] = useState<number | null>(readNameWidth);
  const nameHeadRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; w: number } | null>(null);
  const cols = { gridTemplateColumns: gridColumns(nameW) };

  // Même règle d'affichage que la carte.
  const byMode = useMemo(
    () =>
      mode === "below"
        ? sectors.filter((s) => s.elevation <= maxAltitude)
        : mode === "above"
          ? sectors.filter((s) => s.elevation > maxAltitude)
          : sectors,
    [sectors, mode, maxAltitude],
  );

  const rows = useMemo(() => {
    const q = norm(query.trim());
    let list = byMode;
    if (onlyVisible && mapBounds) list = list.filter((s) => inBounds(s, mapBounds));
    if (q) list = list.filter((s) => norm(s.name).includes(q) || (s.massif && norm(s.massif).includes(q)));
    return [...list].sort((a, b) => compare(a, b, sort));
  }, [byMode, query, sort, onlyVisible, mapBounds]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Retour en haut quand le contenu change de nature.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [query, sort, onlyVisible]);

  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scrollTop + viewH) / ROW_H) + OVERSCAN);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const startResize = (e: React.PointerEvent<HTMLSpanElement>) => {
    const head = nameHeadRef.current;
    if (!head) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, w: head.getBoundingClientRect().width };
  };
  const moveResize = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!drag.current) return;
    const w = drag.current.w + e.clientX - drag.current.x;
    setNameW(Math.round(Math.min(NAME_MAX, Math.max(NAME_MIN, w))));
  };
  const endResize = () => {
    if (!drag.current) return;
    drag.current = null;
    setNameW((w) => {
      saveNameWidth(w);
      return w;
    });
  };
  const resetResize = () => {
    setNameW(null);
    saveNameWidth(null);
  };

  const exportCsv = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(rows, `sites-escalade-${date}.csv`);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950 text-white">
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-white/10 bg-slate-900 px-2">
        <div className="relative min-w-0 flex-1">
          <svg
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-white/40"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un nom, un massif…"
            aria-label="Rechercher dans la liste"
            className="h-7 w-full rounded-md border border-white/10 bg-white/5 pl-7 pr-2 text-xs text-white placeholder:text-white/35 focus:border-sky-400/60 focus:outline-none"
          />
        </div>

        <span className="shrink-0 text-[11px] tabular-nums text-white/50">
          {rows.length}
          <span className="hidden sm:inline"> / {byMode.length}</span>
        </span>

        {mapBounds && (
          <button
            type="button"
            onClick={() => setOnlyVisible((v) => !v)}
            aria-pressed={onlyVisible}
            title="Limiter la liste à la zone visible de la carte"
            className={`flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition ${
              onlyVisible ? "bg-sky-500 text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 2.5" />
            </svg>
            <span className="hidden sm:inline">Zone visible</span>
          </button>
        )}

        <button
          type="button"
          onClick={exportCsv}
          disabled={!rows.length}
          title="Exporter la liste affichée en CSV"
          className="flex h-7 shrink-0 items-center gap-1 rounded-md bg-white/5 px-2 text-[11px] font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-40"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
          </svg>
          CSV
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la liste"
          title="Fermer la liste"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="min-h-0 flex-1 overflow-auto"
      >
        <div style={{ minWidth: Math.max(576, (nameW ?? 0) + REST_MIN_PX) }}>
          <div
            style={cols}
            className={`sticky top-0 z-10 grid gap-x-2 border-b border-white/10 bg-slate-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/45 backdrop-blur`}
          >
            {COLUMNS.map((c, i) => {
              if (!c.key) return <span key={i}>{c.label}</span>;
              const btn = (
                <button
                  type="button"
                  onClick={() => toggleSort(c.key!)}
                  className={`flex items-center gap-0.5 uppercase hover:text-white/80 ${
                    c.right ? "w-full justify-end" : ""
                  } ${sort.key === c.key ? "text-white/80" : ""}`}
                >
                  {c.label}
                  {sort.key === c.key && <span aria-hidden="true">{sort.dir === 1 ? "▲" : "▼"}</span>}
                </button>
              );
              if (c.key !== "name") return <div key={i}>{btn}</div>;
              return (
                <div key={i} ref={nameHeadRef} className="relative">
                  {btn}
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Redimensionner la colonne Nom"
                    title="Glisser pour élargir · double-clic pour réinitialiser"
                    onPointerDown={startResize}
                    onPointerMove={moveResize}
                    onPointerUp={endResize}
                    onPointerCancel={endResize}
                    onDoubleClick={resetResize}
                    className="group absolute -right-2 -top-1.5 -bottom-1.5 flex w-3 cursor-col-resize touch-none justify-center"
                  >
                    <span className="h-full w-px bg-white/15 group-hover:w-0.5 group-hover:bg-sky-400" />
                  </span>
                </div>
              );
            })}
          </div>

          {rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-white/40">Aucun site ne correspond.</p>
          ) : (
            <div className="relative" style={{ height: rows.length * ROW_H }}>
              {rows.slice(start, end).map((s, i) => {
                const [r, g, b] = markerColor(s.elevation, mode, maxAltitude);
                const above = mode === "highlight" && s.elevation > maxAltitude;
                const selected = s.id === selectedId;
                // Fonds opaques : la colonne d'actions collée en hérite.
                const bg = selected
                  ? "bg-[#0c2a40] hover:bg-[#10344f]"
                  : above
                    ? "bg-[#1d0a12] hover:bg-[#2a0f18]"
                    : "bg-slate-950 hover:bg-slate-900";
                return (
                  <div
                    key={s.id}
                    onClick={onSelect ? () => onSelect(s) : undefined}
                    className={`absolute inset-x-0 grid items-center gap-x-2 border-b border-white/5 pl-3 text-[11px] text-white/80 ${bg} ${
                      onSelect ? "cursor-pointer" : ""
                    }`}
                    style={{ ...cols, top: (start + i) * ROW_H, height: ROW_H }}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <KindGlyph kind={s.kind} color={`rgb(${r},${g},${b})`} size={13} />
                      <span className="truncate font-medium text-white" title={s.name}>
                        {s.name}
                      </span>
                    </span>
                    <span className="text-right tabular-nums">{s.elevation}</span>
                    <span className="truncate text-white/60">{KIND_SHORT[s.kind]}</span>
                    <span className="truncate tabular-nums">{s.rating ?? "–"}</span>
                    <span className="truncate text-white/60">{s.orientations?.join(" ") ?? "–"}</span>
                    <span className="truncate text-white/60" title={s.massif}>
                      {s.massif ?? "–"}
                    </span>
                    {/* Collée à droite : actions accessibles même si la liste défile horizontalement. */}
                    <span className="sticky right-0 flex h-full items-center justify-end gap-0.5 bg-inherit pr-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onLocate(s);
                        }}
                        aria-label={`Voir ${s.name} sur la carte`}
                        title="Voir sur la carte"
                        className="flex h-5 w-5 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                          <circle cx="12" cy="12" r="7" />
                          <circle cx="12" cy="12" r="2" fill="currentColor" />
                        </svg>
                      </button>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Fiche camptocamp de ${s.name}`}
                        title="Fiche camptocamp"
                        onClick={(e) => e.stopPropagation()}
                        className="flex h-5 w-5 items-center justify-center rounded text-sky-300/80 hover:bg-white/10 hover:text-sky-200"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
                        </svg>
                      </a>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
