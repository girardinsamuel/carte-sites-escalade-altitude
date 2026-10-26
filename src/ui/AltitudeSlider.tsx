import * as Slider from "@radix-ui/react-slider";
import type { DisplayMode } from "../data/types";
import { ABOVE_COLOR } from "../map/altitudeColor";

interface Props {
  value: number;
  max: number;
  mode: DisplayMode;
  onChange: (v: number) => void;
}

const LABEL: Record<DisplayMode, string> = {
  below: "Altitude maximale",
  above: "Altitude minimale",
  highlight: "Altitude limite",
};

export function AltitudeSlider({ value, max, mode, onChange }: Props) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-medium text-white/70">{LABEL[mode]}</span>
        <span className="tabular-nums text-sm font-semibold text-white">
          {value} m
        </span>
      </div>
      <Slider.Root
        className="relative flex h-5 w-full touch-none select-none items-center"
        min={0}
        max={max}
        step={50}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      >
        {/* La partie colorée suit le mode : sous le curseur, au-dessus, ou
            les deux (au-dessus en rouge foncé, comme sur la carte). */}
        <Slider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-white/20">
          {mode === "above" ? (
            <Slider.Range className="absolute h-full opacity-0" />
          ) : (
            <Slider.Range className="absolute h-full rounded-full bg-sky-400" />
          )}
          {mode !== "below" && (
            <div
              className={`absolute inset-y-0 right-0 rounded-full ${mode === "above" ? "bg-sky-400" : ""}`}
              style={{
                left: `${pct}%`,
                background:
                  mode === "highlight" ? `rgb(${ABOVE_COLOR.join(",")})` : undefined,
              }}
            />
          )}
        </Slider.Track>
        <Slider.Thumb
          aria-label={LABEL[mode]}
          className="block h-4 w-4 rounded-full bg-white shadow-md ring-2 ring-sky-400 transition focus:outline-none focus-visible:ring-4"
        />
      </Slider.Root>
      <div className="mt-1 flex justify-between text-[10px] text-white/40">
        <span>0 m</span>
        <span>{max} m</span>
      </div>
    </div>
  );
}
