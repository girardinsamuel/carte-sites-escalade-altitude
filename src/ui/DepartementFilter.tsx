import { useEffect, useMemo, useRef, useState } from "react";
import { DEPARTEMENTS, depLabel, norm } from "../data/departements";

interface Props {
  selected: string[];
  /** Nombre de secteurs par code de département (jeu complet). */
  counts: Map<string, number>;
  onChange: (codes: string[]) => void;
}

export function DepartementFilter({ selected, counts, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const options = useMemo(() => {
    const q = norm(query);
    if (q) {
      return DEPARTEMENTS.filter(
        (d) => norm(d.nom).includes(q) || d.code.toLowerCase().startsWith(q),
      ).slice(0, 40);
    }
    // Sans recherche : uniquement les départements présents dans les données.
    return DEPARTEMENTS.filter((d) => counts.has(d.code));
  }, [query, counts]);

  const toggle = (code: string) => {
    onChange(
      selected.includes(code)
        ? selected.filter((c) => c !== code)
        : [...selected, code],
    );
  };

  return (
    <div ref={boxRef}>
      <div className="mb-2 text-xs font-medium text-white/70">Départements</div>

      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {selected.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-2 py-0.5 text-[11px] text-sky-100"
            >
              {depLabel(code)}
              <button
                type="button"
                aria-label={`Retirer ${depLabel(code)}`}
                onClick={() => toggle(code)}
                className="text-sky-200/70 hover:text-white"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative flex items-stretch gap-1">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Nom ou code…"
          aria-label="Rechercher un département"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:border-sky-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            onChange([]);
            setQuery("");
          }}
          disabled={selected.length === 0}
          aria-label="Supprimer les filtres département"
          title="Supprimer les filtres"
          className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 text-sm text-white/70 transition hover:bg-white/10 disabled:opacity-30"
        >
          ×
        </button>

        {open && options.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-slate-800 shadow-xl">
            {options.map((d) => {
              const on = selected.includes(d.code);
              const n = counts.get(d.code);
              return (
                <li key={d.code}>
                  <button
                    type="button"
                    onClick={() => toggle(d.code)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs ${
                      on ? "bg-sky-500/30 text-white" : "text-white/80 hover:bg-white/10"
                    }`}
                  >
                    <span>
                      {on ? "✓ " : ""}
                      {d.nom} <span className="text-white/40">({d.code})</span>
                    </span>
                    {n != null && <span className="shrink-0 text-white/40">{n}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
