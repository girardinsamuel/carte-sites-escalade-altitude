import { LEGEND_STOPS } from "../map/altitudeColor";

const PIN_CLIMB =
  "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z";
const PIN_VIA =
  "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM8.6 6.6h6.8v1.7H8.6zm0 3.4h6.8v1.7H8.6z";
const PIN_MTN =
  "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM12 5.4l3.8 6.4H8.2z";

function Glyph({ d }: { d: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

export function Legend() {
  const gradient = LEGEND_STOPS.map(
    (s) => `rgb(${s.color[0]},${s.color[1]},${s.color[2]})`,
  ).join(",");
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-white/50">
        Altitude du site
      </div>
      <div
        className="h-2 w-full rounded-full"
        style={{ background: `linear-gradient(to right, ${gradient})` }}
      />
      <div className="mt-1 flex justify-between text-[10px] text-white/40">
        <span>{LEGEND_STOPS[0].at} m</span>
        <span>{LEGEND_STOPS[LEGEND_STOPS.length - 1].at}+ m</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/60">
        <span className="flex items-center gap-1">
          <Glyph d={PIN_CLIMB} />
          Escalade
        </span>
        <span className="flex items-center gap-1">
          <Glyph d={PIN_VIA} />
          Via ferrata
        </span>
        <span className="flex items-center gap-1">
          <Glyph d={PIN_MTN} />
          Rocher haute montagne
        </span>
      </div>
    </div>
  );
}
