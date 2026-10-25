import type { Sector } from "./types";
import { KIND_SHORT } from "./labels";

const HEADER = [
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

/** CSV séparé par « ; » (ouverture directe dans Excel en français). */
export function sectorsToCsv(rows: Sector[]): string {
  const lines = rows.map((s) =>
    [
      s.name,
      s.elevation,
      KIND_SHORT[s.kind],
      s.rating,
      s.orientations?.join(" "),
      s.massif,
      s.dep,
      s.lat.toFixed(5),
      s.lon.toFixed(5),
      s.url,
    ]
      .map(cell)
      .join(";"),
  );
  return [HEADER.join(";"), ...lines].join("\r\n");
}

export function downloadCsv(rows: Sector[], filename: string) {
  // BOM : Excel reconnaît l'UTF-8 (accents).
  const blob = new Blob(["﻿", sectorsToCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
