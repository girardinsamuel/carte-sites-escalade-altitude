import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { geocodeCities, type Place } from "../data/geocode";

interface Props {
  onSelect: (place: Place) => void;
}

export function CitySearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  // Évite de relancer une recherche quand on écrit le nom choisi dans l'input.
  const justPicked = useRef(false);

  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      geocodeCities(q, ac.signal)
        .then((r) => {
          setResults(r);
          setActive(0);
          setOpen(true);
        })
        .catch((e: unknown) => {
          if ((e as { name?: string }).name !== "AbortError") setResults([]);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const choose = (p: Place) => {
    onSelect({ ...p });
    justPicked.current = true;
    setQuery(p.name);
    setResults([]);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[active]);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Rechercher une ville…"
        aria-label="Rechercher une ville"
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:border-sky-400 focus:outline-none"
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/40">
          …
        </span>
      )}
      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-white/10 bg-slate-800 shadow-xl">
          {results.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(p)}
                className={`block w-full px-3 py-2 text-left text-xs ${
                  i === active ? "bg-sky-500 text-white" : "text-white/80 hover:bg-white/10"
                }`}
              >
                <div className="font-medium">{p.name}</div>
                <div className={i === active ? "text-white/80" : "text-white/40"}>
                  {p.label}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
