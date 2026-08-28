import { useLayoutEffect, useRef, useState } from "react";
import type { Sector } from "../data/types";
import type { DetailEntry } from "../map/useSectorDetails";
import { cap, ratingRange, styleLabel, typeLabel } from "../data/labels";

interface Props {
  sector: Sector;
  detail: DetailEntry | undefined;
  x: number;
  y: number;
  /** Épinglée après un clic : l'infobulle devient interactive (lien cliquable). */
  pinned?: boolean;
  onClose?: () => void;
}

/** Marge minimale entre l'infobulle et le bord de l'écran. */
const MARGIN = 12;

function DetailBody({ detail }: { detail: DetailEntry | undefined }) {
  if (!detail || detail === "loading")
    return (
      <div className="flex justify-center py-4" role="status" aria-label="Chargement">
        <span className="block size-7 animate-spin rounded-full border-2 border-white/25 border-t-sky-300" />
      </div>
    );
  if (detail === "error")
    return <div className="mt-1 text-white/40">Détails indisponibles</div>;

  const stats = [
    detail.routesQuantity ? `${detail.routesQuantity} voies` : null,
    ratingRange(detail.ratingMin, detail.ratingMax),
    detail.heightMax ? `${detail.heightMax} m max` : null,
  ].filter(Boolean);

  const empty =
    detail.types.length === 0 &&
    detail.orientations.length === 0 &&
    detail.rockTypes.length === 0 &&
    detail.climbingStyles.length === 0 &&
    stats.length === 0;

  if (empty) return <div className="mt-1 text-white/40">Pas de détails renseignés</div>;

  return (
    <div className="mt-1 space-y-0.5 text-white/80">
      {detail.types.length > 0 && <div>{detail.types.map(typeLabel).join(", ")}</div>}
      {detail.orientations.length > 0 && (
        <div>Orientation : {detail.orientations.join(", ")}</div>
      )}
      {detail.rockTypes.length > 0 && <div>{detail.rockTypes.map(cap).join(", ")}</div>}
      {detail.climbingStyles.length > 0 && (
        <div>{detail.climbingStyles.map(styleLabel).join(", ")}</div>
      )}
      {stats.length > 0 && <div>{stats.join(" · ")}</div>}
    </div>
  );
}

export function SectorTooltip({ sector, detail, x, y, pinned = false, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x + 14, top: y - 6, ready: false });

  // Garde l'infobulle dans l'écran (mobile inclus) : au-dessus à droite par
  // défaut, bascule à gauche / en dessous quand ça dépasse un bord.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = x + 14;
    if (left + width > vw - MARGIN) left = x - 14 - width;
    left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, vw - width - MARGIN));

    let top = y - 8 - height;
    if (top < MARGIN) top = y + 18;
    top = Math.min(Math.max(top, MARGIN), Math.max(MARGIN, vh - height - MARGIN));

    setPos({ left, top, ready: true });
  }, [x, y, detail, pinned, sector.id]);

  return (
    <div
      ref={ref}
      className={`absolute z-30 max-h-[calc(100vh-1.5rem)] max-w-[min(15rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg bg-slate-900/95 px-2.5 py-2 text-xs leading-snug text-white shadow-xl ring-1 ring-white/10 ${
        pinned ? "pointer-events-auto" : "pointer-events-none"
      }`}
      style={{
        left: pos.left,
        top: pos.top,
        visibility: pos.ready ? "visible" : "hidden",
      }}
    >
      {pinned && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la fiche"
          className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white active:bg-white/25"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
      <div className={`font-semibold ${pinned ? "pr-10" : ""}`}>{sector.name}</div>
      <div className="text-white/55">{Math.round(sector.elevation)} m</div>
      <DetailBody detail={detail} />
      <a
        href={sector.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1.5 inline-block font-medium text-sky-300 underline decoration-sky-300/40 underline-offset-2 hover:text-sky-200"
      >
        Fiche camptocamp ↗
      </a>
    </div>
  );
}
