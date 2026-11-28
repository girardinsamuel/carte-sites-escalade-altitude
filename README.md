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
  **Grandes voies** : les voies d'escalade des sommets et grandes parois
  (`act=rock_climbing` : Mont Aiguille, Gerbier, Deux Sœurs…) sont regroupées
  par sommet, avec le nombre de voies et la fourchette de cotations (~17 000
  voies, ~2 300 sommets ; une requête par groupe). Les parois qui sont déjà des
  sites d'escalade ne sont pas dupliquées. Compter 40 à 50 minutes au total.
- `npm run data:ffme` — classement FFME (site sportif, terrain d'aventure…) des
  sites naturels d'escalade, lu sur les fiches de [ffme.fr](https://www.ffme.fr/ffme/carte-interactive/)
  (~2 300 fiches, une vingtaine de minutes ; reprise possible), mis en cache dans
  `scripts/data/ffme-sne.json`, puis rattaché aux sites camptocamp par proximité
  GPS et ressemblance des noms (`scripts/ffme-match.mjs`). `npm run data`
  réapplique ensuite ce rattachement depuis le cache.
- Le bouton **« Rafraîchir depuis camptocamp »** dans l'app réinterroge l'API en
  direct ; en cas d'échec (réseau / CORS — l'API refuse les requêtes venant
  d'autres domaines), les données locales sont conservées.
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

Les **saisies partagées** de la vue Saisie sont intégrées à l'export : elles
remplacent les valeurs d'origine (nombre de voies, niveau, classement) et
remplissent Gestion, Equipeurs, Fréquentation guides et Intérêt pour DE ; une
colonne « Saisi par » indique le prénom et la date de la dernière modification.

Colonnes des onglets : Nom du site (lien vers la fiche camptocamp), Commune,
Altitude, Nb de voies, Niveau, Type, Massif, Département, puis les colonnes à
remplir à la main (en-têtes jaunes) : Classement FFME (pré-rempli quand le
site est rattaché à une fiche FFME, suivi de « (?) » si le rattachement est à
vérifier), Gestion, Equipeurs,
Fréquentation guides et Intérêt pour DE (ces deux dernières avec une liste
déroulante Nulle / Faible / Moyen / Fort) ; camptocamp ne fournit pas ces informations.

## Saisie collaborative

Vue **Saisie** (bouton à côté de Carte / Liste, ou directement à l'adresse
**`/saisie`**, lien à partager), limitée aux sites situés
**au-dessus de 1 500 m** (`MIN_ALTITUDE` dans `src/ui/EditTable.tsx`) : un tableau par grande région,
comme le tableur, avec les colonnes Nom, Massif, Altitude, Nb voies,
Difficultés, Classement, Gestion, Équipeurs, Fréquentation guides, Intérêt pour
DE et Prénom (auteur de la dernière modification).

- Nb voies, Difficultés et Classement sont pré-remplis (camptocamp, FFME, en
  gris) et modifiables ; les autres colonnes se remplissent directement.
- La recherche porte sur tous les onglets (nom, massif, commune).
- Filtre **« Autour de »** : position GPS (« Ma position ») ou ville choisie,
  rayon de 10, 25, 50 ou 100 km ; résultats triés par distance, combinables
  avec la recherche, mémorisés dans le navigateur. Un clic sur un onglet
  restreint les résultats à cette région.
- Gros boutons pour appliquer Gestion, Équipeurs, Fréquentation guides ou
  Intérêt pour DE aux sites cochés, ou à défaut à tous les résultats affichés.
- À la première ouverture, une fenêtre explique l'outil (onglets par massif,
  recherche / rayon, édition ligne par ligne ou par lot, sauvegarde
  automatique), puis le prénom est demandé (mémorisé dans le navigateur).
  Le bouton « ? » rouvre ces explications.
- Sur mobile, toute la page défile d'un bloc (recherche toujours visible en
  haut), chaque site est une carte avec ses champs en deux colonnes, et le
  panneau « Modifier en lot » est replié par défaut.

Les saisies sont **partagées** : elles sont stockées dans une base Postgres
(Neon, reliée au projet Vercel) via la fonction serveur `api/entries.js`, qui
crée ses tables au premier appel et journalise chaque modification
(`site_entries_history` : site, champ, ancienne / nouvelle valeur, prénom,
date). La variable `DATABASE_URL` est fournie par l'intégration Neon de Vercel.

En local : renseigner `DATABASE_URL` dans `.env`, puis lancer `npm run dev:api`
à côté de `npm run dev` (Vite redirige `/api` vers ce serveur).

## Build

```bash
npm run build && npm run preview
```

Sortie statique dans `dist/` — déployable sur n'importe quel hébergeur.
