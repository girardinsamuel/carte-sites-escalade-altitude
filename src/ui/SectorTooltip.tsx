import type { Sector } from "../data/types";
import type { DetailEntry } from "../map/useSectorDetails";
import { cap, ratingRange, styleLabel, typeLabel } from "../data/labels";

interface Props {
  sector: Sector;
  detail: DetailEntry | undefined;
  x: number;
  y: number;
}

function DetailBody({ detail }: { detail: DetailEntry | undefined }) {
  if (!detail || detail === "loading")
    return <div className="mt-1 text-white/40">Détails…</div>;
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

export function SectorTooltip({ sector, detail, x, y }: Props) {
  return (
    <div
      className="pointer-events-none absolute z-30 max-w-[15rem] -translate-y-full rounded-lg bg-slate-900/95 px-2.5 py-2 text-xs leading-snug text-white shadow-xl ring-1 ring-white/10"
      style={{ left: x + 14, top: y - 6 }}
    >
      <div className="font-semibold">{sector.name}</div>
      <div className="text-white/55">{Math.round(sector.elevation)} m</div>
      <DetailBody detail={detail} />
    </div>
  );
}
