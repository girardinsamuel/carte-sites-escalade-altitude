import { strToU8, zipSync } from "fflate";
import type { Sector, SiteKind } from "./types";
import { HEADER, sectorValues } from "./csv";
import { assignRegions, REGIONS, type Region } from "./regions";

/**
 * Classeur .xlsx (Office Open XML) : un onglet « Synthèse » puis un onglet
 * par grande région, avec les mêmes colonnes que la liste / l'export CSV.
 */

type Value = string | number | undefined;
interface Sheet {
  name: string;
  header: string[];
  rows: Value[][];
  /** Largeur des colonnes (en caractères). */
  widths: number[];
  /** Index de la colonne contenant des URL (lien cliquable). */
  linkCol?: number;
}

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Caractères de contrôle interdits en XML.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

function colName(i: number): string {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cellXml(v: Value, ref: string, style: number, link: boolean): string {
  const s = style ? ` s="${style}"` : "";
  if (v == null || v === "") return "";
  if (typeof v === "number") return `<c r="${ref}"${s}><v>${v}</v></c>`;
  if (link) {
    const u = esc(v.replace(/"/g, '""'));
    return `<c r="${ref}" s="2" t="str"><f>HYPERLINK("${u}")</f><v>${esc(v)}</v></c>`;
  }
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}

function sheetXml({ header, rows, widths, linkCol }: Sheet): string {
  const last = colName(header.length - 1);
  const lines = [header, ...rows].map((row, r) => {
    const cells = row.map((v, c) => cellXml(v, `${colName(c)}${r + 1}`, r === 0 ? 1 : 0, r > 0 && c === linkCol)).join("");
    return `<row r="${r + 1}">${cells}</row>`;
  });
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${cols}</cols>` +
    `<sheetData>${lines.join("")}</sheetData>` +
    `<autoFilter ref="A1:${last}${rows.length + 1}"/>` +
    `</worksheet>`
  );
}

const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>` +
  `<font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/></font></fonts>` +
  `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/><bgColor indexed="64"/></patternFill></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
  `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

/** Nom d'onglet valide et unique (31 car. max, sans : \ / ? * [ ]). */
function sheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[:\\/?*[\]]/g, "-").replace(/^'+|'+$/g, "").slice(0, 31) || "Feuille";
  let n = base;
  for (let i = 2; used.has(n.toLowerCase()); i++) n = `${base.slice(0, 31 - String(i).length - 1)} ${i}`;
  used.add(n.toLowerCase());
  return n;
}

export function buildWorkbook(sheets: Sheet[]): Uint8Array {
  const used = new Set<string>();
  const names = sheets.map((s) => sheetName(s.name, used));
  const n = sheets.length;
  const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i);

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        range(1, n + 1)
          .map((i) => `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
          .join("") +
        `</Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets>${names.map((nm, i) => `<sheet name="${esc(nm)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>` +
        `<definedNames>${names
          .map((nm, i) => {
            const last = colName(sheets[i].header.length - 1);
            const ref = `'${esc(nm.replace(/'/g, "''"))}'!$A$1:$${last}$${sheets[i].rows.length + 1}`;
            return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${ref}</definedName>`;
          })
          .join("")}</definedNames>` +
        `</workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        range(1, n + 1)
          .map((i) => `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`)
          .join("") +
        `<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    ),
    "xl/styles.xml": strToU8(STYLES),
  };
  sheets.forEach((s, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s))));
  return zipSync(files, { level: 6 });
}

const SITE_WIDTHS = [36, 12, 12, 14, 12, 30, 12, 11, 11, 44];
const LINK_COL = HEADER.length - 1;

/**
 * Classeur des sites `rows` (dans leur ordre), répartis par grande région.
 * `reference` : jeu complet, pour rattacher les sites sans massif au plus proche.
 */
export function sectorsToWorkbook(rows: Sector[], reference: Sector[]): Uint8Array {
  const regionOf = assignRegions(rows, reference);
  const groups = new Map<Region, Sector[]>(REGIONS.map((r) => [r, []]));
  let outside = 0;
  for (const s of rows) {
    const r = regionOf.get(s.id);
    if (r) groups.get(r)!.push(s);
    else outside++;
  }
  const kept = rows.filter((s) => regionOf.has(s.id));
  const used = [...groups].filter(([, list]) => list.length);

  const count = (list: Sector[], k: SiteKind) => list.filter((s) => s.kind === k).length;
  const summary: Sheet = {
    name: "Synthèse",
    header: ["Onglet", "Sites", "Escalade", "Via ferrata", "Rocher HM", "Massifs camptocamp"],
    widths: [32, 8, 10, 11, 11, 120],
    rows: [
      ...used.map(([r, list]) => {
        const massifs = new Map<string, number>();
        let none = 0;
        for (const s of list) {
          if (s.massif) massifs.set(s.massif, (massifs.get(s.massif) ?? 0) + 1);
          else none++;
        }
        const detail = [...massifs]
          .sort((a, b) => b[1] - a[1])
          .map(([m, c]) => `${m} (${c})`)
          .concat(none ? [`sans massif (${none})`] : [])
          .join(", ");
        return [r.name, list.length, count(list, "climbing"), count(list, "via_ferrata"), count(list, "mountain"), detail];
      }),
      ["Total", kept.length, count(kept, "climbing"), count(kept, "via_ferrata"), count(kept, "mountain"), ""],
      ...(outside ? [["Hors Europe (non exportés)", outside, undefined, undefined, undefined, "sites hors d'Europe (hors outre-mer)"]] : []),
    ],
  };

  return buildWorkbook([
    summary,
    ...used.map(([r, list]) => ({
      name: r.name,
      header: HEADER,
      rows: list.map(sectorValues),
      widths: SITE_WIDTHS,
      linkCol: LINK_COL,
    })),
  ]);
}
