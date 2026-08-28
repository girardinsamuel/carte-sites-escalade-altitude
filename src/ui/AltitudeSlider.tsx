import * as Slider from "@radix-ui/react-slider";

interface Props {
  value: number;
  max: number;
  onChange: (v: number) => void;
}

export function AltitudeSlider({ value, max, onChange }: Props) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-medium text-white/70">Altitude maximale</span>
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
        <Slider.Track className="relative h-1.5 grow rounded-full bg-white/20">
          <Slider.Range className="absolute h-full rounded-full bg-sky-400" />
        </Slider.Track>
        <Slider.Thumb
          aria-label="Altitude maximale"
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
