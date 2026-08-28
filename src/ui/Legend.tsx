import { LEGEND_STOPS } from "../map/altitudeColor";

export function Legend() {
  const gradient = LEGEND_STOPS.map(
    (s) => `rgb(${s.color[0]},${s.color[1]},${s.color[2]})`,
  ).join(",");
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-white/50">
        Altitude du secteur
      </div>
      <div
        className="h-2 w-full rounded-full"
        style={{ background: `linear-gradient(to right, ${gradient})` }}
      />
      <div className="mt-1 flex justify-between text-[10px] text-white/40">
        <span>{LEGEND_STOPS[0].at} m</span>
        <span>{LEGEND_STOPS[LEGEND_STOPS.length - 1].at}+ m</span>
      </div>
    </div>
  );
}
