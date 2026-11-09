// « Importer mon site » : la cliente donne l'adresse de son site ; le studio lit la page publique (et jusqu'à
// 3 pages du même site : à propos, produits) pour proposer son slogan, son ton, ses couleurs, ses polices,
// ses produits et ses réseaux. Rien n'est appliqué sans sa confirmation ; ce qui touche au profil de marque
// est transmis à l'agence. Lecture sécurisée : https seulement, adresses privées refusées (y compris après
// une redirection), 5 s maximum, 1,5 Mo maximum, HTML seulement, sans cookies.
import https from "node:https";
import dns from "node:dns";
import net from "node:net";

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
    .replace(/\s+/g, " ")
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

export const SITE_IMPORTS_PER_DAY = 5;
export const SITE_MAX_BYTES = 1.5 * 1024 * 1024;
export const CSS_MAX_BYTES = 200 * 1024;
export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;
const UA = "LouvetStudioBot/1.0 (+https://louvetpartners.com; brand import requested by the site owner)";

// ---------- Adresses interdites (SSRF) ----------
function v4Blocked(ip) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return true;
  const [a, b] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // lien local + métadonnées cloud
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast, réservé, diffusion
  );
}
/** L'adresse IP est-elle privée, locale, réservée ou de métadonnées ? (IPv4 et IPv6, y compris IPv4 dans IPv6) */
export function isBlockedIp(ip) {
  const s = String(ip || "").trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const kind = net.isIP(s);
  if (kind === 4) return v4Blocked(s);
  if (kind !== 6) return true;
  if (s === "::" || s === "::1") return true;
  const mapped = /^(?:0*:)*:?ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s) || /^::(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (mapped) return v4Blocked(mapped[1]);
  const hexMapped = /^(?:0*:)*:?ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(s);
  if (hexMapped) {
    const hi = parseInt(hexMapped[1], 16),
      lo = parseInt(hexMapped[2], 16);
    return v4Blocked([hi >> 8, hi & 255, lo >> 8, lo & 255].join("."));
  }
  const head = parseInt(s.split(":")[0] || "0", 16);
  if ((head & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((head & 0xffc0) === 0xfe80) return true; // fe80::/10 lien local
  if ((head & 0xff00) === 0xff00) return true; // multicast
  if (s.startsWith("64:ff9b:")) return true; // NAT64
  if (s.startsWith("2001:db8:") || s.startsWith("2001:0db8:")) return true; // documentation
  if (/^2002:/.test(s)) return true; // 6to4 (peut cacher une adresse privée)
  return false;
}

/** Adresse d'un site saisie par la cliente → URL https propre, ou null. */
export function normalizeSiteUrl(v) {
  let s = String(v ?? "").trim().slice(0, 500);
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "https://" + s;
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password) return null;
  if (u.port && u.port !== "443") return null;
  if (!/^[a-z0-9.-]+$/i.test(u.hostname) && !net.isIP(u.hostname.replace(/^\[|\]$/g, ""))) return null;
  if (net.isIP(u.hostname.replace(/^\[|\]$/g, ""))) return null; // une vraie adresse de site, pas une IP
  if (!u.hostname.includes(".") || /\.(local|internal|localhost|lan|home|corp)$/i.test(u.hostname) || /^localhost$/i.test(u.hostname)) return null;
  u.hash = "";
  return u.toString();
}

// ---------- Lecture sécurisée ----------
/**
 * Lit une URL https publique. `opts` (tests seulement) : lookup, request, blocked, timeout.
 * La vérification d'adresse se fait au moment de la connexion (lookup épinglé) : pas de contournement par DNS.
 */
export async function safeFetch(url, { accept = "html", maxBytes = SITE_MAX_BYTES, opts = {} } = {}) {
  const lookupFn = opts.lookup || dns.lookup;
  const request = opts.request || https.request;
  const blocked = opts.blocked || isBlockedIp;
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = new URL(current);
    if (u.protocol !== "https:" && !opts.allowHttp) fail(400, "Seules les adresses https sont acceptées.");
    if (u.username || u.password || (u.port && u.port !== "443" && !opts.allowHttp)) fail(400, "Cette adresse n’est pas acceptée.");
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (net.isIP(host) && blocked(host)) fail(400, "Cette adresse n’est pas publique.");
    const pinnedLookup = (hostname, o, cb) => {
      const done = typeof o === "function" ? o : cb;
      lookupFn(hostname, { all: true }, (err, addresses) => {
        if (err) return done(err);
        const list = (Array.isArray(addresses) ? addresses : [{ address: addresses, family: net.isIP(addresses) }]).filter(Boolean);
        if (!list.length || list.some((a) => blocked(a.address))) {
          const e = new Error("blocked");
          e.code = "EBLOCKED";
          return done(e);
        }
        const opt = typeof o === "object" && o ? o : {};
        if (opt.all) return done(null, list);
        done(null, list[0].address, list[0].family || net.isIP(list[0].address));
      });
    };
    const res = await new Promise((ok, ko) => {
      const req = request(
        u,
        {
          method: "GET",
          // Nouvelle connexion à chaque fois : l'adresse est toujours vérifiée (pas de socket réutilisé).
          agent: false,
          lookup: pinnedLookup,
          headers: { "User-Agent": UA, Accept: accept === "html" ? "text/html,application/xhtml+xml" : accept === "css" ? "text/css" : "image/png,image/jpeg", "Accept-Encoding": "identity" },
          timeout: opts.timeout || TIMEOUT_MS,
        },
        (r) => ok(r),
      );
      req.on("timeout", () => req.destroy(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })));
      req.on("error", ko);
      req.end();
    }).catch((e) => {
      if (e.code === "EBLOCKED") fail(400, "Cette adresse n’est pas publique.");
      if (e.code === "ETIMEOUT") fail(504, "Le site met trop de temps à répondre.");
      fail(502, "Impossible de lire ce site pour le moment.");
    });
    const status = res.statusCode || 0;
    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume();
      if (hop === MAX_REDIRECTS) fail(400, "Trop de redirections.");
      current = new URL(res.headers.location, u).toString();
      continue;
    }
    if (status < 200 || status >= 300) {
      res.resume();
      fail(502, "Le site a répondu par une erreur.");
    }
    const type = String(res.headers["content-type"] || "").toLowerCase();
    const okType =
      accept === "html" ? /^(text\/html|application\/xhtml\+xml)/.test(type) : accept === "css" ? /^text\/css/.test(type) : /^image\/(png|jpeg)/.test(type);
    if (!okType) {
      res.resume();
      fail(415, accept === "html" ? "Cette adresse n’est pas une page web." : "Format de fichier non accepté.");
    }
    const declared = Number(res.headers["content-length"] || 0);
    if (declared > maxBytes) {
      res.destroy();
      fail(413, "La page est trop lourde.");
    }
    const chunks = [];
    let size = 0;
    await new Promise((ok, ko) => {
      res.on("data", (c) => {
        size += c.length;
        if (size > maxBytes) {
          res.destroy();
          ko(Object.assign(new Error("too big"), { code: "ETOOBIG" }));
        } else chunks.push(c);
      });
      res.on("end", ok);
      res.on("error", ko);
    }).catch((e) => {
      if (e.code === "ETOOBIG") fail(413, "La page est trop lourde.");
      fail(502, "Impossible de lire ce site pour le moment.");
    });
    const buf = Buffer.concat(chunks);
    return { url: current, type, bytes: new Uint8Array(buf), text: accept === "image" ? "" : buf.toString("utf8") };
  }
  fail(400, "Trop de redirections.");
}

// ---------- Extraction ----------
const decode = (s) =>
  String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(0x10ffff, Number(n))))
    .replace(/&nbsp;/g, " ");
const attr = (tag, name) => {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? decode(m[2] ?? m[3] ?? m[4] ?? "") : "";
};
function metas(html) {
  const out = {};
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const t = m[0];
    const k = (attr(t, "property") || attr(t, "name") || attr(t, "itemprop")).toLowerCase();
    if (k && !(k in out)) out[k] = attr(t, "content");
  }
  return out;
}
const toHex = (c) => {
  let s = c.toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(s)) s = "#" + [...s.slice(1)].map((x) => x + x).join("");
  if (/^#[0-9a-f]{6}$/.test(s)) return s.toUpperCase();
  const m = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/.exec(s);
  if (m) return "#" + [m[1], m[2], m[3]].map((x) => Math.min(255, Number(x)).toString(16).padStart(2, "0")).join("").toUpperCase();
  return null;
};
/** Couleurs les plus fréquentes (hors blanc, noir et gris très neutres), dans l'ordre. */
export function colorsFrom(css, theme = "") {
  const count = new Map();
  for (const m of String(css).matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)/g)) {
    const h = toHex(m[0]);
    if (!h) continue;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    if (max - min < 12 && (max > 235 || max < 30)) continue; // blanc, noir
    count.set(h, (count.get(h) || 0) + 1);
  }
  const list = [...count.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([h]) => h);
  const t = toHex(theme || "");
  return [...new Set([...(t ? [t] : []), ...list])].slice(0, 6);
}
export function fontsFrom(css, html = "") {
  const out = [];
  const add = (f) => {
    const name = clean(f.replace(/["']/g, ""), 40);
    if (!name || /^(inherit|initial|sans-serif|serif|monospace|system-ui|-apple-system|blinkmacsystemfont|segoe ui|arial|helvetica|var\(.*)$/i.test(name)) return;
    if (!out.some((x) => x.toLowerCase() === name.toLowerCase())) out.push(name);
  };
  for (const m of String(css).matchAll(/font-family\s*:\s*([^;}{]+)/gi)) for (const f of m[1].split(",")) add(f);
  for (const m of String(html).matchAll(/fonts\.googleapis\.com\/css2?\?([^"'>\s]+)/gi))
    for (const fam of new URLSearchParams(decode(m[1])).getAll("family")) add(fam.split(":")[0].replace(/\+/g, " "));
  return out.slice(0, 4);
}
function jsonLd(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const v = JSON.parse(m[1].trim());
      const walk = (x) => {
        if (!x || typeof x !== "object") return;
        if (Array.isArray(x)) return x.forEach(walk);
        out.push(x);
        if (x["@graph"]) walk(x["@graph"]);
        if (x.itemListElement) walk(x.itemListElement.map((i) => i.item || i));
      };
      walk(v);
    } catch {}
  }
  return out;
}
const typeIs = (x, t) => [].concat(x["@type"] || []).some((y) => String(y).toLowerCase() === t);
export function productsFrom(nodes) {
  const out = [];
  for (const n of nodes.filter((x) => typeIs(x, "product"))) {
    const offer = [].concat(n.offers || [])[0] || {};
    const name = clean(n.name, 120);
    if (!name || out.some((p) => p.name.toLowerCase() === name.toLowerCase())) continue;
    const price = offer.price ?? offer.lowPrice;
    out.push({
      name,
      description: clean(n.description, 300),
      price: price != null && price !== "" ? clean(`${price} ${offer.priceCurrency || ""}`, 30) : "",
      image: clean([].concat(n.image || [])[0]?.url || [].concat(n.image || [])[0] || "", 500),
    });
  }
  return out.slice(0, 12);
}
const SOCIAL = /^https?:\/\/(www\.)?(instagram\.com|facebook\.com|tiktok\.com|linkedin\.com|youtube\.com|pinterest\.[a-z.]+|x\.com|twitter\.com)\/[^\s"'<>]+/i;
export function socialsFrom(html, nodes = []) {
  const out = [];
  const add = (h) => {
    const m = SOCIAL.exec(String(h || "").trim());
    if (!m) return;
    const url = m[0].replace(/[?#].*$/, "").replace(/\/+$/, "");
    if (/\/(sharer|share|intent|dialog|plugins)\b/i.test(url)) return;
    if (!out.includes(url)) out.push(url);
  };
  for (const m of html.matchAll(/<a\b[^>]*>/gi)) add(attr(m[0], "href"));
  for (const n of nodes) for (const s of [].concat(n.sameAs || [])) add(s);
  return out.slice(0, 8);
}
const visibleText = (html) =>
  clean(
    decode(
      html
        .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ),
    4000,
  );
const LINK_HINT = /(about|a-propos|apropos|qui-sommes|notre-histoire|histoire|nosotros|quienes|acerca|story|products?|produits?|productos?|shop|boutique|tienda|collections?|carte|menu)/i;
/** Lit le HTML d'une page : informations, liens internes intéressants et feuilles de style à lire. */
export function extractPage(html, pageUrl) {
  const m = metas(html);
  const title = clean(decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || ""), 120);
  const nodes = jsonLd(html);
  const org = nodes.find((x) => typeIs(x, "organization") || typeIs(x, "localbusiness") || typeIs(x, "store") || typeIs(x, "restaurant"));
  const base = new URL(pageUrl);
  const abs = (h) => {
    try {
      const u = new URL(h, base);
      // Même protocole que la page (toujours https en production).
      return u.protocol === base.protocol && (u.protocol === "https:" || u.protocol === "http:") ? u.toString() : "";
    } catch {
      return "";
    }
  };
  const links = [],
    css = [];
  for (const t of html.matchAll(/<a\b[^>]*>/gi)) {
    const u = abs(attr(t[0], "href"));
    if (u && new URL(u).host === base.host && LINK_HINT.test(new URL(u).pathname) && !links.includes(u.replace(/#.*$/, ""))) links.push(u.replace(/#.*$/, ""));
  }
  for (const t of html.matchAll(/<link\b[^>]*>/gi)) {
    if (!/stylesheet/i.test(attr(t[0], "rel"))) continue;
    const u = abs(attr(t[0], "href"));
    if (u && new URL(u).host === base.host && !css.includes(u)) css.push(u);
  }
  const inlineCss = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((x) => x[1]).join("\n") + "\n" + [...html.matchAll(/\bstyle\s*=\s*"([^"]*)"/gi)].map((x) => x[1]).join(";");
  return {
    name: clean(m["og:site_name"] || org?.name || title.split(/[|–—-]/)[0], 120),
    title,
    description: clean(m.description || m["og:description"] || org?.description || "", 300),
    image: abs(m["og:image"] || m["og:image:url"] || m["twitter:image"] || [].concat(org?.logo || [])[0]?.url || [].concat(org?.logo || [])[0] || ""),
    theme: m["theme-color"] || "",
    products: productsFrom(nodes),
    socials: socialsFrom(html, nodes),
    links: links.slice(0, 6),
    css: css.slice(0, 2),
    inlineCss,
    text: visibleText(html),
  };
}

/** Lecture complète d'un site : page d'accueil, 3 pages internes au plus, 2 feuilles de style au plus. */
export async function readSite(url, opts = {}) {
  const home = await safeFetch(url, { accept: "html", opts });
  const page = extractPage(home.text, home.url);
  let css = page.inlineCss;
  const products = [...page.products],
    socials = [...page.socials];
  let text = page.text;
  for (const link of page.links.slice(0, 3)) {
    try {
      const p = await safeFetch(link, { accept: "html", opts });
      if (new URL(p.url).host !== new URL(home.url).host) continue;
      const x = extractPage(p.text, p.url);
      for (const pr of x.products) if (!products.some((y) => y.name.toLowerCase() === pr.name.toLowerCase())) products.push(pr);
      for (const s of x.socials) if (!socials.includes(s)) socials.push(s);
      text += "\n" + x.text.slice(0, 1500);
      css += "\n" + x.inlineCss;
    } catch {}
  }
  for (const sheet of page.css) {
    try {
      css += "\n" + (await safeFetch(sheet, { accept: "css", maxBytes: CSS_MAX_BYTES, opts })).text;
    } catch {}
  }
  return {
    url: home.url,
    name: page.name,
    title: page.title,
    description: page.description,
    image: page.image,
    colors: colorsFrom(css, page.theme),
    fonts: fontsFrom(css, home.text),
    products: products.slice(0, 12),
    socials: socials.slice(0, 8),
    text: clean(text, 6000),
  };
}

// ---------- IA (facultative) ----------
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
async function summarize(env, site, lang) {
  const base = String(env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const r = await (env.API_FETCH || fetch)(base + "/responses", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.OPENAI_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.TEXT_MODEL || "gpt-5-mini",
      input: `From this public website text, describe the brand for its social media studio, in ${LANG[lang]}. Only use what the text says: never invent prices, claims, awards or numbers. tagline: max 80 characters. tone: max 140 characters, how the brand speaks. pillars: exactly 3 short content themes. products: up to 8 products or services actually named on the site (name max 80, description max 160). Return only JSON.\n\nSite name: ${site.name}\nTitle: ${site.title}\nDescription: ${site.description}\nText:\n${site.text.slice(0, 5000)}`,
      text: {
        format: {
          type: "json_schema",
          name: "site_brand",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["tagline", "tone", "pillars", "products"],
            properties: {
              tagline: { type: "string" },
              tone: { type: "string" },
              pillars: { type: "array", items: { type: "string" } },
              products: {
                type: "array",
                items: { type: "object", additionalProperties: false, required: ["name", "description"], properties: { name: { type: "string" }, description: { type: "string" } } },
              },
            },
          },
        },
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) return null;
  const d = await r.json();
  const out = d?.output_text || d?.output?.flatMap((o) => o.content || []).find((x) => x.type === "output_text")?.text || "";
  try {
    return JSON.parse(/\{[\s\S]*\}/.exec(out)?.[0] || "null");
  } catch {
    return null;
  }
}

// ---------- Actions ----------
async function space(db, user, cid) {
  if (!cid || (user.role !== "agency" && user.client_id !== cid)) fail(403, "Cet espace ne vous est pas accessible.");
  if (await first(db, "SELECT client_id FROM client_deletions WHERE client_id=?", cid)) fail(410, "Cet espace est en cours de suppression.");
  const c = await first(db, "SELECT * FROM clients WHERE id=?", cid);
  if (!c) fail(404, "Espace introuvable.");
  if (!c.active) fail(403, "Cet espace est suspendu.");
  return c;
}
async function audit(db, user, cid, action, target, detail = {}) {
  await run(db, "INSERT INTO audit VALUES(?,?,?,?,?,?,?)", uid(), cid, user.id, action, target, JSON.stringify(detail), now());
}

/** Lecture d'un site : { client_id, url }. 5 lectures par jour et par espace (réservées avant la lecture). */
export async function siteImport(env, user, b) {
  const db = env.DB;
  const c = await space(db, user, clean(b.client_id, 80));
  const url = normalizeSiteUrl(b.url);
  if (!url) fail(400, "Indiquez l’adresse de votre site, par exemple https://www.monsite.com.");
  const since = new Date(Date.now() - 86400000).toISOString();
  const slot = await run(
    db,
    "INSERT INTO audit(id,client_id,author,action,target,detail,created) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM audit WHERE client_id=? AND action='site_import' AND created>?)<?",
    uid(),
    c.id,
    user.id,
    "site_import",
    url,
    JSON.stringify({ url }),
    now(),
    c.id,
    since,
    SITE_IMPORTS_PER_DAY,
  );
  if (!slot.meta.changes) fail(429, "5 lectures de site par jour au maximum. Réessayez demain.");
  const site = env.SITE_READ ? await env.SITE_READ(url) : await readSite(url);
  const cfg = parse(c.config);
  const lang = contentLanguage(cfg.language);
  let ai = null;
  if (await aiReady(env, db)) {
    try {
      ai = await summarize(env, site, lang);
    } catch {
      ai = null;
    }
  }
  const pillars = (Array.isArray(ai?.pillars) ? ai.pillars : []).map((x) => clean(x, 60)).filter(Boolean).slice(0, 3);
  const aiProducts = (Array.isArray(ai?.products) ? ai.products : []).map((p) => ({ name: clean(p?.name, 80), description: clean(p?.description, 160), price: "", image: "" })).filter((p) => p.name);
  const products = [...site.products];
  for (const p of aiProducts) if (!products.some((x) => x.name.toLowerCase() === p.name.toLowerCase())) products.push(p);
  const result = {
    url: site.url,
    name: clean(site.name, 120),
    tagline: clean(ai?.tagline || site.description, 120),
    description: clean(site.description, 300),
    tone: clean(ai?.tone, 160),
    pillars,
    colors: site.colors.slice(0, 6),
    fonts: site.fonts.slice(0, 4),
    products: products.slice(0, 12),
    socials: site.socials.slice(0, 8),
    image: site.image && /^https:\/\//.test(site.image) ? site.image : "",
    ai: !!ai,
  };
  const id = uid();
  await run(db, "INSERT INTO site_imports VALUES(?,?,?,?,?,?)", id, c.id, url, JSON.stringify(result), "{}", now());
  // Seules les 10 dernières lectures sont gardées.
  await run(db, "DELETE FROM site_imports WHERE client_id=? AND id NOT IN (SELECT id FROM site_imports WHERE client_id=? ORDER BY created DESC LIMIT 10)", c.id, c.id);
  return { import: { id, ...result } };
}

/**
 * Application : { id, products: [index], suggest: { tagline, tone, pillars, colors, fonts, socials }, image: bool }.
 * Les produits cochés sont créés tout de suite (sans photo) ; le reste est envoyé à l'agence, qui l'applique au profil.
 * `deps` : { addProduct, saveImage, notifyAgency } fournis par le studio.
 */
export async function siteImportApply(env, user, b, deps) {
  const db = env.DB;
  const row = await first(db, "SELECT * FROM site_imports WHERE id=?", clean(b.id, 100));
  if (!row) fail(404, "Lecture introuvable.");
  const c = await space(db, user, row.client_id);
  const result = parse(row.result);
  const applied = parse(row.applied);
  if (applied.at) fail(409, "Ces informations ont déjà été appliquées.");
  const picks = [...new Set((Array.isArray(b.products) ? b.products : []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < (result.products || []).length))].slice(0, 12);
  const created = [];
  for (const i of picks) {
    const p = result.products[i];
    const description = clean([p.description, p.price].filter(Boolean).join(" · "), 1000) || clean(result.description, 1000) || p.name;
    const r = await deps.addProduct(db, user, { client_id: c.id, name: p.name, description, commercial: p.price || "" });
    created.push(r.id);
  }
  let imageFile = null;
  if (b.image === true && result.image) imageFile = await deps.saveImage(env, user, c, result.image, created[0] || null);
  const s = b.suggest && typeof b.suggest === "object" ? b.suggest : {};
  const suggestion = {
    tagline: s.tagline ? result.tagline : "",
    tone: s.tone ? result.tone : "",
    pillars: s.pillars ? result.pillars : [],
    colors: s.colors ? result.colors : [],
    fonts: s.fonts ? result.fonts : [],
    socials: s.socials ? result.socials : [],
  };
  const hasSuggestion = Object.values(suggestion).some((v) => (Array.isArray(v) ? v.length : v));
  const next = { at: now(), by: user.id, products: created, image: imageFile, suggestion: hasSuggestion ? suggestion : null, agencyApplied: false };
  const done = await run(db, "UPDATE site_imports SET applied=? WHERE id=? AND applied='{}'", JSON.stringify(next), row.id);
  if (!done.meta.changes) fail(409, "Ces informations ont déjà été appliquées.");
  await audit(db, user, c.id, "site_import_applied", row.id, { products: created.length, image: !!imageFile, suggestion: hasSuggestion });
  if (hasSuggestion || created.length) await deps.notifyAgency(db, `Site importé pour ${clean(c.name, 80)} : ${created.length} produit(s) ajouté(s)${hasSuggestion ? ", suggestions de profil à valider dans Marque & accès" : ""}.`);
  return { ok: true, products: created, image: imageFile, suggested: hasSuggestion };
}

/** L'agence applique les suggestions au profil : { id }. */
export async function siteImportAgencyApply(env, user, b) {
  if (user.role !== "agency") fail(403, "Cette action est réservée à l’agence.");
  const db = env.DB;
  const row = await first(db, "SELECT * FROM site_imports WHERE id=?", clean(b.id, 100));
  if (!row) fail(404, "Lecture introuvable.");
  const applied = parse(row.applied);
  if (!applied.suggestion) fail(409, "Aucune suggestion à appliquer.");
  if (applied.agencyApplied) fail(409, "Déjà appliqué.");
  const c = await first(db, "SELECT * FROM clients WHERE id=?", row.client_id);
  if (!c) fail(404, "Espace introuvable.");
  const cfg = parse(c.config);
  const s = applied.suggestion;
  const next = { ...cfg };
  if (s.tone) next.tone = clean(s.tone, 160);
  if (s.tagline) next.tagline = clean(s.tagline, 120);
  if (s.colors?.length) next.colors = s.colors.slice(0, 4).join(", ");
  if (s.pillars?.length) {
    next.contentPillars = s.pillars.slice(0, 3);
    if (cfg.workspaceType === "creator" && !(cfg.creatorStrategy?.pillars || []).length)
      next.creatorStrategy = { ...(cfg.creatorStrategy || {}), pillars: s.pillars.slice(0, 3) };
  }
  if (s.socials?.length) next.socials = s.socials.slice(0, 8);
  await run(db, "UPDATE clients SET config=? WHERE id=?", JSON.stringify(next), c.id);
  await run(db, "UPDATE site_imports SET applied=? WHERE id=?", JSON.stringify({ ...applied, agencyApplied: true, agencyAt: now() }), row.id);
  await audit(db, user, c.id, "site_import_agency_applied", row.id, {});
  return { ok: true };
}

export async function siteImportState(db, user, client) {
  if (!client) return { siteImports: [] };
  if (user.role !== "agency" && user.client_id !== client.id) return { siteImports: [] };
  const rows = await all(db, "SELECT * FROM site_imports WHERE client_id=? ORDER BY created DESC LIMIT 3", client.id).catch(() => []);
  return { siteImports: rows.map((r) => ({ id: r.id, url: r.url, ...parse(r.result), applied: parse(r.applied), created: r.created })) };
}

/** Image du site confirmée par la cliente : lue avec les mêmes règles, vérifiée, rangée dans son espace. */
export async function fetchSiteImage(url, opts = {}) {
  if (!/^https:\/\//i.test(String(url || ""))) fail(400, "Seules les adresses https sont acceptées.");
  const r = await safeFetch(url, { accept: "image", maxBytes: IMAGE_MAX_BYTES, opts });
  return { bytes: r.bytes, mime: r.type.startsWith("image/png") ? "image/png" : "image/jpeg" };
}
