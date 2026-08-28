import raw from "./departements.json";

export interface Departement {
  code: string;
  nom: string;
}

export const DEPARTEMENTS = raw as Departement[];

/** Minuscule, sans accents, apostrophes normalisées. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’´`]/g, "'")
    .trim();
}

const BY_NAME = new Map<string, string>();
for (const d of DEPARTEMENTS) BY_NAME.set(norm(d.nom), d.code);
BY_NAME.set("reunion", "974");

/** Code de département depuis un titre `admin_limits` camptocamp. */
export function depCodeByName(name: string): string | undefined {
  return BY_NAME.get(norm(name));
}

const BY_CODE = new Map(DEPARTEMENTS.map((d) => [d.code, d]));

/** "Hautes-Alpes (05)" */
export function depLabel(code: string): string {
  const d = BY_CODE.get(code);
  return d ? `${d.nom} (${d.code})` : code;
}
