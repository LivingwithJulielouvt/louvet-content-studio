// Collaborations entre clients du studio, et Reels avec la fondatrice.
// 1. Marques ouvertes aux collaborations : une marque cliente choisit (consentement explicite, désactivé par défaut)
//    d'apparaître auprès des créatrices du studio avec son offre. Une créatrice propose une collaboration ;
//    l'adresse de contact de la marque n'est montrée qu'après son accord.
// 2. Reels avec @withjulielouvet : chaque client déclare un Reel publié en collaboration ; une fois validé par l'agence,
//    une remise est déduite de sa prochaine facture Stripe (crédit de solde, dans la devise de son abonnement).
import { isCreator } from "./workspaces.mjs";
import { NICHES, OPP_COUNTRIES, nicheKey, normalizeHandle, normalizeEmail, normalizeSite } from "./opportunities.mjs";
import { monthInMonterrey } from "./editorial.mjs";
import { reelCollabReward, reelCollabMaxPerMonth, REEL_COLLAB_ACCOUNT, normRegion } from "./pricing.mjs";
import { stripe, stripeMode, creditRegionFor } from "./billing.mjs";

const q = (db, s, ...a) => db.prepare(s).bind(...a),
  first = (db, s, ...a) => q(db, s, ...a).first(),
  all = async (db, s, ...a) => (await q(db, s, ...a).all()).results,
  run = (db, s, ...a) => q(db, s, ...a).run();
const now = () => new Date().toISOString();
const ago = (ms) => new Date(Date.now() - ms).toISOString();
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
    return (typeof s === "string" ? JSON.parse(s || "{}") : s) || {};
  } catch {
    return {};
  }
};
const uid = () => crypto.randomUUID();

export const OFFER_TYPES = ["product", "paid", "affiliate", "visibility", "other"];
export const COLLAB_OFFER_MAX = 280;
export const COLLAB_LOOKING_MAX = 200;
export const COLLAB_MESSAGE_MAX = 600;
export const COLLAB_REPLY_MAX = 400;
export const COLLAB_REQUESTS_PER_DAY = 10;
export const COLLAB_RETRY_DAYS = 30;
export const REEL_CLAIMS_PER_DAY = 20;
export { NICHES };

async function audit(db, user, clientId, action, target, data = {}) {
  await run(db, "INSERT INTO audit VALUES(?,?,?,?,?,?,?)", uid(), clientId ?? null, user.id, action, target, JSON.stringify(data), now());
}
async function notice(db, clientId, message) {
  await run(db, "INSERT INTO notifications VALUES(?,?,?,?,?)", uid(), clientId, null, message, now());
}
/** L'espace du client connecté (jamais celui d'un autre), hors suppression. */
async function ownSpace(db, user, cid) {
  if (user.role !== "client" || !cid || user.client_id !== cid) fail(403, "Cet espace ne vous est pas accessible.");
  if (await first(db, "SELECT client_id FROM client_deletions WHERE client_id=?", cid)) fail(410, "Cet espace est en cours de suppression.");
  const c = await first(db, "SELECT id,name,config,active FROM clients WHERE id=?", cid);
  if (!c) fail(404, "Espace introuvable.");
  return { ...c, cfg: parse(c.config) };
}
async function brandSpace(db, user, cid) {
  const c = await ownSpace(db, user, cid);
  if (isCreator(c.cfg)) fail(403, "Les collaborations se règlent depuis un espace marque.");
  return c;
}
async function creatorSpace(db, user, cid) {
  const c = await ownSpace(db, user, cid);
  if (!isCreator(c.cfg)) fail(403, "Les opportunités sont réservées aux espaces créatrices.");
  return c;
}
const brandName = (c) => clean(parse(c.config).brand, 120) || c.name;
const creatorInfo = (c) => {
  const cfg = parse(c.config),
    s = cfg.creatorStrategy || {};
  return { name: clean(s.displayName, 120) || clean(cfg.brand, 120) || c.name, topic: clean((s.pillars || [])[0], 120) };
};

/* ------------------------------------------------------------------ */
/* 1. Profil collaboration d'une marque                                */
/* ------------------------------------------------------------------ */
/** « @ma.marque », « instagram.com/ma.marque » → compte ; sinon un site https. */
export function normalizeCollabLink(v) {
  const s = clean(v, 300);
  if (!s) return "";
  if (s.startsWith("@") || /instagram\.com\//i.test(s)) {
    const h = normalizeHandle(s);
    return h ? "@" + h : null;
  }
  return normalizeSite(s);
}
export function validateCollabProfile(input = {}) {
  const enabled = input.enabled === true;
  const offer_types = [...new Set((Array.isArray(input.offer_types) ? input.offer_types : []).filter((x) => OFFER_TYPES.includes(x)))];
  const offer = clean(input.offer, COLLAB_OFFER_MAX + 50);
  if (offer.length > COLLAB_OFFER_MAX) return { error: "Votre offre fait 280 caractères au maximum." };
  const looking_for = clean(input.looking_for, COLLAB_LOOKING_MAX + 50);
  if (looking_for.length > COLLAB_LOOKING_MAX) return { error: "Ce que vous recherchez fait 200 caractères au maximum." };
  const niche = input.niche ? nicheKey(input.niche) : null;
  if (input.niche && !niche) return { error: "Choisissez une niche dans la liste." };
  const countries = [...new Set((Array.isArray(input.countries) ? input.countries : []).filter((x) => OPP_COUNTRIES.includes(x)))];
  const link = normalizeCollabLink(input.link);
  if (link === null) return { error: "Lien invalide : un compte Instagram (@…) ou un site en https://." };
  if (enabled) {
    if (!offer_types.length) return { error: "Choisissez au moins un type d’offre." };
    if (!offer) return { error: "Décrivez votre offre en une ou deux phrases." };
    if (!niche) return { error: "Choisissez une niche dans la liste." };
    if (!countries.length) return { error: "Choisissez au moins un pays." };
  }
  return { value: { enabled, offer_types, offer, looking_for, niche: niche || "", countries, link } };
}
/** Les champs d'une offre, dans un ordre stable (pour comparer une version soumise à la version validée). */
const OFFER_FIELDS = ["offer_types", "offer", "looking_for", "niche", "countries", "link"];
export function offerSnapshot(p = {}) {
  return {
    offer_types: [...(p.offer_types || [])].sort(),
    offer: p.offer || "",
    looking_for: p.looking_for || "",
    niche: p.niche || "",
    countries: [...(p.countries || [])].sort(),
    link: p.link || "",
  };
}
const sameOffer = (a, b) => !!a && !!b && JSON.stringify(offerSnapshot(a)) === JSON.stringify(offerSnapshot(b));
/** Version soumise (colonnes vivantes) d'une ligne brand_collab_profiles. */
const submittedOf = (r) => ({
  offer_types: parse(r.offer_types).list || [],
  offer: r.offer || "",
  looking_for: r.looking_for || "",
  niche: r.niche || "",
  countries: parse(r.countries).list || [],
  link: r.link || "",
});
/** Dernière version validée par l'agence (null si aucune). */
const approvedOf = (r) => {
  const a = r?.approved_offer ? parse(r.approved_offer) : null;
  return a && typeof a.offer === "string" ? offerSnapshot(a) : null;
};
const profileOut = (r) =>
  r
    ? {
        enabled: !!Number(r.enabled),
        consent_at: r.consent_at || null,
        ...submittedOf(r),
        updated: r.updated,
        review_status: r.review_status || "pending",
        review_reason: r.review_reason || "",
        reviewed_at: r.reviewed_at || null,
        has_approved: !!approvedOf(r),
      }
    : {
        enabled: false,
        consent_at: null,
        offer_types: [],
        offer: "",
        looking_for: "",
        niche: "",
        countries: [],
        link: "",
        review_status: "none",
        review_reason: "",
        reviewed_at: null,
        has_approved: false,
      };
/** Ce que voient les créatrices : uniquement la version validée. */
const publicProfileOut = (r) => ({ enabled: true, ...approvedOf(r) });

/** Notification interne de l'agence (cloche de l'espace agence). */
export const AGENCY_NOTICE_SPACE = "__agency__";
async function agencyNotice(db, message) {
  await run(db, "INSERT INTO notifications VALUES(?,?,?,?,?)", uid(), AGENCY_NOTICE_SPACE, null, message, now());
}
/** E-mail interne à l'agence : adressé uniquement à AGENCY_OWNER_EMAIL, jamais à un client, donc hors du circuit
 *  d'approbation des textes clients (EMAIL_COPY_APPROVED_VERSION). Même expéditeur que les autres e-mails. Silencieux en cas d'échec. */
async function agencyEmail(env, subject, text, key) {
  try {
    const to = (env?.AGENCY_OWNER_EMAIL || "").trim();
    if (env?.EMAIL_DELIVERY_ENABLED !== "true" || !env.BREVO_API_KEY || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.BREVO_SENDER_EMAIL || "") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))
      return false;
    const url = env.STUDIO_URL ? new URL("/studio", env.STUDIO_URL).href : "";
    const res = await (env.BREVO_FETCH || fetch)("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: env.BREVO_SENDER_EMAIL, name: "Louvet & Partners" },
        to: [{ email: to }],
        subject,
        textContent: text + (url ? "\n\n" + url : ""),
        headers: { IdempotencyKey: key },
        tags: ["studio", "agency-internal"],
      }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function collabProfileSave(db, user, b, env = null) {
  const c = await brandSpace(db, user, clean(b.client_id || user.client_id, 100));
  if (typeof b.enabled !== "boolean") fail(400, "Indiquez si les créatrices peuvent vous proposer une collaboration.");
  const r = await first(db, "SELECT COUNT(*) AS n FROM audit WHERE client_id=? AND action='collab_profile_saved' AND created>?", c.id, ago(3600000));
  if (Number(r?.n || 0) >= 60) fail(429, "Beaucoup de modifications en peu de temps. Réessayez dans un moment.");
  const v = validateCollabProfile(b);
  if (v.error) fail(400, v.error);
  const p = v.value,
    t = now();
  const prev = await first(db, "SELECT * FROM brand_collab_profiles WHERE client_id=?", c.id);
  // Le consentement est daté à chaque activation (passage de « non » à « oui »).
  const consent = p.enabled ? (prev && Number(prev.enabled) ? prev.consent_at : t) : prev?.consent_at || null;
  // Relecture par l'agence : toute offre nouvelle ou modifiée attend sa validation ; la version déjà validée reste visible.
  const approved = approvedOf(prev);
  let status = prev?.review_status || "pending",
    reason = prev?.review_reason || "",
    notify = false;
  if (p.enabled) {
    if (sameOffer(p, approved)) {
      status = "approved";
      reason = "";
    } else {
      const unchangedPending = prev && status === "pending" && sameOffer(p, submittedOf(prev));
      if (!unchangedPending) notify = true;
      status = "pending";
      reason = "";
    }
  }
  await run(
    db,
    "INSERT INTO brand_collab_profiles(client_id,enabled,consent_at,offer_types,offer,looking_for,niche,countries,link,updated,review_status,review_reason) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(client_id) DO UPDATE SET enabled=excluded.enabled,consent_at=excluded.consent_at,offer_types=excluded.offer_types,offer=excluded.offer,looking_for=excluded.looking_for,niche=excluded.niche,countries=excluded.countries,link=excluded.link,updated=excluded.updated,review_status=excluded.review_status,review_reason=excluded.review_reason",
    c.id,
    p.enabled ? 1 : 0,
    consent,
    JSON.stringify({ list: p.offer_types }),
    p.offer,
    p.looking_for,
    p.niche,
    JSON.stringify({ list: p.countries }),
    p.link,
    t,
    status,
    reason,
  );
  await audit(db, user, c.id, "collab_profile_saved", c.id, { enabled: p.enabled, review: status });
  if (notify) {
    const name = brandName(c);
    await agencyNotice(db, `Nouvelle offre de collaboration à valider : ${name}`);
    await agencyEmail(
      env,
      `Offre de collaboration à valider : ${name}`,
      `${name} ${approved ? "a modifié" : "propose"} une offre de collaboration pour les créatrices du studio.\n\nOffre : ${p.offer}\n\nValidez-la dans l'espace agence › Reels & collaborations › Offres à valider.`,
      "collab-offer:" + c.id + ":" + t,
    );
  }
  return { ok: true, profile: profileOut(await first(db, "SELECT * FROM brand_collab_profiles WHERE client_id=?", c.id)) };
}

/** L'agence valide ou refuse la version soumise d'une offre. */
export async function collabOfferReview(db, user, b) {
  if (user.role !== "agency") fail(403, "Réservé à l’agence.");
  const row = await first(db, "SELECT * FROM brand_collab_profiles WHERE client_id=?", clean(b.client_id, 100));
  if (!row) fail(404, "Offre introuvable.");
  if (row.review_status !== "pending") fail(409, "Cette offre a déjà été traitée.");
  const t = now();
  if (b.decision === "approve") {
    const snap = offerSnapshot(submittedOf(row));
    const done = await run(
      db,
      "UPDATE brand_collab_profiles SET approved_offer=?,review_status='approved',review_reason='',reviewed_at=? WHERE client_id=? AND review_status='pending' AND updated=?",
      JSON.stringify(snap),
      t,
      row.client_id,
      row.updated,
    );
    if (!done.meta.changes) fail(409, "La marque vient de modifier son offre. Rechargez pour voir la nouvelle version.");
    await notice(db, row.client_id, "Votre offre de collaboration est validée : elle est visible par les créatrices.");
    await audit(db, user, row.client_id, "collab_offer_approved", row.client_id);
    return { ok: true };
  }
  if (b.decision !== "refuse") fail(400, "Réponse invalide.");
  const reason = clean(b.reason, 250).slice(0, 200);
  const done = await run(
    db,
    "UPDATE brand_collab_profiles SET review_status='refused',review_reason=?,reviewed_at=? WHERE client_id=? AND review_status='pending' AND updated=?",
    reason,
    t,
    row.client_id,
    row.updated,
  );
  if (!done.meta.changes) fail(409, "La marque vient de modifier son offre. Rechargez pour voir la nouvelle version.");
  await notice(db, row.client_id, "Votre offre de collaboration n’a pas été validée. Le motif est dans Mon compte › Collaborations : modifiez-la pour la renvoyer.");
  await audit(db, user, row.client_id, "collab_offer_refused", row.client_id);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Propositions des créatrices                                          */
/* ------------------------------------------------------------------ */
/** Marques visibles par les créatrices : profil activé, espace actif, pas une créatrice, pas en suppression. */
async function openBrands(db, exceptId = "") {
  const rows = await all(
    db,
    "SELECT p.*,c.name,c.config,c.active FROM brand_collab_profiles p JOIN clients c ON c.id=p.client_id WHERE p.enabled=1 AND p.approved_offer IS NOT NULL AND c.id<>? AND NOT EXISTS(SELECT 1 FROM client_deletions d WHERE d.client_id=c.id) ORDER BY p.updated DESC LIMIT 500",
    exceptId,
  );
  return rows.filter((r) => Number(r.active) !== 0 && !isCreator(parse(r.config)) && !!approvedOf(r));
}
export async function collabRequest(db, user, b) {
  const c = await creatorSpace(db, user, clean(b.client_id || user.client_id, 100));
  const brandId = clean(b.brand_client_id, 100);
  const brand = (await openBrands(db, c.id)).find((r) => r.client_id === brandId);
  if (!brand) fail(404, "Cette marque ne reçoit pas de propositions pour le moment.");
  const message = clean(b.message, COLLAB_MESSAGE_MAX + 100);
  if (!message) fail(400, "Écrivez quelques mots pour présenter votre idée.");
  if (message.length > COLLAB_MESSAGE_MAX) fail(400, "Votre message fait 600 caractères au maximum.");
  const instagram = normalizeHandle(b.instagram);
  if (!instagram) fail(400, "Indiquez votre compte Instagram.");
  const portfolio = normalizeSite(b.portfolio);
  if (portfolio === null) fail(400, "Le lien du portfolio doit commencer par https://.");
  const prev = await first(
    db,
    "SELECT status,updated FROM collab_requests WHERE client_id=? AND brand_client_id=? ORDER BY created DESC LIMIT 1",
    c.id,
    brand.client_id,
  );
  if (prev?.status === "open") fail(409, "Vous avez déjà une proposition en attente avec cette marque.");
  if (prev?.status === "accepted") fail(409, "Cette marque a déjà accepté votre proposition : son contact est dans vos propositions.");
  if (prev?.status === "declined" && prev.updated > ago(COLLAB_RETRY_DAYS * 86400000))
    fail(409, "La marque a déjà répondu. Vous pourrez la recontacter dans 30 jours.");
  const id = uid(),
    t = now();
  // Limite quotidienne et « une seule proposition ouverte » vérifiées dans l’insertion (atomique).
  const sent = await run(
    db,
    "INSERT INTO collab_requests(id,client_id,brand_client_id,user_id,message,instagram,portfolio,status,reply,contact_email,hidden,created,updated) SELECT ?,?,?,?,?,?,?,'open','','',0,?,? WHERE (SELECT COUNT(*) FROM collab_requests WHERE client_id=? AND created>?)<? AND NOT EXISTS(SELECT 1 FROM collab_requests WHERE client_id=? AND brand_client_id=? AND status IN ('open','accepted'))",
    id,
    c.id,
    brand.client_id,
    user.id,
    message,
    instagram,
    portfolio || "",
    t,
    t,
    c.id,
    ago(86400000),
    COLLAB_REQUESTS_PER_DAY,
    c.id,
    brand.client_id,
  );
  if (!sent.meta.changes) {
    const again = await first(
      db,
      "SELECT 1 AS x FROM collab_requests WHERE client_id=? AND brand_client_id=? AND status IN ('open','accepted')",
      c.id,
      brand.client_id,
    );
    if (again) fail(409, "Vous avez déjà une proposition en attente avec cette marque.");
    fail(429, "Vous avez envoyé 10 propositions aujourd’hui. Réessayez demain.");
  }
  await notice(db, brand.client_id, "Une créatrice vous propose une collaboration. Retrouvez-la dans Mon compte › Collaborations.");
  await audit(db, user, c.id, "collab_request_sent", id, { brand: brand.client_id });
  return { ok: true, id };
}
export async function collabRespond(db, user, b) {
  const c = await brandSpace(db, user, clean(b.client_id || user.client_id, 100));
  const req = await first(db, "SELECT * FROM collab_requests WHERE id=? AND brand_client_id=? AND hidden=0", clean(b.id, 100), c.id);
  if (!req) fail(404, "Proposition introuvable.");
  if (req.status !== "open") fail(409, "Vous avez déjà répondu à cette proposition.");
  const decision = b.decision === "accept" ? "accepted" : b.decision === "decline" ? "declined" : fail(400, "Réponse invalide.");
  const reply = clean(b.reply, COLLAB_REPLY_MAX + 100);
  if (reply.length > COLLAB_REPLY_MAX) fail(400, "Votre réponse fait 400 caractères au maximum.");
  let email = "";
  if (decision === "accepted") {
    email = normalizeEmail(b.contact_email);
    if (!email) fail(400, "Indiquez l’adresse e-mail à transmettre à la créatrice.");
  }
  const done = await run(
    db,
    "UPDATE collab_requests SET status=?,reply=?,contact_email=?,updated=? WHERE id=? AND status='open'",
    decision,
    reply,
    email,
    now(),
    req.id,
  );
  if (!done.meta.changes) fail(409, "Vous avez déjà répondu à cette proposition.");
  await notice(
    db,
    req.client_id,
    decision === "accepted"
      ? "Une marque est intéressée par votre proposition de collaboration : son contact est dans Opportunités."
      : "Une marque a répondu à votre proposition de collaboration.",
  );
  await audit(db, user, c.id, "collab_request_" + decision, req.id);
  return { ok: true };
}
export async function collabHide(db, user, b) {
  if (user.role !== "agency") fail(403, "Réservé à l’agence.");
  if (typeof b.hidden !== "boolean") fail(400, "Validation invalide.");
  const req = await first(db, "SELECT id FROM collab_requests WHERE id=?", clean(b.id, 100));
  if (!req) fail(404, "Proposition introuvable.");
  await run(db, "UPDATE collab_requests SET hidden=?,updated=? WHERE id=?", b.hidden ? 1 : 0, now(), req.id);
  await audit(db, user, null, "collab_request_hidden", req.id, { hidden: b.hidden });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* 2. Reels en collaboration avec @withjulielouvet                      */
/* ------------------------------------------------------------------ */
/** Lien Instagram d'un Reel ou d'une publication → { shortcode, url } ; null si ce n'en est pas un. */
export function normalizeReelUrl(v) {
  let s = clean(v, 500);
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (!/^(www\.|m\.)?instagram\.com$/i.test(u.hostname) || u.username || u.password) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  // Les liens de partage (/share/…) portent un jeton, pas le code du Reel : refusés.
  if (parts.some((p) => p.toLowerCase() === "share")) return null;
  // /reel/CODE, /reels/CODE, /p/CODE, et le format récent /compte/reel/CODE
  const i = parts.findIndex((p) => ["reel", "reels", "p"].includes(p.toLowerCase()));
  if (i < 0 || i > 1 || !parts[i + 1]) return null;
  const code = parts[i + 1];
  if (!/^[A-Za-z0-9_-]{5,40}$/.test(code)) return null;
  const kind = parts[i].toLowerCase() === "p" ? "p" : "reel";
  return { shortcode: code, url: `https://www.instagram.com/${kind}/${code}/` };
}
async function regionOf(db, cid) {
  const c = await first(db, "SELECT config FROM clients WHERE id=?", cid);
  return normRegion(parse(c?.config).country);
}
// Mois du plafond Reels : même fuseau que les livraisons du 3 (Monterrey), pas l'UTC.
const monthNow = () => monthInMonterrey();
const GRANTED = "('approved','crediting','credited')";

export async function reelClaim(db, user, b) {
  const c = await ownSpace(db, user, clean(b.client_id || user.client_id, 100));
  const reel = normalizeReelUrl(b.url);
  if (!reel) fail(400, "Collez le lien d’un Reel Instagram (instagram.com/reel/…).");
  const r = await first(db, "SELECT COUNT(*) AS n FROM reel_collab_claims WHERE client_id=? AND created>?", c.id, ago(86400000));
  if (Number(r?.n || 0) >= REEL_CLAIMS_PER_DAY) fail(429, "Beaucoup de Reels déclarés aujourd’hui. Réessayez demain.");
  const reward = reelCollabReward(normRegion(c.cfg.country)),
    t = now();
  const existing = await first(db, "SELECT id,client_id,status FROM reel_collab_claims WHERE shortcode=?", reel.shortcode);
  if (existing) {
    // Un Reel refusé (même déclaré par un autre espace) peut être redéclaré : un tiers ne peut pas le bloquer.
    if (existing.status !== "refused")
      fail(409, existing.client_id !== c.id ? "Ce Reel a déjà été déclaré." : "Vous avez déjà déclaré ce Reel.");
    const moved = await run(
      db,
      "UPDATE reel_collab_claims SET client_id=?,url=?,status='pending',reason='',amount_cents=?,currency=?,user_id=?,updated=? WHERE id=? AND status='refused'",
      c.id,
      reel.url,
      reward.cents,
      reward.currency,
      user.id,
      t,
      existing.id,
    );
    if (!moved.meta.changes) fail(409, "Ce Reel a déjà été déclaré.");
    await audit(db, user, c.id, "reel_claim_resubmitted", existing.id);
    return { ok: true, id: existing.id };
  }
  const id = uid();
  // Limite quotidienne vérifiée dans l’insertion (atomique) ; l’unicité du Reel est garantie par la base.
  const added = await run(
    db,
    "INSERT OR IGNORE INTO reel_collab_claims(id,client_id,user_id,shortcode,url,status,reason,amount_cents,currency,approved_month,stripe_reference,created,updated) SELECT ?,?,?,?,?,'pending','',?,?,NULL,NULL,?,? WHERE (SELECT COUNT(*) FROM reel_collab_claims WHERE client_id=? AND created>?)<?",
    id,
    c.id,
    user.id,
    reel.shortcode,
    reel.url,
    reward.cents,
    reward.currency,
    t,
    t,
    c.id,
    ago(86400000),
    REEL_CLAIMS_PER_DAY,
  );
  if (!added.meta.changes) {
    if (await first(db, "SELECT 1 AS x FROM reel_collab_claims WHERE shortcode=?", reel.shortcode))
      fail(409, "Ce Reel a déjà été déclaré.");
    fail(429, "Beaucoup de Reels déclarés aujourd’hui. Réessayez demain.");
  }
  await audit(db, user, c.id, "reel_claim_sent", id);
  return { ok: true, id };
}

export async function reelReview(env, user, b) {
  if (user.role !== "agency") fail(403, "Réservé à l’agence.");
  const db = env.DB;
  const claim = await first(db, "SELECT * FROM reel_collab_claims WHERE id=?", clean(b.id, 100));
  if (!claim) fail(404, "Reel introuvable.");
  if (claim.status !== "pending") fail(409, "Ce Reel a déjà été traité.");
  const t = now();
  if (b.decision === "refuse") {
    const reason = clean(b.reason, 250).slice(0, 200);
    await run(db, "UPDATE reel_collab_claims SET status='refused',reason=?,updated=? WHERE id=? AND status='pending'", reason, t, claim.id);
    await notice(db, claim.client_id, "Votre Reel n’a pas pu être validé. Le motif est indiqué dans Mon compte › Réductions.");
    await audit(db, user, claim.client_id, "reel_claim_refused", claim.id);
    return { ok: true };
  }
  if (b.decision !== "approve") fail(400, "Réponse invalide.");
  const month = monthNow();
  const n = await first(
    db,
    `SELECT COUNT(*) AS n FROM reel_collab_claims WHERE client_id=? AND approved_month=? AND status IN ${GRANTED}`,
    claim.client_id,
    month,
  );
  if (Number(n?.n || 0) >= reelCollabMaxPerMonth) fail(409, "Plafond mensuel atteint pour ce client.");
  const reward = await reelRewardFor(env, claim.client_id);
  // Le plafond mensuel est revérifié dans la mise à jour elle-même : deux validations simultanées ne le dépassent pas.
  const done = await run(
    db,
    `UPDATE reel_collab_claims SET status='approved',reason='',amount_cents=?,currency=?,approved_month=?,updated=? WHERE id=? AND status='pending' AND (SELECT COUNT(*) FROM reel_collab_claims WHERE client_id=? AND approved_month=? AND status IN ${GRANTED})<?`,
    reward.cents,
    reward.currency,
    month,
    t,
    claim.id,
    claim.client_id,
    month,
    reelCollabMaxPerMonth,
  );
  if (!done.meta.changes) {
    const again = await first(db, "SELECT status FROM reel_collab_claims WHERE id=?", claim.id);
    fail(409, again?.status !== "pending" ? "Ce Reel a déjà été traité." : "Plafond mensuel atteint pour ce client.");
  }
  await notice(db, claim.client_id, "Votre Reel avec @withjulielouvet est validé : la réduction sera déduite de votre prochaine facture.");
  await audit(db, user, claim.client_id, "reel_claim_approved", claim.id);
  const credit = await applyReelCredits(env, claim.client_id).catch(() => ({ credited: 0 }));
  return { ok: true, ...credit };
}

/** Applique les Reels validés sur le solde Stripe du client (déduits de sa prochaine facture). Sans client Stripe : en attente. */
/** Remise Reel dans la devise de l'abonnement du client (repli : son pays tant qu'il n'est pas abonné). */
async function reelRewardFor(env, cid) {
  const region = await creditRegionFor(env.DB, env, cid);
  return region ? reelCollabReward(region) : reelCollabReward(await regionOf(env.DB, cid));
}
export async function applyReelCredits(env, cid) {
  const b = await first(env.DB, "SELECT customer_id FROM billing_accounts WHERE client_id=?", cid);
  if (!b?.customer_id || !stripeMode(env)) return { credited: 0, waiting: true };
  if (!(await creditRegionFor(env.DB, env, cid))) {
    await run(
      env.DB,
      "UPDATE reel_collab_claims SET credit_error=?,updated=? WHERE client_id=? AND status='approved'",
      "Devise de l’abonnement sans montant prévu : à créditer à la main dans Stripe.",
      now(),
      cid,
    );
    return { credited: 0, error: "currency" };
  }
  const reward = await reelRewardFor(env, cid);
  let credited = 0;
  for (const r of await all(env.DB, "SELECT * FROM reel_collab_claims WHERE client_id=? AND status='approved'", cid)) {
    const lock = await run(env.DB, "UPDATE reel_collab_claims SET status='crediting',updated=? WHERE id=? AND status='approved'", now(), r.id);
    if (!lock.meta.changes) continue;
    // Le crédit suit la devise de l'abonnement Stripe du client (pas seulement son pays).
    if (r.currency !== reward.currency) {
      await run(env.DB, "UPDATE reel_collab_claims SET amount_cents=?,currency=? WHERE id=?", reward.cents, reward.currency, r.id);
      r.amount_cents = reward.cents;
      r.currency = reward.currency;
    }
    try {
      const txn = await stripe(
        env,
        "POST",
        `/customers/${encodeURIComponent(b.customer_id)}/balance_transactions`,
        {
          amount: String(-Math.abs(r.amount_cents)),
          currency: r.currency,
          description: `Reel avec @${REEL_COLLAB_ACCOUNT}`,
          "metadata[studio_reel_claim_id]": r.id,
        },
        "studio-reel:" + r.id,
      );
      await run(env.DB, "UPDATE reel_collab_claims SET status='credited',stripe_reference=?,credit_error=NULL,updated=? WHERE id=?", txn.id || null, now(), r.id);
      credited++;
    } catch (e) {
      // La remise reste due (nouvel essai au prochain paiement) ; l'erreur est visible par l'agence.
      await run(
        env.DB,
        "UPDATE reel_collab_claims SET status='approved',credit_error=?,updated=? WHERE id=?",
        String(e?.message || "Stripe a refusé le crédit.").slice(0, 300),
        now(),
        r.id,
      );
    }
  }
  return { credited };
}

/* ------------------------------------------------------------------ */
/* État exposé au studio                                               */
/* ------------------------------------------------------------------ */
export async function collabState(db, user, selected) {
  if (user.role === "agency") {
    const reqs = await all(
      db,
      "SELECT r.id,r.client_id,r.brand_client_id,r.message,r.instagram,r.portfolio,r.status,r.hidden,r.created,r.updated,c.name AS creator_client,c.config AS creator_config,b.name AS brand_client,b.config AS brand_config FROM collab_requests r JOIN clients c ON c.id=r.client_id JOIN clients b ON b.id=r.brand_client_id ORDER BY r.created DESC LIMIT 300",
    );
    const claims = await all(
      db,
      "SELECT r.id,r.client_id,r.url,r.status,r.reason,r.amount_cents,r.currency,r.approved_month,r.credit_error,r.created,r.updated,c.name AS client_name FROM reel_collab_claims r JOIN clients c ON c.id=r.client_id ORDER BY CASE WHEN r.status='pending' THEN 0 ELSE 1 END, r.created DESC LIMIT 300",
    );
    const openCount = await first(db, "SELECT COUNT(*) AS n FROM brand_collab_profiles WHERE enabled=1 AND approved_offer IS NOT NULL");
    const pending = await all(
      db,
      "SELECT p.*,c.name,c.config FROM brand_collab_profiles p JOIN clients c ON c.id=p.client_id WHERE p.enabled=1 AND p.review_status='pending' AND NOT EXISTS(SELECT 1 FROM client_deletions d WHERE d.client_id=c.id) ORDER BY p.updated LIMIT 200",
    );
    return {
      collabOverview: reqs.map(({ creator_config, brand_config, ...r }) => ({
        ...r,
        hidden: !!Number(r.hidden),
        creator_name: creatorInfo({ name: r.creator_client, config: creator_config }).name,
        brand_name: brandName({ name: r.brand_client, config: brand_config }),
      })),
      collabOpenBrands: Number(openCount?.n || 0),
      collabPendingOffers: pending.map((r) => ({
        client_id: r.client_id,
        brand_name: brandName(r),
        submitted: offerSnapshot(submittedOf(r)),
        approved: approvedOf(r),
        consent_at: r.consent_at,
        updated: r.updated,
      })),
      reelQueue: claims,
      reelCap: reelCollabMaxPerMonth,
    };
  }
  if (user.role !== "client" || !selected || selected.id !== user.client_id) return {};
  const cfg = parse(selected.config);
  const claims = await all(
    db,
    "SELECT id,url,status,reason,amount_cents,currency,approved_month,created FROM reel_collab_claims WHERE client_id=? ORDER BY created DESC LIMIT 100",
    selected.id,
  );
  const reward = reelCollabReward(normRegion(cfg.country));
  const reel = {
    reelCollab: {
      account: REEL_COLLAB_ACCOUNT,
      reward_cents: reward.cents,
      currency: reward.currency,
      cap: reelCollabMaxPerMonth,
      month_count: claims.filter((x) => ["approved", "crediting", "credited"].includes(x.status) && x.approved_month === monthNow()).length,
      claims: claims.map((x) => ({ ...x, status: x.status === "crediting" ? "approved" : x.status })),
    },
  };
  if (isCreator(cfg)) {
    const brands = await openBrands(db, selected.id);
    const sent = await all(
      db,
      "SELECT r.id,r.brand_client_id,r.message,r.status,r.reply,r.contact_email,r.created,r.updated,b.name AS brand_client,b.config AS brand_config FROM collab_requests r JOIN clients b ON b.id=r.brand_client_id WHERE r.client_id=? ORDER BY r.created DESC LIMIT 200",
      selected.id,
    );
    return {
      ...reel,
      collabBrands: brands.map((r) => ({
        brand_client_id: r.client_id,
        name: brandName(r),
        ...publicProfileOut(r),
      })),
      collabSent: sent.map(({ brand_config, brand_client, ...r }) => ({
        ...r,
        brand_name: brandName({ name: brand_client, config: brand_config }),
        reply: r.status === "open" ? "" : r.reply,
        contact_email: r.status === "accepted" ? r.contact_email : "",
      })),
    };
  }
  const profile = await first(db, "SELECT * FROM brand_collab_profiles WHERE client_id=?", selected.id);
  const received = await all(
    db,
    "SELECT r.id,r.client_id,r.message,r.instagram,r.portfolio,r.status,r.reply,r.contact_email,r.created,r.updated,c.name AS creator_client,c.config AS creator_config FROM collab_requests r JOIN clients c ON c.id=r.client_id WHERE r.brand_client_id=? AND r.hidden=0 ORDER BY CASE WHEN r.status='open' THEN 0 ELSE 1 END, r.created DESC LIMIT 200",
    selected.id,
  );
  return {
    ...reel,
    collabProfile: profileOut(profile),
    collabReceived: received.map(({ creator_config, creator_client, client_id, ...r }) => {
      const info = creatorInfo({ name: creator_client, config: creator_config });
      return { ...r, creator_name: info.name, creator_topic: info.topic };
    }),
  };
}
