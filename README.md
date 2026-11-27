# Carte 3D des secteurs d'escalade

Une carte 3D (relief) avec les sites d'escalade référencés
sur [camptocamp.org](https://www.camptocamp.org), filtrables par un **curseur
d'altitude**.

## Stack

- **Vite + React + TypeScript**
- **MapLibre GL JS** (`react-map-gl/maplibre`) — carte + terrain 3D
- **MapTiler** — style de fond + tuiles `terrain-rgb`
- **deck.gl** (`IconLayer` + `DataFilterExtension`) — marqueurs GPU + filtre altitude
- **Tailwind CSS v4** + **Radix Slider** — interface

## Démarrage

```bash
npm install
cp .env.example .env      # renseigner VITE_MAPTILER_KEY (clé gratuite maptiler.com)
npm run data              # génère public/data/sectors.geojson depuis l'API camptocamp
npm run dev
```

## Données

- `npm run data` — snapshot statique (`scripts/fetch-sectors.mjs`, reprojection
  EPSG:3857 → WGS84) : sites `climbing_outdoor`, via ferrata et rocher haute
  montagne, avec cotation, orientation et massif. Pour les sites d'escalade, la
  cotation, l'orientation et le nombre de voies demandent une requête par site
  (~5 300) : compter quelques minutes. La commune des sites français vient de
  [geo.api.gouv.fr](https://geo.api.gouv.fr) (géocodage inverse).
- `npm run data:ffme` — classement FFME (site sportif, terrain d'aventure…) des
  sites naturels d'escalade, lu sur les fiches de [ffme.fr](https://www.ffme.fr/ffme/carte-interactive/)
  (~2 300 fiches, une vingtaine de minutes ; reprise possible), mis en cache dans
  `scripts/data/ffme-sne.json`, puis rattaché aux sites camptocamp par proximité
  GPS et ressemblance des noms (`scripts/ffme-match.mjs`). `npm run data`
  réapplique ensuite ce rattachement depuis le cache.
- Le bouton **« Rafraîchir depuis camptocamp »** dans l'app réinterroge l'API en
  direct ; en cas d'échec (réseau / CORS), les données locales sont conservées.
  La cotation, l'orientation, le nombre de voies et la commune sont alors repris
  du snapshot.

## Vues

Carte, carte + liste ou liste seule. La liste suit les mêmes filtres et le même
mode d'affichage que la carte ; recherche par nom ou massif, tri par colonne,
export CSV, limitation à la zone visible de la carte (vue carte + liste).

**Export tableur (XLSX)** : la liste affichée, répartie en un onglet par grande
région (20 regroupements de massifs camptocamp, définis dans
`src/data/regions.ts`), précédée d'un onglet « Synthèse » (nombre de sites
par type et massifs inclus). Un site sans massif prend celui du site le plus
proche (≤ 15 km), sinon une région selon son département (par défaut « France
Grand-Ouest - Nord »), sinon « Reste de l'Europe ». L'outre-mer a son propre
onglet ; les autres sites hors d'Europe ne sont pas exportés (leur nombre figure
dans la synthèse).

Colonnes des onglets : Nom du site (lien vers la fiche camptocamp), Commune,
Altitude, Nb de voies, Niveau, Type, Massif, Département, puis les colonnes à
remplir à la main (en-têtes jaunes) : Classement FFME (pré-rempli quand le
site est rattaché à une fiche FFME, suivi de « (?) » si le rattachement est à
vérifier), Gestion, Equipeurs,
Fréquentation guides et Intérêt pour DE (ces deux dernières avec une liste
déroulante Nulle / Faible / Moyen / Fort) ; camptocamp ne fournit pas ces informations.

## Build

```bash
npm run build && npm run preview
```

Sortie statique dans `dist/` — déployable sur n'importe quel hébergeur.
