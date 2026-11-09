// Opportunités pour les créatrices : un carnet de marques à contacter, rempli par l'agence et trié par niche.
// - Le catalogue (opportunities) est commun à toute l'agence : seule l'agence l'écrit, seules les créatrices le lisent.
// - Le suivi (opportunity_status) est privé : chaque créatrice voit et modifie uniquement le sien.
// N'y entrent que des contacts professionnels publiés par la marque elle-même (site, bio Instagram).
import { isCreator } from "./workspaces.mjs";

const q = (db, s, ...a) => db.prepare(s).bind(...a),
  first = (db, s, ...a) => q(db, s, ...a).first(),
  all = async (db, s, ...a) => (await q(db, s, ...a).all()).results,
  run = (db, s, ...a) => q(db, s, ...a).run();
const now = () => new Date().toISOString();
function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
const clean = (v, n) =>
  String(v ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g, "")
    .trim()
    .slice(0, n);
const parse = (s) => {
  try {
    return JSON.parse(s || "{}") || {};
  } catch {
    return {};
  }
};

export const NICHES = [
  { key: "beauty", fr: "Beauté & soin", es: "Belleza y cuidado", en: "Beauty & skincare", aliases: ["beaute", "beauté", "soin", "belleza", "beauty", "skincare", "cosmetique", "cosmétique"] },
  { key: "fashion", fr: "Mode", es: "Moda", en: "Fashion", aliases: ["mode", "moda", "fashion"] },
  { key: "food", fr: "Food & boissons", es: "Comida y bebidas", en: "Food & drinks", aliases: ["food", "boissons", "comida", "bebidas", "drinks", "cuisine", "cocina"] },
  { key: "home", fr: "Maison & déco", es: "Casa y deco", en: "Home & decor", aliases: ["maison", "deco", "déco", "casa", "home", "decor"] },
  { key: "travel", fr: "Voyage", es: "Viajes", en: "Travel", aliases: ["voyage", "viaje", "viajes", "travel"] },
  { key: "wellness", fr: "Bien-être & sport", es: "Bienestar y deporte", en: "Wellness & fitness", aliases: ["bien-etre", "bien-être", "sport", "bienestar", "deporte", "wellness", "fitness"] },
  { key: "family", fr: "Maman & famille", es: "Mamá y familia", en: "Parenting & family", aliases: ["maman", "famille", "mama", "mamá", "familia", "family", "parenting", "mom"] },
  { key: "tech", fr: "Tech", es: "Tecnología", en: "Tech", aliases: ["tech", "tecnologia", "tecnología", "technologie"] },
  { key: "lifestyle", fr: "Lifestyle", es: "Estilo de vida", en: "Lifestyle", aliases: ["lifestyle", "estilo de vida"] },
  { key: "pets", fr: "Animaux", es: "Mascotas", en: "Pets", aliases: ["animaux", "mascotas", "pets", "animales"] },
  { key: "other", fr: "Autre", es: "Otro", en: "Other", aliases: ["autre", "otro", "other"] },
];
export const OPP_COUNTRIES = ["FR", "MX", "US", "INTL"];
export const OPP_STATUSES = ["todo", "contacted", "replied", "partner", "declined"];
export const OPP_MAX = 3000;
export const OPP_IMPORT_MAX = 500;
export const STATUS_PER_HOUR = 200;
export const AGENCY_WRITES_PER_HOUR = 600;

const fold = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function nicheKey(v) {
  const f = fold(v);
  if (!f) return null;
  for (const n of NICHES) {
    if (f === n.key || [n.fr, n.es, n.en].some((l) => fold(l) === f)) return n.key;
  }
  for (const n of NICHES) if (n.aliases.some((a) => f.split(/[ ,/]+/).includes(fold(a)) || f === fold(a))) return n.key;
  return null;
}
export function countryKey(v) {
  const f = fold(v);
  if (!f) return "INTL";
  if (["fr", "france", "francia"].includes(f)) return "FR";
  if (["mx", "mexique", "mexico", "méxico"].map(fold).includes(f)) return "MX";
  if (["us", "usa", "etats-unis", "estados unidos", "united states", "eeuu", "ee.uu."].map(fold).includes(f)) return "US";
  if (["intl", "international", "internacional", "monde", "world"].includes(f)) return "INTL";
  return null;
}
/** « @Ma.Marque », « instagram.com/ma.marque/ » → « ma.marque ». */
export function normalizeHandle(v) {
  let s = clean(v, 200);
  if (!s) return "";
  s = s.replace(/^https?:\/\//i, "").replace(/^(www\.)?instagram\.com\//i, "").replace(/^@+/, "");
  s = s.split(/[/?#]/)[0].trim().toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(s) || /^\.|\.$|\.\./.test(s)) return null;
  return s;
}
export function normalizeEmail(v) {
  const s = clean(v, 200).toLowerCase();
  if (!s) return "";
  if (!/^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(s) || s.includes("..")) return null;
  return s;
}
export function normalizeSite(v) {
  let s = clean(v, 300);
  if (!s) return "";
  if (/^http:\/\//i.test(s)) return null;
  if (!/^https:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" || !u.hostname.includes(".") || u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}
const LANGS = ["fr", "es", "en"];
function normalizeLanguages(v) {
  const list = Array.isArray(v) ? v : String(v || "").split(/[,;/ ]+/);
  return [
    ...new Set(
      list
        .map((x) => fold(x))
        .map((x) => ({ francais: "fr", french: "fr", frances: "fr", espagnol: "es", espanol: "es", spanish: "es", anglais: "en", ingles: "en", english: "en" })[x] || x)
        .filter((x) => LANGS.includes(x)),
    ),
  ];
}
function normalizeTags(v) {
  const list = Array.isArray(v) ? v : String(v || "").split(/[,;]+/);
  return [...new Set(list.map((x) => clean(x, 30)).filter(Boolean))].slice(0, 8);
}

/** Valide une fiche. Renvoie { value } ou { error } (message en français, traduit côté serveur). */
export function validateOpportunity(input = {}) {
  const brand = clean(input.brand ?? input.marque, 120);
  if (!brand) return { error: "Indiquez le nom de la marque." };
  const niche = nicheKey(input.niche);
  if (!niche) return { error: "Choisissez une niche dans la liste." };
  const instagram = normalizeHandle(input.instagram);
  if (instagram === null) return { error: "Compte Instagram invalide (lettres, chiffres, points et _ uniquement)." };
  const email = normalizeEmail(input.email);
  if (email === null) return { error: "Adresse e-mail invalide." };
  if (!instagram && !email) return { error: "Ajoutez au moins un compte Instagram ou une adresse e-mail." };
  const site = normalizeSite(input.site ?? input.website);
  if (site === null) return { error: "Le site doit commencer par https://." };
  const country = countryKey(input.country ?? input.pays);
  if (!country) return { error: "Pays invalide : FR, MX, US ou International." };
  const note = clean(input.note, 400);
  if (note.length > 240) return { error: "La note fait 240 caractères au maximum." };
  return {
    value: {
      brand,
      niche,
      instagram,
      email,
      site,
      country,
      languages: normalizeLanguages(input.languages ?? input.langues),
      note,
      tags: normalizeTags(input.tags),
    },
  };
}

/** Lit un CSV simple (séparateur , ou ;, guillemets doubles). */
export function parseCsv(text) {
  const src = String(text || "").replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/)[0] || "";
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
const HEADERS = {
  niche: ["niche", "nicho"],
  brand: ["marque", "brand", "marca", "nom"],
  instagram: ["instagram", "ig", "compte"],
  email: ["email", "e-mail", "mail", "correo"],
  site: ["site", "website", "sitio", "web"],
  country: ["pays", "country", "pais", "país"],
  languages: ["langues", "languages", "idiomas", "langue"],
  note: ["note", "nota", "pourquoi"],
};
const ORDER = ["niche", "brand", "instagram", "email", "site", "country", "languages", "note"];
/** Transforme le CSV en lignes validées : { line, value } ou { line, error, raw }. */
export function csvRows(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { rows: [], header: false };
  const head = rows[0].map(fold);
  const map = {};
  for (const [k, names] of Object.entries(HEADERS)) {
    const i = head.findIndex((h) => names.map(fold).includes(h));
    if (i >= 0) map[k] = i;
  }
  const header = Object.keys(map).length >= 2;
  const cols = header ? map : Object.fromEntries(ORDER.map((k, i) => [k, i]));
  const body = header ? rows.slice(1) : rows;
  return {
    header,
    rows: body.map((r, i) => {
      const raw = Object.fromEntries(Object.entries(cols).map(([k, idx]) => [k, (r[idx] ?? "").trim()]));
      const v = validateOpportunity(raw);
      return { line: i + (header ? 2 : 1), ...(v.error ? { error: v.error, raw } : { value: v.value }) };
    }),
  };
}

function agencyOnly(user) {
  if (user.role !== "agency") fail(403, "Réservé à l’agence.");
}
async function agencyRate(db, user, weight = 1) {
  const r = await first(
    db,
    "SELECT COUNT(*) AS n FROM audit WHERE author=? AND action LIKE 'opportunity_%' AND created>?",
    user.id,
    new Date(Date.now() - 3600000).toISOString(),
  );
  if (Number(r?.n || 0) + weight > AGENCY_WRITES_PER_HOUR) fail(429, "Beaucoup de modifications en peu de temps. Réessayez dans un moment.");
}
async function audit(db, user, action, target, data = {}) {
  await run(db, "INSERT INTO audit VALUES(?,?,?,?,?,?,?)", crypto.randomUUID(), null, user.id, action, target, JSON.stringify(data), now());
}
/** Une créatrice active, dans son propre espace. */
async function creatorSpace(db, user, cid) {
  if (user.role !== "client" || !cid || user.client_id !== cid) fail(403, "Cet espace ne vous est pas accessible.");
  if (await first(db, "SELECT client_id FROM client_deletions WHERE client_id=?", cid)) fail(410, "Cet espace est en cours de suppression.");
  const c = await first(db, "SELECT id,config FROM clients WHERE id=?", cid);
  if (!c) fail(404, "Espace introuvable.");
  if (!isCreator(parse(c.config))) fail(403, "Les opportunités sont réservées aux espaces créatrices.");
  return c;
}
const rowOut = (r) => ({
  id: r.id,
  niche: r.niche,
  brand: r.brand,
  instagram: r.instagram || "",
  email: r.email || "",
  site: r.site || "",
  country: r.country,
  languages: parse(r.languages).list || [],
  note: r.note || "",
  tags: parse(r.tags).list || [],
  active: !!Number(r.active),
  updated: r.updated,
});
async function findDuplicate(db, v, exceptId = "") {
  if (v.instagram) {
    const d = await first(db, "SELECT id FROM opportunities WHERE instagram=? AND id<>?", v.instagram, exceptId);
    if (d) return d.id;
  }
  if (v.email) {
    const d = await first(db, "SELECT id FROM opportunities WHERE email=? AND lower(brand)=lower(?) AND id<>?", v.email, v.brand, exceptId);
    if (d) return d.id;
  }
  return null;
}
async function insert(db, v, t) {
  const id = crypto.randomUUID();
  await run(
    db,
    "INSERT INTO opportunities(id,niche,brand,instagram,email,site,country,languages,note,tags,active,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?)",
    id,
    v.niche,
    v.brand,
    v.instagram || null,
    v.email || null,
    v.site || null,
    v.country,
    JSON.stringify({ list: v.languages }),
    v.note,
    JSON.stringify({ list: v.tags }),
    t,
    t,
  );
  return id;
}
async function update(db, id, v, t, active = null) {
  await run(
    db,
    "UPDATE opportunities SET niche=?,brand=?,instagram=?,email=?,site=?,country=?,languages=?,note=?,tags=?,active=COALESCE(?,active),updated=? WHERE id=?",
    v.niche,
    v.brand,
    v.instagram || null,
    v.email || null,
    v.site || null,
    v.country,
    JSON.stringify({ list: v.languages }),
    v.note,
    JSON.stringify({ list: v.tags }),
    active,
    t,
    id,
  );
}

export async function opportunitySave(db, user, b) {
  agencyOnly(user);
  await agencyRate(db, user);
  const v = validateOpportunity(b);
  if (v.error) fail(400, v.error);
  const t = now();
  if (b.id) {
    const row = await first(db, "SELECT id FROM opportunities WHERE id=?", clean(b.id, 100));
    if (!row) fail(404, "Opportunité introuvable.");
    if (await findDuplicate(db, v.value, row.id)) fail(409, "Cette marque est déjà dans la liste.");
    await update(db, row.id, v.value, t, typeof b.active === "boolean" ? (b.active ? 1 : 0) : null);
    await audit(db, user, "opportunity_updated", row.id);
    return { ok: true, id: row.id };
  }
  if (await findDuplicate(db, v.value)) fail(409, "Cette marque est déjà dans la liste.");
  const n = await first(db, "SELECT COUNT(*) AS n FROM opportunities");
  if (Number(n?.n || 0) >= OPP_MAX) fail(409, "La liste est pleine. Désactivez ou supprimez d’anciennes fiches.");
  const id = await insert(db, v.value, t);
  await audit(db, user, "opportunity_added", id);
  return { ok: true, id };
}
export async function opportunityActive(db, user, b) {
  agencyOnly(user);
  await agencyRate(db, user);
  if (typeof b.active !== "boolean") fail(400, "Validation invalide.");
  const row = await first(db, "SELECT id FROM opportunities WHERE id=?", clean(b.id, 100));
  if (!row) fail(404, "Opportunité introuvable.");
  await run(db, "UPDATE opportunities SET active=?,updated=? WHERE id=?", b.active ? 1 : 0, now(), row.id);
  await audit(db, user, "opportunity_active", row.id, { active: b.active });
  return { ok: true };
}
export async function opportunityDelete(db, user, b) {
  agencyOnly(user);
  await agencyRate(db, user);
  const row = await first(db, "SELECT id FROM opportunities WHERE id=?", clean(b.id, 100));
  if (!row) fail(404, "Opportunité introuvable.");
  await run(db, "DELETE FROM opportunity_status WHERE opportunity_id=?", row.id);
  await run(db, "DELETE FROM opportunities WHERE id=?", row.id);
  await audit(db, user, "opportunity_deleted", row.id);
  return { ok: true };
}
/** Import CSV : sans `commit`, renvoie l'aperçu ; avec `commit`, ajoute les nouvelles fiches et met à jour les existantes. */
export async function opportunityImport(db, user, b) {
  agencyOnly(user);
  const text = String(b.csv ?? "");
  if (!text.trim()) fail(400, "Collez ou choisissez un fichier CSV.");
  if (text.length > 400000) fail(413, "Fichier trop lourd : 500 lignes au maximum par import.");
  const { rows, header } = csvRows(text);
  if (!rows.length) fail(400, "Aucune ligne trouvée dans ce fichier.");
  if (rows.length > OPP_IMPORT_MAX) fail(413, "Fichier trop lourd : 500 lignes au maximum par import.");
  const preview = [];
  for (const r of rows) {
    if (r.error) {
      preview.push({ line: r.line, error: r.error, brand: clean(r.raw.brand, 120) });
      continue;
    }
    const dup = await findDuplicate(db, r.value);
    preview.push({ line: r.line, action: dup ? "update" : "add", id: dup, ...r.value });
  }
  const summary = {
    add: preview.filter((p) => p.action === "add").length,
    update: preview.filter((p) => p.action === "update").length,
    errors: preview.filter((p) => p.error).length,
  };
  if (!b.commit) return { ok: true, header, preview, summary };
  await agencyRate(db, user, 1);
  const n = await first(db, "SELECT COUNT(*) AS n FROM opportunities");
  if (Number(n?.n || 0) + summary.add > OPP_MAX) fail(409, "La liste est pleine. Désactivez ou supprimez d’anciennes fiches.");
  const t = now();
  const seen = new Set();
  let added = 0,
    updated = 0;
  for (const p of preview) {
    if (p.error) continue;
    const key = p.instagram || p.email + "|" + p.brand.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const dup = await findDuplicate(db, p);
    if (dup) {
      await update(db, dup, p, t, 1);
      updated++;
    } else {
      await insert(db, p, t);
      added++;
    }
  }
  await audit(db, user, "opportunity_import", "csv", { added, updated, errors: summary.errors });
  return { ok: true, added, updated, errors: summary.errors };
}

export async function opportunityStatusSave(db, user, b) {
  const cid = clean(b.client_id || user.client_id, 100);
  await creatorSpace(db, user, cid);
  const opp = await first(db, "SELECT id,active FROM opportunities WHERE id=?", clean(b.opportunity_id, 100));
  if (!opp || !Number(opp.active)) fail(404, "Opportunité introuvable.");
  const status = OPP_STATUSES.includes(b.status) ? b.status : fail(400, "Statut invalide.");
  const note = clean(b.note, 400);
  if (note.length > 300) fail(400, "La note fait 300 caractères au maximum.");
  const r = await first(
    db,
    "SELECT COUNT(*) AS n FROM opportunity_status WHERE client_id=? AND updated>?",
    cid,
    new Date(Date.now() - 3600000).toISOString(),
  );
  if (Number(r?.n || 0) >= STATUS_PER_HOUR) fail(429, "Beaucoup de modifications en peu de temps. Réessayez dans un moment.");
  await run(
    db,
    "INSERT INTO opportunity_status(client_id,opportunity_id,status,note,updated) VALUES(?,?,?,?,?) ON CONFLICT(client_id,opportunity_id) DO UPDATE SET status=excluded.status,note=excluded.note,updated=excluded.updated",
    cid,
    opp.id,
    status,
    note,
    now(),
  );
  return { ok: true };
}

/** Adresse e-mail d'une fiche, à la demande (jamais tout le carnet d'un coup) ; chaque accès est tracé et limité. */
export async function opportunityContact(db, user, b) {
  const cid = clean(b.client_id || user.client_id, 100);
  const c = await creatorSpace(db, user, cid);
  const opp = await first(db, "SELECT id,email FROM opportunities WHERE id=? AND active=1", clean(b.opportunity_id, 100));
  if (!opp) fail(404, "Opportunité introuvable.");
  const t = now();
  const logged = await run(
    db,
    "INSERT INTO audit(id,client_id,author,action,target,detail,created) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM audit WHERE client_id=? AND action='opportunity_contact_viewed' AND created>?)<?",
    crypto.randomUUID(),
    c.id,
    user.id,
    "opportunity_contact_viewed",
    opp.id,
    "{}",
    t,
    c.id,
    new Date(Date.now() - 3600000).toISOString(),
    CONTACTS_PER_HOUR,
  );
  if (!logged.meta.changes) fail(429, "Beaucoup d’adresses affichées en peu de temps. Réessayez dans un moment.");
  return { ok: true, email: opp.email || "" };
}
const CONTACTS_PER_HOUR = 60;
/** Ce que l'état du studio expose : tout le catalogue pour l'agence, les fiches actives + le suivi privé pour une créatrice.
 *  Côté créatrice : aucune adresse e-mail en bloc (voir opportunityContact), et rien si l'abonnement n'est pas à jour. */
export async function opportunitiesState(db, user, selected, { paid = true } = {}) {
  if (user.role === "agency") {
    const rows = await all(db, "SELECT * FROM opportunities ORDER BY niche,lower(brand) LIMIT ?", OPP_MAX);
    return { opportunities: rows.map(rowOut), opportunityStatus: [] };
  }
  const cfg = selected && (typeof selected.config === "string" ? parse(selected.config) : selected.config || {});
  if (user.role !== "client" || !selected || selected.id !== user.client_id || !isCreator(cfg) || !paid)
    return { opportunities: [], opportunityStatus: [], opportunitiesLocked: !paid };
  const rows = await all(db, "SELECT * FROM opportunities WHERE active=1 ORDER BY niche,lower(brand) LIMIT ?", OPP_MAX);
  const status = await all(
    db,
    "SELECT opportunity_id,status,note,updated FROM opportunity_status WHERE client_id=?",
    user.client_id,
  );
  return {
    opportunities: rows.map((r) => ({ ...rowOut(r), email: "", hasEmail: !!r.email })),
    opportunityStatus: status,
  };
}
