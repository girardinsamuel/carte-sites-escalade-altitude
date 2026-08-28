import type { DisplayMode } from "../data/types";

const OPTIONS: { value: DisplayMode; label: string }[] = [
  { value: "below", label: "Secteurs en dessous de la limite" },
  { value: "above", label: "Secteurs au-dessus de la limite" },
  { value: "highlight", label: "En dessous + au-dessus en rouge foncé" },
];

interface Props {
  value: DisplayMode;
  onChange: (m: DisplayMode) => void;
}

export function ModeToggle({ value, onChange }: Props) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-white/70">Affichage</div>
      <div className="flex flex-col gap-1">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-lg px-3 py-1.5 text-left text-xs font-medium transition ${
              value === o.value
                ? "bg-sky-500 text-white"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
