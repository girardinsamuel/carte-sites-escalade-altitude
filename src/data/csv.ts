import type { Sector } from "./types";
import { KIND_SHORT } from "./labels";

export const HEADER = [
  "Nom",
  "Altitude (m)",
  "Type",
  "Cotation",
  "Orientation",
  "Massif",
  "Département",
  "Latitude",
  "Longitude",
  "Lien camptocamp",
];

function cell(v: string | number | undefined): string {
  const s = v == null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Valeurs d'une ligne, dans l'ordre de `HEADER` (partagé avec l'export tableur). */
export function sectorValues(s: Sector): (string | number | undefined)[] {
  return [
    s.name,
    s.elevation,
    KIND_SHORT[s.kind],
    s.rating,
    s.orientations?.join(" "),
    s.massif,
    s.dep,
    Number(s.lat.toFixed(5)),
    Number(s.lon.toFixed(5)),
    s.url,
  ];
}

/** CSV séparé par « ; » (ouverture directe dans Excel en français). */
export function sectorsToCsv(rows: Sector[]): string {
  const lines = rows.map((s) => sectorValues(s).map(cell).join(";"));
  return [HEADER.join(";"), ...lines].join("\r\n");
}

/** Déclenche le téléchargement d'un fichier généré. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(rows: Sector[], filename: string) {
  // BOM : Excel reconnaît l'UTF-8 (accents).
  downloadBlob(new Blob(["\ufeff", sectorsToCsv(rows)], { type: "text/csv;charset=utf-8" }), filename);
}
