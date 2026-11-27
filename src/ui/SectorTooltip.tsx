import { useLayoutEffect, useRef, useState } from "react";
import type { Sector, SiteKind } from "../data/types";
import { cap, styleLabel, typeLabel } from "../data/labels";

const KIND_TAG: Partial<Record<SiteKind, string>> = {
  via_ferrata: "Via ferrata",
  mountain: "Rocher haute montagne",
};

/** Couleur du badge de classement FFME. */
const FFME_STYLE: Record<string, string> = {
  "Site sportif": "bg-sky-500/20 text-sky-200 ring-sky-400/30",
  "Terrain d’aventure": "bg-amber-500/20 text-amber-200 ring-amber-400/30",
  "Site de bloc": "bg-violet-500/20 text-violet-200 ring-violet-400/30",
};

interface Props {
  sector: Sector;
  x: number;
  y: number;
  /** Épinglée après un clic : l'infobulle devient interactive (lien cliquable). */
  pinned?: boolean;
  onClose?: () => void;
}

/** Marge minimale entre l'infobulle et le bord de l'écran. */
const MARGIN = 12;

/**
 * Détails du site, tirés du snapshot (l'API camptocamp refuse les requêtes
 * venant d'autres domaines : rien n'est chargé au survol).
 */
function DetailBody({ sector: s }: { sector: Sector }) {
  const stats = [
    s.routes ? `${s.routes} voies` : null,
    s.rating ? (s.kind === "climbing" ? s.rating : `Cotation ${s.rating}`) : null,
    s.heightMax ? `${s.heightMax} m max` : null,
  ].filter(Boolean);
  const lines = [
    s.types?.length ? s.types.map(typeLabel).join(", ") : null,
    stats.length ? stats.join(" · ") : null,
    s.orientations?.length ? `Orientation : ${s.orientations.join(", ")}` : null,
    s.rocks?.length ? s.rocks.map(cap).join(", ") : null,
    s.styles?.length ? s.styles.map(styleLabel).join(", ") : null,
  ].filter(Boolean);

  if (!lines.length) return <div className="mt-1 text-white/40">Pas de détails renseignés</div>;
  return (
    <div className="mt-1 space-y-0.5 text-white/80">
      {lines.map((l) => (
        <div key={l}>{l}</div>
      ))}
    </div>
  );
}

function FfmeBadge({ sector: s }: { sector: Sector }) {
  if (!s.ffmeClass) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">FFME</span>
      <span
        className={`rounded px-1.5 py-px text-[11px] font-medium ring-1 ${
          FFME_STYLE[s.ffmeClass] ?? "bg-white/10 text-white/80 ring-white/15"
        }`}
      >
        {s.ffmeClass}
      </span>
      {s.ffmeUnsure && (
        <span className="text-[10px] text-white/45" title="Rattachement à la fiche FFME moins sûr">
          (à vérifier)
        </span>
      )}
    </div>
  );
}

const linkClass =
  "font-medium text-sky-300 underline decoration-sky-300/40 underline-offset-2 hover:text-sky-200";

export function SectorTooltip({ sector, x, y, pinned = false, onClose }: Props) {
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
  }, [x, y, pinned, sector.id]);

  const place = [sector.commune, sector.dep && `(${sector.dep})`].filter(Boolean).join(" ");

  return (
    <div
      ref={ref}
      className={`absolute z-30 max-h-[calc(100vh-1.5rem)] max-w-[min(16rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg bg-slate-900/95 px-2.5 py-2 text-xs leading-snug text-white shadow-xl ring-1 ring-white/10 ${
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
      <div className="text-white/55">
        {Math.round(sector.elevation)} m{place && ` · ${place}`}
        {KIND_TAG[sector.kind] && (
          <span className="ml-1.5 rounded bg-white/10 px-1 py-px text-[10px] font-medium text-white/70">
            {KIND_TAG[sector.kind]}
          </span>
        )}
      </div>
      <FfmeBadge sector={sector} />
      <DetailBody sector={sector} />
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
        <a href={sector.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
          Fiche camptocamp ↗
        </a>
        {sector.ffmeId && (
          <a
            href={`https://www.ffme.fr/sne-fiche/${sector.ffmeId}/`}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            Fiche FFME ↗
          </a>
        )}
      </div>
    </div>
  );
}
