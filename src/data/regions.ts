import type { Sector } from "./types";

/**
 * Grandes régions : regroupement des ~95 massifs camptocamp en une vingtaine
 * d'ensembles, un par onglet de l'export tableur.
 */
export interface Region {
  id: string;
  /** Nom d'onglet (31 caractères max, sans : \ / ? * [ ]). */
  name: string;
  /** Massifs camptocamp rattachés (titre exact de la zone `range`). */
  massifs: string[];
  /** Départements rattachés pour les sites sans massif loin de tout massif. */
  deps?: string[];
}

export const REGIONS: Region[] = [
  {
    id: "mont-blanc",
    name: "Mont-Blanc - Giffre - Chablais",
    massifs: ["Mont-Blanc", "Haut Giffre - Aiguilles Rouges - Fiz", "Chablais", "Genevois - Jura S"],
    deps: ["74"],
  },
  {
    id: "prealpes-nord",
    name: "Préalpes du Nord",
    massifs: ["Bornes - Aravis", "Bauges", "Chartreuse", "Vercors"],
    deps: ["26"],
  },
  {
    id: "vanoise",
    name: "Vanoise - Maurienne - Paradis",
    massifs: [
      "Vanoise",
      "Beaufortain",
      "Lauzière - Cheval Noir",
      "Alpes Grées - Charbonnel",
      "Cerces - Thabor - Mont-Cenis",
      "Grand Paradis",
    ],
    deps: ["73"],
  },
  {
    id: "ecrins",
    name: "Écrins - Oisans - Belledonne",
    massifs: ["Écrins", "Dévoluy", "Belledonne", "Grandes Rousses - Arves", "Taillefer - Armet"],
    deps: ["38", "05"],
  },
  {
    id: "queyras-ubaye",
    name: "Queyras - Ubaye - Digne",
    massifs: [
      "Queyras N - Briançonnais - Alpes Cottiennes",
      "Queyras S - Parpaillon - Ubaye - Orrenaye",
      "Préalpes de Digne",
    ],
    deps: ["04"],
  },
  {
    id: "mercantour",
    name: "Mercantour - Estérel - Ligurie",
    massifs: ["Mercantour - Argentera", "Pelat - Préalpes de Castellane - Estérel", "Alpes Ligures"],
    deps: ["06"],
  },
  {
    id: "provence",
    name: "Provence",
    massifs: ["Provence", "Calanques", "Luberon - Baronnies - Saoû"],
    deps: ["13", "83", "84"],
  },
  {
    id: "jura-vosges",
    name: "Jura - Vosges",
    massifs: ["Jura", "Vosges"],
    deps: ["01", "25", "39", "54", "55", "57", "67", "68", "70", "88", "90"],
  },
  {
    id: "massif-central",
    name: "Massif central - Cévennes",
    massifs: [],
    deps: ["03", "07", "12", "15", "19", "23", "30", "34", "42", "43", "46", "48", "63", "69", "81", "87"],
  },
  {
    id: "pyrenees-ouest",
    name: "Pyrénées occidentales",
    massifs: ["Béarn - Balaïtous - Partacua", "Bigorre - Ordesa", "Navarre - Pays Basque", "Sierras aragonaises"],
    deps: ["64", "65"],
  },
  {
    id: "pyrenees-est",
    name: "Pyrénées centrales et orient.",
    massifs: [
      "Luchon - Posets - Maladeta - Aigüestortes",
      "Couserans - Aran N",
      "Haute Ariège - Andorre",
      "Puigmal - Canigou - Albères",
      "Serres catalanes",
      "Corbières",
    ],
    deps: ["09", "11", "31", "66"],
  },
  {
    id: "valais",
    name: "Valais - Alpes Pennines",
    massifs: ["Valais W - Alpes Pennines W", "Valais E - Alpes Pennines E"],
  },
  {
    id: "oberland",
    name: "Alpes bernoises et vaudoises",
    massifs: ["Alpes Bernoises", "Alpes Vaudoises", "Préalpes Fribourgeoises - Bernoises"],
  },
  {
    id: "suisse-est",
    name: "Suisse centrale et orientale",
    massifs: [
      "Alpes Tessinoises - Conches - Goms",
      "Alpes Uranaises",
      "Bündner Oberland - Adula - Tessin E",
      "Alpes Glaronaises",
      "Grisons centraux",
      "Toggenburg - Appenzell",
      "Engadine - Disgrazia",
    ],
  },
  {
    id: "alpes-est",
    name: "Dolomites - Alpes orientales",
    massifs: [
      "Dolomites centrales",
      "Dolomites orientales",
      "Dolomites occidentales",
      "Adamello",
      "Ortles",
      "Alpes Bergamasques",
      "Alpes Juliennes",
      "Alpes Kamnik-Savinja et Karavanke",
      "Alpes Carniques et Alpes de Gailtal",
      "Dachstein",
      "Alpes de Lechtal - Wetterstein - Karwendel",
      "Alpes de Stubai - Alpes de Sarntal",
      "Alpes Viennoises",
      "Arlberg - Silvretta",
      "Préalpes de Styrie",
      "Hohe Tauern",
      "Alpes de Zillertal",
      "Alpes de Chiemgau - Alpes de Kitzbühel",
      "Ötztal",
      "Vorarlberg - Alpes d'Allgäu",
      "Niedere Tauern",
    ],
  },
  {
    id: "sud",
    name: "Corse - Italie - Espagne",
    massifs: [
      "Corse",
      "Sardaigne",
      "Sicile",
      "Apennins septentrionaux",
      "Apennins centraux",
      "Apennins méridionaux",
      "Picos de Europa - Cordillère Cantabrique",
      "Sierra Nevada - Cordillère Pénibétique",
      "Système Ibérique",
      "Sierra de Guadarrama",
      "Sierra de Gredos",
    ],
    deps: ["2A", "2B", "20"],
  },
  {
    id: "france-autres",
    name: "France - autres régions",
    massifs: ["Fontainebleau", "Oise"],
  },
  {
    id: "europe",
    name: "Reste de l'Europe",
    massifs: ["Peak District", "Lake District", "Tatras", "Les Carpathes"],
  },
  {
    id: "monde",
    name: "Reste du monde",
    massifs: [
      "Hautes Andes / Andes centrales",
      "Sierras Pampeanas",
      "Patagonie S",
      "Patagonie N",
      "Puna",
    ],
  },
];

const BY_ID = new Map(REGIONS.map((r) => [r.id, r]));
const BY_MASSIF = new Map<string, Region>();
const BY_DEP = new Map<string, Region>();
for (const r of REGIONS) {
  for (const m of r.massifs) BY_MASSIF.set(m, r);
  for (const d of r.deps ?? []) BY_DEP.set(d, r);
}

/** Distance max (km) au site « avec massif » le plus proche pour en hériter. */
const NEAR_KM = 15;
const CELL = 0.25; // degrés

const cellKey = (lat: number, lon: number) => `${Math.floor(lat / CELL)}|${Math.floor(lon / CELL)}`;

function distKm(a: Sector, b: Sector): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const inEurope = (s: Sector) => s.lat >= 34 && s.lat <= 72 && s.lon >= -25 && s.lon <= 45;

/**
 * Attribue une région à chaque site :
 * 1. par son massif camptocamp ;
 * 2. sinon, par le massif du site le plus proche (≤ 15 km) ;
 * 3. sinon, par son département (France) ;
 * 4. sinon France / Europe / monde.
 *
 * `reference` : jeu complet servant au voisinage (pas seulement les sites exportés).
 */
export function assignRegions(rows: Sector[], reference: Sector[]): Map<number, Region> {
  const grid = new Map<string, Sector[]>();
  for (const s of reference) {
    if (!s.massif || !BY_MASSIF.has(s.massif)) continue;
    const k = cellKey(s.lat, s.lon);
    const cell = grid.get(k);
    if (cell) cell.push(s);
    else grid.set(k, [s]);
  }

  const nearest = (s: Sector): Region | undefined => {
    const ci = Math.floor(s.lat / CELL);
    const cj = Math.floor(s.lon / CELL);
    let best: Sector | undefined;
    let bestD = NEAR_KM;
    for (let i = ci - 1; i <= ci + 1; i++)
      for (let j = cj - 1; j <= cj + 1; j++)
        for (const o of grid.get(`${i}|${j}`) ?? []) {
          const d = distKm(s, o);
          if (d <= bestD) {
            bestD = d;
            best = o;
          }
        }
    return best && BY_MASSIF.get(best.massif!);
  };

  const out = new Map<number, Region>();
  for (const s of rows) {
    const r =
      (s.massif && BY_MASSIF.get(s.massif)) ||
      nearest(s) ||
      (s.dep && BY_DEP.get(s.dep)) ||
      (s.dep ? BY_ID.get("france-autres") : inEurope(s) ? BY_ID.get("europe") : BY_ID.get("monde"))!;
    out.set(s.id, r);
  }
  return out;
}
