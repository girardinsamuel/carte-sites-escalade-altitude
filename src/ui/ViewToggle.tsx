import type { ViewMode } from "../data/types";

const OPTIONS: { value: ViewMode; label: string; icon: string }[] = [
  { value: "map", label: "Carte", icon: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" },
  { value: "split", label: "Carte + liste", icon: "M3 5h18v14H3zM12 5v14M15 9h3M15 12h3M15 15h3" },
  { value: "list", label: "Liste", icon: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" },
];

interface Props {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}

export function ViewToggle({ value, onChange }: Props) {
  return (
    <div role="group" aria-label="Vue" className="flex rounded-lg bg-white/5 p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md px-1.5 py-1 text-[11px] font-medium transition ${
            value === o.value ? "bg-sky-500 text-white" : "text-white/60 hover:bg-white/10"
          }`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={o.icon} />
          </svg>
          {o.label}
        </button>
      ))}
    </div>
  );
}
