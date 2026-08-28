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

- `npm run data` — snapshot statique des ~5 300 sites `climbing_outdoor`
  (`scripts/fetch-sectors.mjs`, reprojection EPSG:3857 → WGS84).
- Le bouton **« Rafraîchir depuis camptocamp »** dans l'app réinterroge l'API en
  direct ; en cas d'échec (réseau / CORS), les données locales sont conservées.

## Build

```bash
npm run build && npm run preview
```

Sortie statique dans `dist/` — déployable sur n'importe quel hébergeur.
