// Fonctions visibles par les clientes : l'agence les allume ou les éteint depuis le studio (« Agence › Fonctions visibles »).
// Le réglage est global (table studio_settings, clé « features ») et appliqué côté serveur : une fonction éteinte
// disparaît des menus ET ses actions sont refusées pour les clientes (l'agence garde l'accès pour préparer et tester).
export const FEATURES = [
  { key: "opportunities", default: false, label: "Opportunités & Marques du studio (créatrices)" },
  { key: "testVersions", default: false, label: "Versions à tester (créatrices)" },
  { key: "brandCollabs", default: true, label: "Collaborations côté marques" },
  { key: "reels", default: true, label: "Réductions « Un Reel avec Julie »" },
  { key: "recreate", default: true, label: "Recréer ce post (depuis Instagram)" },
  { key: "siteImport", default: true, label: "Importer mon site" },
];
export const FEATURE_DEFAULTS = Object.fromEntries(FEATURES.map((f) => [f.key, f.default]));

// Accès client par client (config.access) : l'agence allume ou éteint chaque option pour un espace précis,
// à la création de l'invitation puis à tout moment (Marque & accès). Une option non réglée suit le réglage global.
// « video » (montage vidéo) n'a pas de réglage global : fermé tant que l'agence ne l'ouvre pas.
export const CLIENT_OPTIONS = [
  { key: "video", label: "Montage vidéo (Mes vidéos, idées et montages)", default: false },
  ...FEATURES.map((f) => ({ key: f.key, label: f.label, default: f.default })),
];
const OPTION_KEYS = new Set(CLIENT_OPTIONS.map((o) => o.key));
export function sanitizeAccess(input = {}) {
  const out = {};
  for (const k of OPTION_KEYS) if (typeof input?.[k] === "boolean") out[k] = input[k];
  return out;
}
/** Fonctions effectives pour un espace : réglage global, remplacé par l'accès propre au client quand il existe. */
export function applyClientAccess(features, config) {
  const acc = sanitizeAccess(config?.access || {});
  const f = { ...features };
  for (const k of Object.keys(FEATURE_DEFAULTS)) if (typeof acc[k] === "boolean") f[k] = acc[k];
  if (typeof acc.opportunities === "boolean") f.opportunitiesMode = acc.opportunities ? "open" : "hidden";
  f.video = acc.video === true;
  return f;
}
export const hasVideoAccess = (config) => sanitizeAccess(config?.access || {}).video === true;
const KEYS = new Set(FEATURES.map((f) => f.key));

export function sanitizeFeatures(input = {}) {
  const out = { ...FEATURE_DEFAULTS };
  for (const k of KEYS) if (typeof input?.[k] === "boolean") out[k] = input[k];
  return out;
}

// Opportunités : trois états. « countdown » (par défaut) = compte à rebours jusqu'à opportunitiesOpenAt,
// puis ouverture automatique ; « open » = ouvert ; « hidden » = masqué.
export const OPP_MODES = ["hidden", "countdown", "open"];
export const OPP_COUNTDOWN_DAYS = 20;
const validIso = (v) => typeof v === "string" && !Number.isNaN(Date.parse(v)) && /^\d{4}-\d{2}-\d{2}T/.test(v);
const nowMs = (env) => (env?.FEATURES_NOW ? env.FEATURES_NOW() : Date.now());

async function rawSettings(db) {
  const row = await db.prepare("SELECT value FROM studio_settings WHERE key='features'").first();
  return row ? JSON.parse(row.value) : null;
}
async function writeSettings(db, value) {
  await db
    .prepare(
      "INSERT INTO studio_settings VALUES('features',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated=excluded.updated",
    )
    .bind(JSON.stringify(value), new Date().toISOString())
    .run();
}
/** Réglages stockés → réglages complets. Un ancien booléen « opportunities » devient « open » / « hidden ». */
function normalize(raw = {}) {
  const base = sanitizeFeatures(raw || {});
  let mode = OPP_MODES.includes(raw?.opportunitiesMode)
    ? raw.opportunitiesMode
    : typeof raw?.opportunities === "boolean"
      ? raw.opportunities
        ? "open"
        : "hidden"
      : "countdown";
  return { ...base, opportunitiesMode: mode, opportunitiesOpenAt: validIso(raw?.opportunitiesOpenAt) ? raw.opportunitiesOpenAt : null };
}
/**
 * Fonctions visibles. En compte à rebours, la date d'ouverture est fixée à la première lecture (aujourd'hui + 20 jours)
 * puis enregistrée : elle ne glisse pas. Passé cette date, Opportunités s'ouvre toute seule.
 */
export async function readFeatures(db, env) {
  try {
    const raw = await rawSettings(db);
    const f = normalize(raw || {});
    if (f.opportunitiesMode === "countdown" && !f.opportunitiesOpenAt) {
      f.opportunitiesOpenAt = new Date(nowMs(env) + OPP_COUNTDOWN_DAYS * 86400000).toISOString();
      await writeSettings(db, { ...(raw || {}), opportunitiesMode: "countdown", opportunitiesOpenAt: f.opportunitiesOpenAt });
    }
    f.opportunities =
      f.opportunitiesMode === "open" ||
      (f.opportunitiesMode === "countdown" && !!f.opportunitiesOpenAt && nowMs(env) >= Date.parse(f.opportunitiesOpenAt));
    return f;
  } catch {
    return { ...FEATURE_DEFAULTS, opportunitiesMode: "countdown", opportunitiesOpenAt: null };
  }
}

export async function saveFeatures(db, user, b, env) {
  if (user?.role !== "agency") {
    const e = new Error("Cette action est réservée à l’agence.");
    e.status = 403;
    throw e;
  }
  const raw = (await rawSettings(db)) || {},
    cur = await readFeatures(db, env),
    input = b?.features || {};
  const next = { ...sanitizeFeatures({ ...cur, ...input }) };
  delete next.opportunities;
  let mode = cur.opportunitiesMode,
    openAt = cur.opportunitiesOpenAt;
  if (typeof input.opportunities === "boolean") mode = input.opportunities ? "open" : "hidden";
  if (OPP_MODES.includes(input.opportunitiesMode)) mode = input.opportunitiesMode;
  if (input.opportunitiesOpenAt !== undefined) {
    if (!validIso(input.opportunitiesOpenAt)) {
      const e = new Error("Choisissez une date d’ouverture valide.");
      e.status = 400;
      throw e;
    }
    openAt = new Date(input.opportunitiesOpenAt).toISOString();
  }
  if (mode === "countdown" && !openAt) openAt = new Date(nowMs(env) + OPP_COUNTDOWN_DAYS * 86400000).toISOString();
  await writeSettings(db, { ...raw, ...next, opportunitiesMode: mode, opportunitiesOpenAt: openAt });
  return { ok: true, features: await readFeatures(db, env) };
}

// Actions client rattachées à une fonction. Préfixes pour les fonctions « Recréer ce post » et « Importer mon site ».
const ACTION_FEATURE = {
  "opportunity-contact": "opportunities",
  "opportunity-status": "opportunities",
  "collab-request": "opportunities",
  "test-batch-create": "testVersions",
  "test-batch-stop": "testVersions",
  "test-version-metrics": "testVersions",
  "test-version-winner": "testVersions",
  "test-batch-delete": "testVersions",
  "collab-profile-save": "brandCollabs",
  "collab-respond": "brandCollabs",
  "reel-claim": "reels",
};
export function featureForAction(action, body) {
  if (ACTION_FEATURE[action]) return ACTION_FEATURE[action];
  if (action === "upload-intent" && body?.kind === "test-version") return "testVersions";
  if (/^recreate(-|$)/.test(action)) return "recreate";
  if (/^site-import(-|$)/.test(action)) return "siteImport";
  return null;
}

/** Refuse une action client dont la fonction est éteinte. L'agence n'est jamais bloquée. */
export async function assertFeature(db, user, action, body, env) {
  if (!user || user.role === "agency") return;
  const key = featureForAction(action, body);
  if (!key) return;
  let features = await readFeatures(db, env);
  if (user.client_id) {
    const c = await db.prepare("SELECT config FROM clients WHERE id=?").bind(user.client_id).first();
    let cfg = {};
    try {
      cfg = JSON.parse(c?.config || "{}");
    } catch {}
    features = applyClientAccess(features, cfg);
  }
  if (!features[key]) {
    const e = new Error("Cette fonction arrive bientôt.");
    e.status = 403;
    throw e;
  }
}

export const OPP_OPEN_NOTICE = "Votre sélection de marques à contacter est ouverte : retrouvez-la dans Opportunités.";
/** « Me prévenir à l'ouverture » (créatrices seulement, pendant le compte à rebours). */
export async function opportunitiesNotifyMe(db, user, b, env) {
  if (user?.role !== "client" || !user.client_id) {
    const e = new Error("Cette action est réservée aux clientes.");
    e.status = 403;
    throw e;
  }
  const c = await db.prepare("SELECT config FROM clients WHERE id=?").bind(user.client_id).first();
  if (!c) {
    const e = new Error("Espace introuvable.");
    e.status = 404;
    throw e;
  }
  const cfg = JSON.parse(c.config || "{}");
  const want = b?.enabled !== false;
  if (cfg.opportunitiesNotify !== "sent") cfg.opportunitiesNotify = want ? "pending" : null;
  await db.prepare("UPDATE clients SET config=? WHERE id=?").bind(JSON.stringify(cfg), user.client_id).run();
  return { ok: true, notify: cfg.opportunitiesNotify || null };
}
/** À l'ouverture : une notification (une seule fois) pour chaque créatrice qui l'a demandée. Appelé chaque jour. */
export async function announceOpportunities(db, env) {
  const f = await readFeatures(db, env);
  if (!f.opportunities) return { sent: 0 };
  const rows = (await db.prepare("SELECT id,config FROM clients WHERE active=1").all()).results || [];
  let sent = 0;
  for (const r of rows) {
    const cfg = JSON.parse(r.config || "{}");
    if (cfg.opportunitiesNotify !== "pending" || cfg.workspaceType !== "creator") continue;
    cfg.opportunitiesNotify = "sent";
    // Marque « envoyé » d'abord (idempotent même si deux tâches tournent en même temps), puis la notification.
    const done = await db
      .prepare("UPDATE clients SET config=? WHERE id=? AND config=?")
      .bind(JSON.stringify(cfg), r.id, r.config)
      .run();
    if (!done.meta?.changes) continue;
    await db
      .prepare("INSERT INTO notifications VALUES(?,?,?,?,?)")
      .bind(crypto.randomUUID(), r.id, null, OPP_OPEN_NOTICE, new Date().toISOString())
      .run();
    sent++;
  }
  return { sent };
}
