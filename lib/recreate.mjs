// « Recréer ce post » : la cliente colle le lien d'un post ou d'un Reel Instagram qu'elle aime, et en joint 1 à 6
// captures d'écran (ou des images extraites de son enregistrement d'écran, dans le navigateur).
// Le studio n'ouvre jamais le lien (Instagram l'interdit) : il lit seulement les captures, en décrit la « recette »
// (format, mise en page, accroche, rythme) et propose des modèles du studio remplis avec SES photos et SES textes.
// On reprend l'idée et la mise en page, jamais les images, la musique ou le texte d'un autre compte.
import { normalizeReelUrl } from "./collabs.mjs";
import { catalogue, CREATOR_INTENTS, BRAND_INTENTS } from "./catalogue.mjs";
import { layerTemplateById, buildLayered } from "./layer-templates.mjs";
import { templateById } from "./templates.mjs";

const q = (db, s, ...a) => db.prepare(s).bind(...a),
  first = (db, s, ...a) => q(db, s, ...a).first(),
  all = async (db, s, ...a) => (await q(db, s, ...a).all()).results,
  run = (db, s, ...a) => q(db, s, ...a).run();
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
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
const parse = (s, f = {}) => {
  try {
    return s ? JSON.parse(s) : f;
  } catch {
    return f;
  }
};

export const RECREATE_KINDS = ["post", "carousel", "reel"];
export const RECREATE_MOODS = ["minimal", "editorial", "fun", "luxe"];
export const RECREATE_MAX_FILES = 6;
export const RECREATE_PER_HOUR = 10;
export const RECREATE_KEEP = 30;
const isCreator = (cfg) => cfg?.workspaceType === "creator";
const intentIds = (creator) => (creator ? CREATOR_INTENTS : BRAND_INTENTS).map((i) => i.id);

/** Lien Instagram d'un post ou d'un Reel → lien canonique (ou null). Les liens de partage (/share/) sont refusés. */
export function canonicalInstagram(v) {
  const r = normalizeReelUrl(v);
  return r ? r.url : null;
}
/** Lien passé dans l'adresse du studio (?recreate=…), depuis un raccourci iPhone ou le partage Android. */
export function recreateParam(search) {
  try {
    const p = new URLSearchParams(String(search || "").replace(/^\?/, ""));
    const raw = p.get("recreate") || p.get("url") || p.get("text") || "";
    // Le partage Android met parfois le lien au milieu d'un texte.
    const m = /https?:\/\/[^\s]+/i.exec(raw);
    return canonicalInstagram(m ? m[0] : raw);
  } catch {
    return null;
  }
}

/** Recette renvoyée par l'IA (ou construite à la main) : bornée, propre, avec des valeurs connues. */
export function sanitizeRecipe(input, { creator = false, fallbackKind = "post", fallbackIntent = "" } = {}) {
  const r = input && typeof input === "object" ? input : {};
  const ids = intentIds(creator);
  const kind = RECREATE_KINDS.includes(r.kind) ? r.kind : RECREATE_KINDS.includes(fallbackKind) ? fallbackKind : "post";
  const intent = ids.includes(r.intent) ? r.intent : ids.includes(fallbackIntent) ? fallbackIntent : ids[0];
  const slides = Math.max(1, Math.min(10, Math.round(Number(r.slides) || (kind === "carousel" ? 3 : 1))));
  const texts = r.texts && typeof r.texts === "object" ? r.texts : {};
  const shots = (Array.isArray(r.shots) ? r.shots : [])
    .slice(0, 8)
    .map((s) => ({
      duration: Math.max(1, Math.min(15, Math.round(Number(s?.duration) || 3))),
      framing: clean(s?.framing, 80),
      action: clean(s?.action, 200),
    }))
    .filter((s) => s.action);
  const colors = (Array.isArray(r.colors) ? r.colors : [])
    .map((c) => String(c || "").trim().toUpperCase())
    .filter((c) => /^#[0-9A-F]{6}$/.test(c))
    .slice(0, 5);
  return {
    kind,
    intent,
    mood: RECREATE_MOODS.includes(r.mood) ? r.mood : "editorial",
    slides: kind === "carousel" ? Math.max(2, slides) : 1,
    summary: clean(r.summary, 400),
    layout: clean(r.layout, 300),
    hook: clean(r.hook, 200),
    texts: {
      title: clean(texts.title, 80),
      subtitle: clean(texts.subtitle, 140),
      items: (Array.isArray(texts.items) ? texts.items : []).map((x) => clean(x, 90)).filter(Boolean).slice(0, 6),
      caption: clean(texts.caption, 600),
    },
    shots: kind === "reel" ? shots : [],
    colors,
  };
}

/**
 * Les 3 modèles du studio qui ressemblent le plus à la recette, pour ce format : même intention, même ambiance,
 * nombre de diapos proche. Déterministe : à recette égale, mêmes suggestions.
 */
export function suggestTemplates(config = {}, recipe) {
  const creator = isCreator(config);
  const format = recipe.kind === "carousel" ? "carousel" : recipe.kind === "reel" ? "reel" : "post";
  const pool = (intent) => {
    const { forYou, rest } = catalogue(config, { brand: !creator, format, intent });
    return [...forYou, ...rest];
  };
  let list = pool(recipe.intent);
  if (list.length < 3) for (const x of pool("")) if (!list.some((y) => y.kind === x.kind && y.id === x.id)) list.push(x);
  const slidesOf = (x) => (x.kind === "layer" ? Number(x.t.slides) || 1 : templateById(x.id)?.slides || 1);
  // Les textes réécrits doivent avoir où aller : les modèles vides (toile vierge) ne sont jamais proposés.
  list = list.filter((x) => !/blank/.test(x.id));
  const textSlots = (x) => {
    if (x.kind !== "layer") return 2;
    try {
      return buildLayered(x.id, { lang: "fr" }).layers.filter((l) => ["text", "bubble", "label", "circletext"].includes(l.type)).length;
    } catch {
      return 0;
    }
  };
  const scored = list.map((x, i) => {
    let s = 0;
    const slots = textSlots(x);
    if (slots >= 2) s += 25;
    else if (slots === 1) s += 10;
    if (x.kind === "layer" && x.t.intents.includes(recipe.intent)) s += 15;
    if (x.mood === recipe.mood) s += 20;
    if (recipe.kind === "carousel") s -= Math.min(5, Math.abs(slidesOf(x) - recipe.slides)) * 3;
    return { x, s, i };
  });
  scored.sort((a, b) => b.s - a.s || a.i - b.i);
  return scored.slice(0, 3).map(({ x }) => ({
    kind: x.kind,
    id: x.id,
    format: format === "carousel" || format === "post" ? "4:5" : "9:16",
    photos: x.kind === "layer" ? x.t.photos : (templateById(x.id)?.photos || [0, 0])[1],
  }));
}

async function space(db, user, cid) {
  if (!cid || (user.role !== "agency" && user.client_id !== cid)) fail(403, "Cet espace ne vous est pas accessible.");
  if (await first(db, "SELECT client_id FROM client_deletions WHERE client_id=?", cid)) fail(410, "Cet espace est en cours de suppression.");
  const c = await first(db, "SELECT * FROM clients WHERE id=?", cid);
  if (!c) fail(404, "Espace introuvable.");
  if (!c.active) fail(403, "Cet espace est suspendu.");
  return c;
}

const LANG = { fr: "French", es: "Mexican Spanish (use \"tú\")", en: "American English" };
const contentLanguage = (v) => {
  const s = String(v || "").toLowerCase();
  return /^(fr|fran)/.test(s) ? "fr" : /^(en|ingl|angl)/.test(s) ? "en" : "es";
};
async function aiReady(env, db) {
  if (env.AI_GENERATION_ENABLED !== "true" || !env.OPENAI_API_KEY) return false;
  const connection = await first(db, "SELECT value FROM studio_settings WHERE key='api_status'").catch(() => null);
  return (connection ? parse(connection.value).status : env.AI_STATUS) !== "billing_required";
}
const b64 = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const RECIPE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "intent", "mood", "slides", "summary", "layout", "hook", "texts", "shots", "colors"],
  properties: {
    kind: { type: "string", enum: RECREATE_KINDS },
    intent: { type: "string" },
    mood: { type: "string", enum: RECREATE_MOODS },
    slides: { type: "integer" },
    summary: { type: "string" },
    layout: { type: "string" },
    hook: { type: "string" },
    texts: {
      type: "object",
      additionalProperties: false,
      required: ["title", "subtitle", "items", "caption"],
      properties: { title: { type: "string" }, subtitle: { type: "string" }, items: { type: "array", items: { type: "string" } }, caption: { type: "string" } },
    },
    shots: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["duration", "framing", "action"],
        properties: { duration: { type: "number" }, framing: { type: "string" }, action: { type: "string" } },
      },
    },
    colors: { type: "array", items: { type: "string" } },
  },
};
/** Texte JSON renvoyé par l'API Responses (output_text ou contenu détaillé). Tolère un bloc ```json. */
export function responseJson(d) {
  const out = d?.output_text || d?.output?.flatMap((o) => o.content || []).find((x) => x.type === "output_text")?.text || "";
  const m = /\{[\s\S]*\}/.exec(String(out));
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

async function analyzeWithAi(env, c, files, hint) {
  const cfg = parse(c.config);
  const creator = isCreator(cfg);
  const lang = contentLanguage(cfg.language);
  const images = [];
  for (const f of files) {
    const obj = await env.BUCKET.get(f.key);
    if (!obj) continue;
    const bytes = new Uint8Array(await obj.arrayBuffer());
    images.push({ type: "input_image", image_url: `data:${f.mime};base64,${b64(bytes)}` });
  }
  if (!images.length) return null;
  const subject = creator
    ? `a content creator. Display name: ${clean(cfg.creatorStrategy?.displayName || c.name, 80)}. Pillars: ${clean((cfg.creatorStrategy?.pillars || []).join(", "), 200)}. Audience: ${clean(cfg.creatorStrategy?.audience, 160)}.`
    : `a brand: ${clean(cfg.brand || c.name, 120)}. Tone: ${clean(cfg.tone, 160)}. Sector: ${clean(cfg.sector, 60)}.`;
  const prompt = [
    "You analyse screenshots of a social media post (or frames of a Reel) that a client likes, to recreate the IDEA with her own content.",
    "Describe the structure only: format (post, carousel or reel), layout, hook style, rhythm, number of slides or shots, mood and dominant colors.",
    "NEVER copy the original text, names, logos, brands, music or the identity of people shown. Do not mention the original account.",
    `Then rewrite new short texts for ${subject} Write them in ${LANG[lang]}. No hashtags. Never invent prices, discounts, reviews, numbers or health claims.`,
    `intent must be one of: ${intentIds(creator).join(", ")}.`,
    "summary: 1–2 plain sentences for the client explaining why this post works and how we recreate it, in the client's language.",
    "For reels, shots lists 3 to 8 shots the client can film with her phone (duration in seconds, framing, action), in the client's language.",
    hint.kind ? `The client says it is a ${hint.kind}.` : "",
    hint.intent ? `The client wants: ${hint.intent}.` : "",
    "Return only JSON.",
  ]
    .filter(Boolean)
    .join("\n");
  const base = String(env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const r = await (env.API_FETCH || fetch)(base + "/responses", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.OPENAI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.TEXT_MODEL || "gpt-5-mini",
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }, ...images] }],
      text: { format: { type: "json_schema", name: "post_recipe", strict: true, schema: RECIPE_SCHEMA } },
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!r.ok) return null;
  return responseJson(await r.json());
}

/**
 * Analyse : { client_id, url?, file_ids[1..6], kind?, intent? }.
 * Le routeur vérifie le paiement et la limite horaire (10 par espace) avant d'appeler.
 */
export async function recreateAnalyze(env, user, b) {
  const db = env.DB;
  const c = await space(db, user, clean(b.client_id, 80));
  const cfg = parse(c.config);
  const creator = isCreator(cfg);
  const rawUrl = clean(b.url, 500);
  const url = rawUrl ? canonicalInstagram(rawUrl) : "";
  if (rawUrl && !url) fail(400, "Collez le lien d’un post ou d’un Reel Instagram (instagram.com/p/… ou /reel/…).");
  const ids = [...new Set((Array.isArray(b.file_ids) ? b.file_ids : []).map((x) => clean(x, 100)).filter(Boolean))];
  if (!ids.length) fail(400, "Ajoutez au moins une capture d’écran du post.");
  if (ids.length > RECREATE_MAX_FILES) fail(400, "6 captures au maximum.");
  const files = [];
  for (const id of ids) {
    const f = await first(db, "SELECT id,client_id,key,mime,purpose FROM files WHERE id=?", id);
    if (!f || f.client_id !== c.id || f.purpose !== "inspiration") fail(403, "Cette capture n’appartient pas à cet espace.");
    files.push(f);
  }
  const hintKind = RECREATE_KINDS.includes(b.kind) ? b.kind : files.length > 1 ? "carousel" : "post";
  const hintIntent = intentIds(creator).includes(b.intent) ? b.intent : "";
  let raw = null,
    ai = false;
  if (await aiReady(env, db)) {
    try {
      raw = await analyzeWithAi(env, c, files, { kind: RECREATE_KINDS.includes(b.kind) ? b.kind : "", intent: hintIntent });
      ai = !!raw;
    } catch {
      raw = null;
    }
  }
  const recipe = sanitizeRecipe(raw, { creator, fallbackKind: hintKind, fallbackIntent: hintIntent });
  if (!ai && hintKind === "carousel") recipe.slides = Math.max(2, Math.min(10, files.length));
  const suggestions = suggestTemplates(cfg, recipe);
  const id = uid();
  await run(
    db,
    "INSERT INTO inspirations VALUES(?,?,?,?,?,?,?,?)",
    id,
    c.id,
    url || "",
    recipe.kind,
    JSON.stringify(ids),
    JSON.stringify({ ...recipe, ai, suggestions }),
    ai ? "analyzed" : "manual",
    now(),
  );
  // Seules les 30 dernières recettes sont gardées (captures comprises).
  const old = await all(db, "SELECT id,files FROM inspirations WHERE client_id=? ORDER BY created DESC LIMIT 100 OFFSET ?", c.id, RECREATE_KEEP);
  for (const o of old) await removeInspiration(env, c.id, o);
  return { inspiration: { id, url: url || "", kind: recipe.kind, files: ids, recipe, ai, suggestions, created: now() } };
}

async function removeInspiration(env, cid, row) {
  const db = env.DB;
  for (const fid of parse(row.files, [])) {
    const f = await first(db, "SELECT id,key FROM files WHERE id=? AND client_id=? AND purpose='inspiration'", fid, cid);
    if (!f) continue;
    await env.BUCKET.delete(f.key).catch(() => {});
    await run(db, "DELETE FROM files WHERE id=?", f.id);
  }
  await run(db, "DELETE FROM inspirations WHERE id=? AND client_id=?", row.id, cid);
}

export async function recreateDelete(env, user, b) {
  const db = env.DB;
  const row = await first(db, "SELECT * FROM inspirations WHERE id=?", clean(b.id, 100));
  if (!row) fail(404, "Recette introuvable.");
  if (user.role !== "agency" && user.client_id !== row.client_id) fail(403, "Cet espace ne vous est pas accessible.");
  await removeInspiration(env, row.client_id, row);
  return { ok: true };
}

export async function recreateState(db, user, client) {
  if (!client) return { inspirations: [] };
  if (user.role !== "agency" && user.client_id !== client.id) return { inspirations: [] };
  const rows = await all(db, "SELECT * FROM inspirations WHERE client_id=? ORDER BY created DESC LIMIT 8", client.id).catch(() => []);
  return {
    inspirations: rows.map((r) => {
      const recipe = parse(r.recipe);
      return { id: r.id, url: r.url, kind: r.kind, files: parse(r.files, []), recipe, ai: !!recipe.ai, suggestions: recipe.suggestions || [], status: r.status, created: r.created };
    }),
  };
}

/** Le modèle suggéré existe-t-il encore ? (sert à l'interface et aux tests) */
export const suggestionExists = (s) => (s.kind === "layer" ? !!layerTemplateById(s.id) : !!templateById(s.id));
