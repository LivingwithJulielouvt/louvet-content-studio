/** Minimal D1-compatible facade over Supabase Postgres. Existing business SQL and UI stay unchanged. */
import pg from "pg";
import { SUPABASE_ROOT_CA } from "./supabase-ca.mjs";
const { Pool, types } = pg;
types.setTypeParser(20, (value) => Number(value));
// SUM() et AVG() renvoient le type NUMERIC en Postgres : on le lit comme un nombre, comme SQLite.
types.setTypeParser(1700, (value) => Number(value));
let pool;
/** TLS vers Supabase : le certificat du pooler est signé par l'autorité Supabase (absente du magasin Node).
 *  Le certificat public Supabase est inclus (lib/supabase-ca.mjs) ; DATABASE_CA_CERT permet de le remplacer. */
function sslConfig() {
  if (process.env.DATABASE_SSL === "false") return false;
  const ca = (process.env.DATABASE_CA_CERT || "").replace(/\\n/g, "\n").trim() || SUPABASE_ROOT_CA;
  return { ca, rejectUnauthorized: true };
}
function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL (Supabase Pooler, transaction mode) manque.");
  if (!pool)
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      ssl: sslConfig(),
    });
  return pool;
}
/** Convert SQLite placeholders/functions used by the exported application to PostgreSQL. */
export function pgSQL(sql) {
  let query = sql
    .replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, "INSERT INTO")
    .replace(/\bMAX\s*\(\s*0\s*,/gi, "GREATEST(0,")
    .replace(/\bunixepoch\s*\(\s*([a-z_][\w.]*)\s*\)/gi, (_, col) => "EXTRACT(EPOCH FROM " + col + "::timestamptz)");
  // INSERT OR IGNORE: ON CONFLICT DO NOTHING works for both INSERT VALUES and INSERT SELECT.
  if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(sql)) query = query.replace(/;\s*$/, "") + " ON CONFLICT DO NOTHING";
  let result = "",
    i = 0,
    quoted = null;
  for (let j = 0; j < query.length; j++) {
    const ch = query[j];
    if (quoted) {
      result += ch;
      if (ch === quoted) {
        if (query[j + 1] === quoted) {
          result += query[++j];
        } else quoted = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quoted = ch;
      result += ch;
      continue;
    }
    if (ch === "?") {
      result += "$" + ++i;
    } else result += ch;
  }
  return result;
}
async function execute(client, sql, args) {
  const response = await client.query(
    pgSQL(sql),
    args.map((a) => (a === undefined ? null : a)),
  );
  return { results: response.rows, meta: { changes: response.rowCount || 0 }, success: true };
}
class Statement {
  constructor(db, sql, args = []) {
    this.db = db;
    this.sql = sql;
    this.args = args;
  }
  bind(...args) {
    return new Statement(this.db, this.sql, args);
  }
  async first() {
    const r = await this.all();
    return r.results[0] || null;
  }
  async all() {
    return execute(this.db.client || this.db.pool || getPool(), this.sql, this.args);
  }
  async run() {
    // Comme Cloudflare D1 (écritures en série), chaque écriture isolée passe par la file d'écriture.
    if (!this.db.client && /^\s*(INSERT|UPDATE|DELETE)\b/i.test(this.sql)) return (await this.db.batch([this]))[0];
    return execute(this.db.client || this.db.pool || getPool(), this.sql, this.args);
  }
}
export class StudioDatabase {
  constructor(client = null, pool = null) {
    this.client = client;
    // Pool dédié facultatif (tests) ; par défaut, le pool partagé de DATABASE_URL.
    this.pool = pool;
  }
  prepare(sql) {
    return new Statement(this, sql);
  }
  async batch(statements) {
    const client = await (this.pool || getPool()).connect();
    try {
      await client.query("BEGIN");
      // Verrou d'écriture global : reproduit la sérialisation des écritures de D1/SQLite.
      // Sans lui, deux demandes simultanées peuvent dépasser un quota ou attribuer deux fois des points.
      await client.query("SELECT pg_advisory_xact_lock(7349001)");
      const results = [];
      for (const s of statements) results.push(await execute(client, s.sql, s.args));
      await client.query("COMMIT");
      return results;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}
export const studioDb = new StudioDatabase();
