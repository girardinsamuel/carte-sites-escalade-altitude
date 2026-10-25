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
  cotation et l'orientation demandent une requête par site (~5 300) : compter
  quelques minutes.
- Le bouton **« Rafraîchir depuis camptocamp »** dans l'app réinterroge l'API en
  direct ; en cas d'échec (réseau / CORS), les données locales sont conservées.
  La cotation et l'orientation des sites d'escalade sont alors reprises du snapshot.

## Vues

Carte, carte + liste ou liste seule. La liste suit les mêmes filtres et le même
mode d'affichage que la carte ; recherche par nom ou massif, tri par colonne,
export CSV, limitation à la zone visible de la carte (vue carte + liste).

## Build

```bash
npm run build && npm run preview
```

Sortie statique dans `dist/` — déployable sur n'importe quel hébergeur.
