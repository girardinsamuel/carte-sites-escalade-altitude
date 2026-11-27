/** Saisies partagées de la vue « Saisie » (API api/entries.js, base Postgres). */

export const LEVELS = ["Nulle", "Faible", "Moyen", "Fort"] as const;
export const CLASSEMENTS = ["Site sportif", "Terrain d’aventure", "Site de bloc", "Non classé"];

export type EntryField =
  | "routes"
  | "rating"
  | "classement"
  | "gestion"
  | "equipeurs"
  | "frequentation"
  | "interet";

export interface Entry {
  siteId: number;
  routes: string | null;
  rating: string | null;
  classement: string | null;
  gestion: string | null;
  equipeurs: string | null;
  frequentation: string | null;
  interet: string | null;
  updatedBy: string;
  updatedAt: string;
}

async function call(init?: RequestInit): Promise<Entry[]> {
  const res = await fetch("/api/entries", {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = (await res.json().catch(() => ({}))) as { entries?: Entry[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data.entries ?? [];
}

export const fetchEntries = () => call();

/** Met à jour les mêmes champs sur plusieurs sites ; renvoie les lignes à jour. */
export const saveEntries = (
  author: string,
  siteIds: number[],
  fields: Partial<Record<EntryField, string | null>>,
) => call({ method: "POST", body: JSON.stringify({ author, siteIds, fields }) });

const AUTHOR_KEY = "saisie.prenom";

export function readAuthor(): string {
  try {
    return localStorage.getItem(AUTHOR_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveAuthor(name: string) {
  try {
    localStorage.setItem(AUTHOR_KEY, name);
  } catch {
    // stockage indisponible : prénom redemandé à la prochaine ouverture
  }
}
