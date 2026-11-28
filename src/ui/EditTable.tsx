import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Sector } from "../data/types";
import { assignRegions, REGIONS } from "../data/regions";
import { CitySearch } from "./CitySearch";
import {
  CLASSEMENTS,
  LEVELS,
  fetchEntries,
  readAuthor,
  saveAuthor,
  saveEntries,
  type Entry,
  type EntryField,
} from "../data/entries";

const ROW_H = 40;
/** Hauteur d'une carte de site (affichage mobile). */
const CARD_H = 300;
const MOBILE_QUERY = "(max-width: 767px)";

function useIsMobile() {
  const [m, setM] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}
const OVERSCAN = 10;
const REFRESH_MS = 30_000;
/** La saisie ne concerne que les sites au-dessus de cette altitude (m). */
export const MIN_ALTITUDE = 1500;
/** Au-delà, une modification groupée demande confirmation. */
const CONFIRM_OVER = 20;

const COLS =
  "2rem minmax(11rem,1.6fr) minmax(7rem,1fr) 4rem 5rem 7rem 9rem minmax(8rem,1fr) minmax(8rem,1fr) 7rem 7rem 6rem";
const MIN_W = 1180;

const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const RADII = [10, 25, 50, 100];

/** Centre du filtre « autour de » : position GPS ou ville choisie. */
interface Around {
  lat: number;
  lon: number;
  label: string;
  radius: number;
}
const AROUND_KEY = "saisie.autour";
function readAround(): Around | null {
  try {
    const v = JSON.parse(localStorage.getItem(AROUND_KEY) ?? "null");
    return v && Number.isFinite(v.lat) && Number.isFinite(v.lon) ? v : null;
  } catch {
    return null;
  }
}
function storeAround(a: Around | null) {
  try {
    if (a) localStorage.setItem(AROUND_KEY, JSON.stringify(a));
    else localStorage.removeItem(AROUND_KEY);
  } catch {
    // stockage indisponible : filtre non mémorisé
  }
}

function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const h =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Valeur affichée : saisie partagée si elle existe, sinon donnée d'origine. */
function baseValue(s: Sector, f: EntryField): string {
  if (f === "routes") return s.routes ? String(s.routes) : "";
  if (f === "rating") return s.rating ?? "";
  if (f === "classement") return s.ffmeClass ? s.ffmeClass + (s.ffmeUnsure ? " (?)" : "") : "";
  return "";
}

// ---------------------------------------------------------------------------

/** Explications affichées avant la première saisie (et via le bouton « ? »). */
function IntroDialog({ onContinue, firstTime }: { onContinue: () => void; firstTime: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-labelledby="intro-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl bg-slate-900 p-5 text-sm leading-relaxed text-white/85 shadow-2xl ring-1 ring-white/10"
      >
        <h2 id="intro-title" className="text-base font-semibold text-white">
          Saisie collaborative
        </h2>
        <p className="mt-3">
          Cet outil vous permet de renseigner, pour chaque site ou secteur : l'intérêt pour les
          guides, l'intérêt pour les moniteur·ices d'escalade, le mode de gestion et les équipeurs.
        </p>
        <p className="mt-3">
          Les sites sont répartis <strong className="text-white">par massifs</strong> dans les
          onglets. Ils ne sont pas répartis par vallées : le découpage serait trop complexe. Pour
          trouver les sites qui vous concernent, utilisez plutôt{" "}
          <strong className="text-white">la barre de recherche</strong>, ou{" "}
          <strong className="text-white">le rayon</strong> autour de votre position ou d'une ville.
        </p>
        <p className="mt-3">Vous pouvez ensuite :</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            <strong className="text-white">éditer ligne par ligne</strong> (gestion, équipeurs,
            fréquentation, intérêt) directement dans les cellules de la ligne ;
          </li>
          <li>
            <strong className="text-white">éditer par lot</strong> : après une recherche, appliquez
            une valeur à tous les résultats affichés (ou aux lignes cochées) avec les boutons en
            haut de la liste.
          </li>
        </ul>
        <p className="mt-3">
          Tout est sauvegardé automatiquement, avec le prénom de la personne qui a fait la
          modification. Si vous vous connectez depuis un autre appareil, votre prénom vous sera
          redemandé.
        </p>
        <button
          type="button"
          autoFocus
          onClick={onContinue}
          className="mt-5 h-11 w-full rounded-lg bg-sky-500 text-sm font-semibold text-white transition hover:bg-sky-400"
        >
          {firstTime ? "Continuer" : "Fermer"}
        </button>
      </div>
    </div>
  );
}

function AuthorDialog({ initial, onSave }: { initial: string; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim());
        }}
        className="w-full max-w-sm rounded-xl bg-slate-900 p-5 text-white shadow-2xl ring-1 ring-white/10"
      >
        <h2 className="text-base font-semibold">Votre prénom</h2>
        <p className="mt-1 text-xs text-white/60">
          Les saisies sont partagées avec toute l'équipe. Votre prénom est enregistré avec chaque
          modification.
        </p>
        <input
          autoFocus
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          placeholder="Prénom"
          className="mt-4 h-11 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-sm focus:border-sky-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="mt-3 h-11 w-full rounded-lg bg-sky-500 text-sm font-semibold transition hover:bg-sky-400 disabled:opacity-40"
        >
          Commencer
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------

const BIG_BTN =
  "h-10 min-w-[4.5rem] rounded-lg px-3 text-sm font-semibold transition disabled:opacity-40";

function LevelButtons({
  label,
  onPick,
  disabled,
}: {
  label: string;
  onPick: (v: string | null) => void;
  disabled: boolean;
}) {
  const colors = ["bg-slate-600", "bg-emerald-700", "bg-amber-600", "bg-rose-600"];
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-white/50">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {LEVELS.map((l, i) => (
          <button
            key={l}
            type="button"
            disabled={disabled}
            onClick={() => onPick(l)}
            className={`${BIG_BTN} ${colors[i]} text-white hover:brightness-110`}
          >
            {l}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onPick(null)}
          className={`${BIG_BTN} bg-white/5 text-white/70 ring-1 ring-white/15 hover:bg-white/10`}
        >
          Effacer
        </button>
      </div>
    </div>
  );
}

function TextApply({
  label,
  onApply,
  disabled,
}: {
  label: string;
  onApply: (v: string | null) => void;
  disabled: boolean;
}) {
  const [v, setV] = useState("");
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-white/50">{label}</div>
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          onApply(v.trim() || null);
        }}
      >
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="Valeur (vide = effacer)"
          className="h-10 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 text-base focus:border-sky-400 focus:outline-none md:text-sm"
        />
        <button
          type="submit"
          disabled={disabled}
          className={`${BIG_BTN} bg-sky-600 text-white hover:bg-sky-500`}
        >
          Appliquer
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------

const cellInput =
  "h-7 w-full min-w-0 rounded border border-transparent bg-transparent px-1.5 text-xs text-white hover:border-white/15 focus:border-sky-400 focus:bg-slate-900 focus:outline-none";
// Mobile : champs plus grands, texte à 16 px (évite le zoom automatique d'iOS).
const cellInputBig =
  "h-9 w-full min-w-0 rounded-md border border-white/10 bg-white/5 px-2 text-base text-white focus:border-sky-400 focus:bg-slate-900 focus:outline-none";

/** Champ texte enregistré à la sortie du champ (ou Entrée) s'il a changé. */
function TextCell({
  value,
  base,
  onSave,
  inputMode,
  big,
}: {
  value: string | null | undefined;
  base: string;
  onSave: (v: string | null) => void;
  inputMode?: "numeric";
  big?: boolean;
}) {
  const shown = value ?? base;
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);
  const commit = () => {
    const v = draft.trim();
    if (v !== shown.trim()) onSave(v || null);
  };
  return (
    <input
      value={draft}
      inputMode={inputMode}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(shown);
          (e.target as HTMLInputElement).blur();
        }
      }}
      title={value == null && base ? "Donnée d'origine (modifiable)" : undefined}
      className={`${big ? cellInputBig : cellInput} ${value == null ? "text-white/45" : ""}`}
    />
  );
}

function SelectCell({
  value,
  base,
  options,
  onSave,
  big,
}: {
  value: string | null | undefined;
  base: string;
  options: readonly string[];
  onSave: (v: string | null) => void;
  big?: boolean;
}) {
  const shown = value ?? base;
  const opts = shown && !options.includes(shown) ? [shown, ...options] : options;
  return (
    <select
      value={shown}
      onChange={(e) => onSave(e.target.value || null)}
      className={`${big ? cellInputBig : cellInput} cursor-pointer ${value == null ? "text-white/45" : ""} [&>option]:bg-slate-900 [&>option]:text-white`}
    >
      <option value="">—</option>
      {opts.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

interface RowProps {
  sector: Sector;
  entry: Entry | undefined;
  checked: boolean;
  regionName?: string;
  top: number;
  onToggle: (id: number) => void;
  onSave: (id: number, field: EntryField, v: string | null) => void;
}

const Row = memo(function Row({ sector: s, entry, checked, regionName, top, onToggle, onSave }: RowProps) {
  const save = (f: EntryField) => (v: string | null) => onSave(s.id, f, v);
  return (
    <div
      style={{ top, height: ROW_H, gridTemplateColumns: COLS }}
      className={`absolute inset-x-0 grid items-center gap-x-1.5 border-b border-white/5 px-2 text-xs ${
        checked ? "bg-sky-500/15" : "hover:bg-white/[0.03]"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(s.id)}
        aria-label={`Sélectionner ${s.name}`}
        className="h-4 w-4 accent-sky-500"
      />
      <div className="min-w-0">
        <a
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          title={s.name}
          className="block truncate font-medium text-white hover:text-sky-300"
        >
          {s.name}
        </a>
        {regionName && <div className="truncate text-[10px] text-white/40">{regionName}</div>}
      </div>
      <span className="truncate text-white/60" title={s.massif}>
        {s.massif ?? "—"}
      </span>
      <span className="text-right tabular-nums text-white/80">{Math.round(s.elevation)}</span>
      <TextCell value={entry?.routes} base={baseValue(s, "routes")} onSave={save("routes")} inputMode="numeric" />
      <TextCell value={entry?.rating} base={baseValue(s, "rating")} onSave={save("rating")} />
      <SelectCell
        value={entry?.classement}
        base={baseValue(s, "classement")}
        options={CLASSEMENTS}
        onSave={save("classement")}
      />
      <TextCell value={entry?.gestion} base="" onSave={save("gestion")} />
      <TextCell value={entry?.equipeurs} base="" onSave={save("equipeurs")} />
      <SelectCell value={entry?.frequentation} base="" options={LEVELS} onSave={save("frequentation")} />
      <SelectCell value={entry?.interet} base="" options={LEVELS} onSave={save("interet")} />
      <span
        className="truncate text-white/50"
        title={entry ? `${entry.updatedBy}, ${new Date(entry.updatedAt).toLocaleString("fr-FR")}` : undefined}
      >
        {entry?.updatedBy ?? ""}
      </span>
    </div>
  );
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-white/45">
        {label}
      </span>
      {children}
    </label>
  );
}

/** Affichage mobile : un site par carte, champs en deux colonnes. */
const Card = memo(function Card({ sector: s, entry, checked, regionName, top, onToggle, onSave }: RowProps) {
  const save = (f: EntryField) => (v: string | null) => onSave(s.id, f, v);
  return (
    <div
      style={{ top, height: CARD_H }}
      className={`absolute inset-x-0 overflow-hidden border-b border-white/10 px-3 py-2.5 ${
        checked ? "bg-sky-500/15" : ""
      }`}
    >
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(s.id)}
          aria-label={`Sélectionner ${s.name}`}
          className="mt-0.5 h-5 w-5 shrink-0 accent-sky-500"
        />
        <div className="min-w-0 flex-1">
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-sm font-semibold text-white"
          >
            {s.name}
          </a>
          <div className="truncate text-xs text-white/50">
            {Math.round(s.elevation)} m · {s.massif ?? "—"}
            {regionName ? ` · ${regionName}` : ""}
          </div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5">
        <Field label="Nb voies">
          <TextCell big value={entry?.routes} base={baseValue(s, "routes")} onSave={save("routes")} inputMode="numeric" />
        </Field>
        <Field label="Difficultés">
          <TextCell big value={entry?.rating} base={baseValue(s, "rating")} onSave={save("rating")} />
        </Field>
        <Field label="Classement">
          <SelectCell big value={entry?.classement} base={baseValue(s, "classement")} options={CLASSEMENTS} onSave={save("classement")} />
        </Field>
        <Field label="Gestion">
          <TextCell big value={entry?.gestion} base="" onSave={save("gestion")} />
        </Field>
        <Field label="Équipeurs">
          <TextCell big value={entry?.equipeurs} base="" onSave={save("equipeurs")} />
        </Field>
        <Field label="Fréq. guides">
          <SelectCell big value={entry?.frequentation} base="" options={LEVELS} onSave={save("frequentation")} />
        </Field>
        <Field label="Intérêt DE">
          <SelectCell big value={entry?.interet} base="" options={LEVELS} onSave={save("interet")} />
        </Field>
        <div className="flex items-end pb-2 text-xs text-white/45">
          {entry ? `Saisi par ${entry.updatedBy}` : ""}
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------

interface Props {
  /** Sites affichés (filtres de type / pays de la carte ; l'altitude est ignorée). */
  sectors: Sector[];
  allSectors: Sector[];
  onClose: () => void;
}

export function EditTable({ sectors, allSectors, onClose }: Props) {
  const [author, setAuthor] = useState(readAuthor);
  const [askAuthor, setAskAuthor] = useState(false);
  // Première ouverture sur cet appareil : explications, puis prénom.
  const [showIntro, setShowIntro] = useState(() => !readAuthor());
  const [entries, setEntries] = useState<Map<number, Entry>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "error" | "saving"; text: string } | null>(null);
  const [tab, setTab] = useState<string>(REGIONS[0].id);
  const [query, setQuery] = useState("");
  const [around, setAroundState] = useState<Around | null>(readAround);
  const [filterTab, setFilterTab] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const setAround = (a: Around | null) => {
    setAroundState(a);
    storeAround(a);
    setFilterTab(null);
  };
  const locate = () => {
    if (!navigator.geolocation) {
      setStatus({ kind: "error", text: "Géolocalisation non disponible sur cet appareil" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        setAround({
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          label: "ma position",
          radius: around?.radius ?? 25,
        });
      },
      (e) => {
        setLocating(false);
        setStatus({
          kind: "error",
          text:
            e.code === e.PERMISSION_DENIED
              ? "Position refusée : choisissez une ville à la place"
              : "Position introuvable : choisissez une ville à la place",
        });
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  };
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [bulkOpenMobile, setBulkOpenMobile] = useState(false);
  const bulkOpen = !isMobile || bulkOpenMobile;
  const [listTop, setListTop] = useState(0);
  const listTopRef = useRef(0);
  listTopRef.current = listTop;
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(600);

  // Saisies partagées : chargement, puis rafraîchissement régulier.
  const reload = useCallback(() => {
    fetchEntries()
      .then((list) => {
        setEntries(new Map(list.map((e) => [e.siteId, e])));
        setLoadError(null);
      })
      .catch((e: unknown) =>
        setLoadError(`Saisies indisponibles (${e instanceof Error ? e.message : e}).`),
      );
  }, []);
  useEffect(() => {
    reload();
    const t = setInterval(reload, REFRESH_MS);
    window.addEventListener("focus", reload);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", reload);
    };
  }, [reload]);

  const high = useMemo(() => sectors.filter((s) => s.elevation > MIN_ALTITUDE), [sectors]);
  const regionOf = useMemo(() => assignRegions(high, allSectors), [high, allSectors]);
  const byRegion = useMemo(() => {
    const m = new Map<string, Sector[]>(REGIONS.map((r) => [r.id, []]));
    for (const s of high) {
      const r = regionOf.get(s.id);
      if (r) m.get(r.id)!.push(s);
    }
    for (const list of m.values()) list.sort((a, b) => collator.compare(a.name, b.name));
    return m;
  }, [high, regionOf]);

  const q = norm(query.trim());
  // Distance au centre « autour de », pour filtrer, trier et afficher.
  const dist = useMemo(() => {
    if (!around) return null;
    const m = new Map<number, number>();
    for (const s of high) m.set(s.id, distKm(around.lat, around.lon, s.lat, s.lon));
    return m;
  }, [around, high]);
  /** Résultats tous onglets confondus (recherche et / ou rayon), sinon null. */
  const allResults = useMemo(() => {
    if (!q && !around) return null;
    const out: Sector[] = [];
    for (const list of byRegion.values())
      for (const s of list) {
        if (around && dist!.get(s.id)! > around.radius) continue;
        if (
          q &&
          !(
            norm(s.name).includes(q) ||
            (s.massif && norm(s.massif).includes(q)) ||
            (s.commune && norm(s.commune).includes(q))
          )
        )
          continue;
        out.push(s);
      }
    if (dist) out.sort((a, b) => dist.get(a.id)! - dist.get(b.id)!);
    return out;
  }, [q, around, dist, byRegion]);
  // Un onglet cliqué pendant un filtre restreint les résultats à cet onglet.
  const results = useMemo(
    () =>
      allResults && filterTab
        ? allResults.filter((s) => regionOf.get(s.id)?.id === filterTab)
        : allResults,
    [allResults, filterTab, regionOf],
  );
  const resultCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of allResults ?? []) {
      const id = regionOf.get(s.id)!.id;
      m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  }, [allResults, regionOf]);

  const rows = results ?? byRegion.get(tab) ?? [];
  const tabs = REGIONS.filter((r) => (byRegion.get(r.id)?.length ?? 0) > 0);
  useEffect(() => {
    if (!tabs.some((t) => t.id === tab) && tabs[0]) setTab(tabs[0].id);
  }, [tabs, tab]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile]);
  // Mobile : la liste défile avec le reste de la page ; position de son début.
  useLayoutEffect(() => {
    setListTop(isMobile ? (listRef.current?.offsetTop ?? 0) : 0);
  });
  useEffect(() => {
    // Revient au début de la liste (sur mobile, sans remonter au-dessus des filtres).
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: isMobile ? Math.min(el.scrollTop, listTopRef.current) : 0 });
  }, [tab, q, around, filterTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const itemH = isMobile ? CARD_H : ROW_H;
  const start = Math.max(0, Math.floor((scrollTop - listTop) / itemH) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scrollTop - listTop + viewH) / itemH) + OVERSCAN);
  const subtitle = (s: Sector) =>
    results
      ? [regionOf.get(s.id)?.name, dist && `${Math.round(dist.get(s.id)!)} km`].filter(Boolean).join(" · ")
      : undefined;

  const toggle = useCallback(
    (id: number) =>
      setChecked((c) => {
        const n = new Set(c);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    [],
  );
  const allChecked = rows.length > 0 && rows.every((s) => checked.has(s.id));
  const toggleAll = () =>
    setChecked((c) => {
      const n = new Set(c);
      if (allChecked) rows.forEach((s) => n.delete(s.id));
      else rows.forEach((s) => n.add(s.id));
      return n;
    });

  /** Enregistre puis fusionne la réponse ; annule l'affichage en cas d'échec. */
  const persist = useCallback(
    async (ids: number[], fields: Partial<Record<EntryField, string | null>>) => {
      if (!author) {
        setAskAuthor(true);
        return false;
      }
      setStatus({ kind: "saving", text: "Enregistrement…" });
      try {
        const updated = await saveEntries(author, ids, fields);
        setEntries((m) => {
          const n = new Map(m);
          for (const e of updated) n.set(e.siteId, e);
          return n;
        });
        setStatus({
          kind: "ok",
          text: ids.length > 1 ? `${ids.length} sites mis à jour` : "Enregistré",
        });
        return true;
      } catch (e) {
        setStatus({ kind: "error", text: `Échec : ${e instanceof Error ? e.message : e}` });
        reload();
        return false;
      }
    },
    [author, reload],
  );

  const saveCell = useCallback(
    (id: number, field: EntryField, v: string | null) => void persist([id], { [field]: v }),
    [persist],
  );

  // Cible des boutons groupés : les cases cochées, sinon tous les résultats affichés.
  const target = checked.size ? [...checked] : rows.map((s) => s.id);
  const targetLabel = checked.size
    ? `${checked.size} site${checked.size > 1 ? "s" : ""} coché${checked.size > 1 ? "s" : ""}`
    : results
      ? `tous les résultats affichés (${rows.length})`
      : `tout l'onglet (${rows.length})`;
  const bulk = (field: EntryField, label: string) => (v: string | null) => {
    if (!target.length) return;
    if (
      target.length > CONFIRM_OVER &&
      !window.confirm(`${label} = « ${v ?? "vide"} » pour ${target.length} sites ?`)
    )
      return;
    void persist(target, { [field]: v });
  };

  const dialogs = (
    <>
      {showIntro && (
        <IntroDialog
          firstTime={!author}
          onContinue={() => {
            setShowIntro(false);
            if (!author) setAskAuthor(true);
          }}
        />
      )}
      {askAuthor && !showIntro && (
        <AuthorDialog
          initial={author}
          onSave={(n) => {
            saveAuthor(n);
            setAuthor(n);
            setAskAuthor(false);
          }}
        />
      )}
    </>
  );

  /* En-tête : retour, recherche, aide, prénom */
  const header = (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-slate-900 px-3 py-2">
      <button
        type="button"
        onClick={onClose}
        className="flex h-9 items-center gap-1 rounded-lg bg-white/5 px-3 text-sm font-medium text-white/80 hover:bg-white/10"
      >
        ← Carte
      </button>
      <h1 className="min-w-0 flex-1 truncate text-sm font-semibold md:flex-none">
        Saisie<span className="hidden sm:inline"> collaborative</span>{" "}
        <span className="font-normal text-white/50">· &gt; {MIN_ALTITUDE} m</span>
      </h1>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher (nom, massif, commune)…"
        aria-label="Rechercher dans tous les onglets"
        className="order-last h-10 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-base placeholder:text-white/35 focus:border-sky-400 focus:outline-none md:order-none md:h-9 md:w-auto md:min-w-[12rem] md:flex-1 md:text-sm"
      />
      <button
        type="button"
        onClick={() => setShowIntro(true)}
        title="Comment ça marche ?"
        aria-label="Aide"
        className="h-9 w-9 shrink-0 rounded-lg bg-white/5 text-sm font-semibold text-white/70 hover:bg-white/10"
      >
        ?
      </button>
      <button
        type="button"
        onClick={() => setAskAuthor(true)}
        title="Changer de prénom"
        className="h-9 max-w-[9rem] shrink-0 truncate rounded-lg bg-white/5 px-3 text-sm text-white/70 hover:bg-white/10"
      >
        {author ? `👤 ${author}` : "Prénom ?"}
      </button>
    </div>
  );

  /* Filtre « autour de » : position GPS ou ville, et rayon */
  const aroundBar = (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-slate-900/80 px-3 py-2 text-xs">
      <span className="font-medium text-white/60">Autour de :</span>
      <button
        type="button"
        onClick={locate}
        disabled={locating}
        className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
      >
        📍 {locating ? "Localisation…" : "Ma position"}
      </button>
      <span className="text-white/40">ou</span>
      <div className="min-w-[11rem] flex-1 md:w-56 md:flex-none">
        <CitySearch
          onSelect={(p) =>
            setAround({ lon: p.center[0], lat: p.center[1], label: p.name, radius: around?.radius ?? 25 })
          }
        />
      </div>
      <span className="text-white/60 md:ml-1">Rayon</span>
      <div className="flex gap-1">
        {RADII.map((r) => (
          <button
            key={r}
            type="button"
            disabled={!around}
            onClick={() => around && setAround({ ...around, radius: r })}
            className={`h-9 rounded-lg px-2.5 text-sm font-medium transition disabled:opacity-30 ${
              around?.radius === r ? "bg-sky-500 text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            {r} km
          </button>
        ))}
      </div>
      {around && (
        <span className="flex items-center gap-1 rounded-full bg-sky-500/20 py-1 pl-3 pr-1 text-sky-100 ring-1 ring-sky-400/30">
          {around.radius} km autour de {around.label}
          <button
            type="button"
            onClick={() => setAround(null)}
            aria-label="Retirer le filtre de position"
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/15"
          >
            ✕
          </button>
        </span>
      )}
    </div>
  );

  /* Onglets (régions) */
  const tabsBar = (
    <div className="flex shrink-0 gap-1 overflow-x-auto overscroll-x-contain border-b border-white/10 bg-slate-900/60 px-2 py-1.5">
      {allResults && (
        <button
          type="button"
          onClick={() => setFilterTab(null)}
          className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
            !filterTab ? "bg-sky-500 text-white" : "text-white/70 hover:bg-white/10"
          }`}
        >
          Tous les onglets <span className="tabular-nums opacity-60">{allResults.length}</span>
        </button>
      )}
      {tabs.map((r) => {
        const n = allResults ? (resultCount.get(r.id) ?? 0) : byRegion.get(r.id)!.length;
        const active = allResults ? r.id === filterTab : r.id === tab;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => {
              if (allResults) setFilterTab(r.id);
              else setTab(r.id);
            }}
            className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              active
                ? "bg-sky-500 text-white"
                : allResults && n === 0
                  ? "text-white/25"
                  : "text-white/70 hover:bg-white/10"
            }`}
          >
            {r.name} <span className="tabular-nums opacity-60">{n}</span>
          </button>
        );
      })}
    </div>
  );

  const statusEl = status && (
    <span
      className={`ml-auto ${
        status.kind === "error" ? "text-rose-300" : status.kind === "ok" ? "text-emerald-300" : "text-white/50"
      }`}
    >
      {status.text}
    </span>
  );

  /* Modifications groupées (repliables sur mobile) */
  const bulkPanel = (
    <div className="shrink-0 border-b border-white/10 bg-slate-900/40 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
        {isMobile ? (
          <button
            type="button"
            onClick={() => setBulkOpenMobile((o) => !o)}
            aria-expanded={bulkOpen}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-sky-600 px-3 text-sm font-semibold text-white"
          >
            ✏️ Modifier en lot {bulkOpen ? "▴" : "▾"}
          </button>
        ) : null}
        <span>
          {isMobile ? "" : "Appliquer à "}
          <strong className="text-white">{targetLabel}</strong>
        </span>
        {checked.size > 0 && (
          <button
            type="button"
            onClick={() => setChecked(new Set())}
            className="rounded bg-white/5 px-2 py-1 hover:bg-white/10"
          >
            Tout décocher
          </button>
        )}
        {statusEl}
      </div>
      {bulkOpen && (
        <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LevelButtons label="Fréquentation guides" onPick={bulk("frequentation", "Fréquentation guides")} disabled={!target.length} />
          <LevelButtons label="Intérêt pour DE" onPick={bulk("interet", "Intérêt pour DE")} disabled={!target.length} />
          <TextApply label="Gestion" onApply={bulk("gestion", "Gestion")} disabled={!target.length} />
          <TextApply label="Équipeurs" onApply={bulk("equipeurs", "Équipeurs")} disabled={!target.length} />
        </div>
      )}
    </div>
  );

  const errorBar = loadError && (
    <div className="shrink-0 bg-rose-950/60 px-3 py-1.5 text-xs text-rose-200">{loadError}</div>
  );
  const empty = rows.length === 0 && (
    <div className="p-6 text-center text-sm text-white/40">
      {results ? "Aucun résultat." : "Aucun site dans cet onglet."}
    </div>
  );
  const footer = (
    <div className="shrink-0 border-t border-white/10 bg-slate-900 px-3 py-1 text-[10px] text-white/40">
      Sites au-dessus de {MIN_ALTITUDE} m uniquement. Valeurs grises : données d'origine (camptocamp, FFME),
      modifiables. Types de sites et pays selon les filtres de la carte. Saisies partagées, rafraîchies toutes
      les 30 s.
    </div>
  );

  // Mobile : une seule zone de défilement (filtres compris), un site par carte.
  if (isMobile)
    return (
      <div
        ref={scrollRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="h-full overflow-y-auto overscroll-contain bg-slate-950 text-white"
      >
        {dialogs}
        <div className="sticky top-0 z-20">{header}</div>
        {aroundBar}
        {tabsBar}
        {bulkPanel}
        {errorBar}
        <label className="flex items-center gap-2.5 border-b border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-white/60">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={toggleAll}
            className="h-5 w-5 accent-sky-500"
          />
          Tout cocher ({rows.length} site{rows.length > 1 ? "s" : ""})
        </label>
        <div ref={listRef} className="relative" style={{ height: rows.length * CARD_H }}>
          {rows.slice(start, end).map((s, i) => (
            <Card
              key={s.id}
              sector={s}
              entry={entries.get(s.id)}
              checked={checked.has(s.id)}
              regionName={subtitle(s)}
              top={(start + i) * CARD_H}
              onToggle={toggle}
              onSave={saveCell}
            />
          ))}
        </div>
        {empty}
        {footer}
      </div>
    );

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950 text-white">
      {dialogs}
      {header}
      {aroundBar}
      {tabsBar}
      {bulkPanel}
      {errorBar}

      {/* Tableau */}
      <div
        ref={scrollRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="min-h-0 flex-1 overflow-auto"
      >
        <div style={{ minWidth: MIN_W }}>
          <div
            style={{ gridTemplateColumns: COLS }}
            className="sticky top-0 z-10 grid items-center gap-x-1.5 border-b border-white/10 bg-slate-900 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/50"
          >
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              aria-label="Tout cocher"
              className="h-4 w-4 accent-sky-500"
            />
            <span>Nom</span>
            <span>Massif</span>
            <span className="text-right">Alt.</span>
            <span>Nb voies</span>
            <span>Difficultés</span>
            <span>Classement</span>
            <span>Gestion</span>
            <span>Équipeurs</span>
            <span>Fréq. guides</span>
            <span>Intérêt DE</span>
            <span>Prénom</span>
          </div>
          <div className="relative" style={{ height: rows.length * ROW_H }}>
            {rows.slice(start, end).map((s, i) => (
              <Row
                key={s.id}
                sector={s}
                entry={entries.get(s.id)}
                checked={checked.has(s.id)}
                regionName={subtitle(s)}
                top={(start + i) * ROW_H}
                onToggle={toggle}
                onSave={saveCell}
              />
            ))}
          </div>
          {empty}
        </div>
      </div>
      {footer}
    </div>
  );
}
