// Saisies partagées de la vue « Saisie » (fonction serveur Vercel).
//
//   GET  /api/entries   → { entries: Entry[] }   toutes les saisies
//   POST /api/entries   { author, siteIds: number[], fields: { champ: valeur } }
//                       → { entries: Entry[] }   lignes mises à jour
//
// Stockage : Postgres (Neon), variable d'environnement DATABASE_URL.
// Les tables sont créées au premier appel. Chaque modification est aussi
// journalisée (site_entries_history) : qui, quand, ancienne / nouvelle valeur.

import pg from "pg";

/** Champs modifiables, nom côté appli → colonne SQL. */
export const FIELDS = {
  routes: "routes",
  rating: "rating",
  classement: "classement",
  gestion: "gestion",
  equipeurs: "equipeurs",
  frequentation: "frequentation",
  interet: "interet",
};

const LEVELS = ["Nulle", "Faible", "Moyen", "Fort"];
const MAX_LEN = 200;
const MAX_SITES = 20000;

let pool;
let ready;

function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
  pool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    // Neon exige TLS ; la base locale de développement non.
    ssl: /localhost|127\.0\.0\.1|host=\/|@\/|%2F/.test(process.env.DATABASE_URL)
      ? false
      : { rejectUnauthorized: false },
  });
  return pool;
}

async function ensureSchema(db) {
  ready ??= db.query(`
    CREATE TABLE IF NOT EXISTS site_entries (
      site_id       BIGINT PRIMARY KEY,
      routes        TEXT,
      rating        TEXT,
      classement    TEXT,
      gestion       TEXT,
      equipeurs     TEXT,
      frequentation TEXT,
      interet       TEXT,
      updated_by    TEXT NOT NULL,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS site_entries_history (
      id         BIGSERIAL PRIMARY KEY,
      site_id    BIGINT NOT NULL,
      field      TEXT NOT NULL,
      old_value  TEXT,
      new_value  TEXT,
      author     TEXT NOT NULL,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS site_entries_history_site ON site_entries_history (site_id);
  `);
  try {
    await ready;
  } catch (e) {
    ready = undefined; // réessayer au prochain appel
    throw e;
  }
}

const toEntry = (r) => ({
  siteId: Number(r.site_id),
  routes: r.routes,
  rating: r.rating,
  classement: r.classement,
  gestion: r.gestion,
  equipeurs: r.equipeurs,
  frequentation: r.frequentation,
  interet: r.interet,
  updatedBy: r.updated_by,
  updatedAt: r.updated_at,
});

class BadRequest extends Error {}

/** Valide le corps d'un POST ; renvoie { author, ids, fields } normalisés. */
export function validate(body) {
  const author = typeof body?.author === "string" ? body.author.trim() : "";
  if (!author || author.length > 40) throw new BadRequest("Prénom requis (40 caractères max)");
  const ids = Array.isArray(body?.siteIds)
    ? [...new Set(body.siteIds.map(Number).filter((n) => Number.isSafeInteger(n) && n > 0))]
    : [];
  if (!ids.length) throw new BadRequest("Aucun site");
  if (ids.length > MAX_SITES) throw new BadRequest("Trop de sites");
  const fields = {};
  for (const [k, v] of Object.entries(body?.fields ?? {})) {
    if (!(k in FIELDS)) throw new BadRequest(`Champ inconnu : ${k}`);
    if (v !== null && typeof v !== "string") throw new BadRequest(`Valeur invalide : ${k}`);
    const val = v === null ? null : v.trim().slice(0, MAX_LEN) || null;
    if ((k === "frequentation" || k === "interet") && val !== null && !LEVELS.includes(val))
      throw new BadRequest(`${k} : ${LEVELS.join(", ")}`);
    fields[k] = val;
  }
  if (!Object.keys(fields).length) throw new BadRequest("Aucun champ à modifier");
  return { author, ids, fields };
}

/** Applique une modification groupée dans une transaction (avec historique). */
export async function applyUpdate(db, { author, ids, fields }) {
  const cols = Object.keys(fields).map((k) => FIELDS[k]);
  const vals = Object.values(fields);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const before = await client.query(
      `SELECT site_id, ${cols.join(", ")} FROM site_entries WHERE site_id = ANY($1::bigint[]) FOR UPDATE`,
      [ids],
    );
    const prev = new Map(before.rows.map((r) => [Number(r.site_id), r]));

    // Upsert de toutes les lignes en une requête.
    const set = cols.map((c, i) => `${c} = $${i + 3}`).join(", ");
    const res = await client.query(
      `INSERT INTO site_entries (site_id, updated_by, ${cols.join(", ")})
         SELECT id, $2, ${cols.map((_, i) => `$${i + 3}`).join(", ")} FROM unnest($1::bigint[]) AS id
       ON CONFLICT (site_id) DO UPDATE SET ${set}, updated_by = $2, updated_at = now()
       RETURNING *`,
      [ids, author, ...vals],
    );

    // Historique : seulement les valeurs réellement changées.
    const hist = { site: [], field: [], old: [], neu: [] };
    for (const id of ids) {
      cols.forEach((c, i) => {
        const old = prev.get(id)?.[c] ?? null;
        if (old !== vals[i]) {
          hist.site.push(id);
          hist.field.push(c);
          hist.old.push(old);
          hist.neu.push(vals[i]);
        }
      });
    }
    if (hist.site.length)
      await client.query(
        `INSERT INTO site_entries_history (site_id, field, old_value, new_value, author)
         SELECT * , $5 FROM unnest($1::bigint[], $2::text[], $3::text[], $4::text[])`,
        [hist.site, hist.field, hist.old, hist.neu, author],
      );
    await client.query("COMMIT");
    return res.rows.map(toEntry);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const db = getPool();
    await ensureSchema(db);
    if (req.method === "GET") {
      const { rows } = await db.query("SELECT * FROM site_entries");
      return res.status(200).json({ entries: rows.map(toEntry) });
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const entries = await applyUpdate(db, validate(body));
      return res.status(200).json({ entries });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Méthode non autorisée" });
  } catch (e) {
    if (e instanceof BadRequest || e instanceof SyntaxError)
      return res.status(400).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}
