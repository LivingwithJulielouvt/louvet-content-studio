import { normalizeIntake } from "./client-intake.mjs";
import { mailReadiness, brevo } from "./studio-mail.mjs";
import { MAIL_COPY_VERSION, studioEmail } from "./studio-email-templates.mjs";
const q = (db, sql, ...args) => db.prepare(sql).bind(...args),
  one = (db, sql, ...args) => q(db, sql, ...args).first();
const fail = (status, message) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};
const digest = async (s) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
const cookieName = "louvet_subscription_nonce";
const json = (data, headers = {}) =>
  new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
const strictText = (v, max) =>
  typeof v === "string" && v.trim().length <= max && !/[\x00-\x1f\x7f]/.test(v) ? v.trim() : "";
export function subnetOf(forwarded) {
  const raw = String(forwarded || "").split(",")[0].trim();
  if (!raw) return "unknown-edge";
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(raw);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  if (raw.includes(":")) return raw.toLowerCase().split(":").slice(0, 3).join(":") + "::/48";
  return raw.slice(0, 64);
}
/** Turnstile (facultatif) : actif seulement si TURNSTILE_SECRET_KEY est défini. */
export async function verifyTurnstile(env, token, forwarded) {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
    const ip = String(forwarded || "").split(",")[0].trim();
    if (ip) body.set("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    const j = await r.json();
    return j?.success === true;
  } catch {
    return false;
  }
}
function cookie(req) {
  return (
    req.headers
      .get("cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1) || ""
  );
}
export async function publicSubscriptionRequest(req, env, user) {
  // Le formulaire public n’exige pas de compte Supabase. La preuve est le nonce HttpOnly.
  const now = new Date().toISOString(),
    past = new Date(Date.now() - 86400000).toISOString(),
    hour = new Date(Date.now() - 3600000).toISOString(),
    fresh = new Date(Date.now() - 7200000).toISOString();
  // CF-Connecting-IP is supplied by the edge. Never accept arbitrary forwarded IPs.
  // Limites par sous-réseau (/24 en IPv4, /48 en IPv6) plutôt que par adresse exacte, et plus de plafond global
  // bas : quelques dizaines de demandes indésirables ne doivent pas bloquer le formulaire pour tout le monde.
  const ip = await digest("louvet-public:" + now.slice(0, 10) + ":" + subnetOf(req.headers.get("x-forwarded-for")));
  const c = cookie(req),
    token = /^[a-f0-9]{64}$/.test(c) ? c : "",
    hash = token ? await digest(token) : null,
    visitor = "public";
  if (req.method === "GET") {
    if (req.headers.get("sec-fetch-site") === "cross-site") fail(403, "Ouvrez le formulaire depuis ce site.");
    if (
      hash &&
      (await one(
        env.DB,
        "SELECT token_hash FROM public_subscription_nonces WHERE token_hash=? AND created>? AND claimed_request IS NULL AND identity_id=?",
        hash,
        fresh,
        visitor,
      ))
    )
      return json({ nonce: token });
    const next = [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, "0")).join("");
    const created = await q(
      env.DB,
      `INSERT INTO public_subscription_nonces(token_hash,ip_hash,created,identity_id) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM public_subscription_nonces WHERE created>?)<20000 AND (SELECT COUNT(*) FROM public_subscription_nonces WHERE ip_hash=? AND created>?)<30`,
      await digest(next),
      ip,
      now,
      visitor,
      past,
      ip,
      hour,
    ).run();
    if (!created.meta.changes) fail(429, "Trop de tentatives. Réessayez plus tard.");
    await q(env.DB, "DELETE FROM public_subscription_nonces WHERE created<?", past).run();
    return json(
      { nonce: next },
      {
        "Set-Cookie": `${cookieName}=${next}; Path=/api/studio/subscription-request; HttpOnly; ${new URL(req.url).protocol === "https:" ? "Secure; " : ""}SameSite=Strict; Max-Age=7200`,
      },
    );
  }
  if (req.method !== "POST") fail(405, "Méthode non autorisée.");
  if (
    req.headers.get("origin") !== new URL(req.url).origin ||
    req.headers.get("X-Studio-Request") !== "1" ||
    !req.headers.get("Content-Type")?.startsWith("application/json")
  )
    fail(403, "Requête non autorisée.");
  if (Number(req.headers.get("content-length") || 0) > 40000) fail(413, "Formulaire trop volumineux.");
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > 40000) fail(413, "Formulaire trop volumineux.");
  let b;
  try {
    b = JSON.parse(raw);
  } catch {
    fail(400, "Formulaire invalide.");
  }
  if (!b || Array.isArray(b) || !hash || b.nonce !== token) fail(403, "Actualisez le formulaire avant de l’envoyer.");
  if (b.website) fail(400, "Formulaire invalide.");
  if (!(await verifyTurnstile(env, b.turnstile, req.headers.get("x-forwarded-for"))))
    fail(403, "Vérification anti-robot échouée. Réessayez.");
  if (!/^[a-f0-9-]{36}$/.test(b.request_key || "")) fail(400, "Actualisez le formulaire avant de l’envoyer.");
  const n = await one(
    env.DB,
    "SELECT * FROM public_subscription_nonces WHERE token_hash=? AND created>? AND identity_id=?",
    hash,
    fresh,
    visitor,
  );
  if (!n) fail(403, "Le formulaire a expiré. Rechargez la page ; vous pouvez garder un brouillon sur cet appareil.");
  if (n.claimed_request) {
    const previous = await one(
      env.DB,
      "SELECT request_key,mail_status FROM public_subscription_requests WHERE id=?",
      n.claimed_request,
    );
    if (previous?.request_key === b.request_key) return json({ ok: true, mail: previous.mail_status });
    fail(409, "Cette demande a déjà été transmise.");
  }
  const firstName = strictText(b.first_name, 80),
    name = strictText(b.name, 120),
    email = strictText(b.email, 254).toLowerCase();
  // Adresse libre ; elle sera vérifiée lors de la première connexion OTP.
  if (
    !firstName ||
    !name ||
    !/^([^\s@]+)@([^\s@]+)\.([^\s@]+)$/.test(email) ||
    !["brand", "creator"].includes(b.workspaceType) ||
    !["fr", "es", "en"].includes(b.language) ||
    b.consent !== true
  )
    fail(
      400,
      "Vérifiez votre prénom, votre adresse e-mail et le consentement. / Revisa tus datos y el consentimiento. / Please check your details and consent.",
    );
  // Code de parrainage : seulement vérifié ici (lecture), puis conservé dans la demande. Il n’est rattaché
  // qu’après la connexion OTP de cette adresse (register / join), pour qu’un tiers ne puisse pas le détourner.
  let ref = null;
  if (b.referral_code) {
    const { normalizeCode } = await import("./referrals.mjs");
    ref = normalizeCode(b.referral_code);
    if (!ref || !(await one(env.DB, "SELECT 1 AS x FROM referral_codes WHERE code=?", ref)))
      fail(400, "Ce code de parrainage n’existe pas. Vérifiez-le ou laissez le champ vide.");
  }
  // Formulaire court (depuis octobre 2026) : aucune réponse au questionnaire n'est demandée sur le site public ;
  // le questionnaire complet est rempli dans le studio après validation. Si des réponses sont envoyées, elles
  // doivent être complètes, comme avant.
  let answers = {};
  const hasAnswers = b.answers && typeof b.answers === "object" && Object.keys(b.answers).length > 0;
  if (hasAnswers)
    try {
      answers = normalizeIntake(b.answers, true);
    } catch (e) {
      fail(400, e.message);
    }
  const instagram = strictText(b.instagram ?? "", 200),
    note = strictText(b.message ?? "", 1000);
  if (instagram) answers = { ...answers, _instagram: instagram };
  if (note) answers = { ...answers, _message: note };
  // Pays choisi dans le formulaire (France, Mexique, États-Unis) : détermine le tarif du studio.
  if (["FR", "MX", "US"].includes(b.country)) answers = { ...answers, _country: b.country };
  if (ref) answers = { ...answers, _ref: ref };
  const id = crypto.randomUUID();
  const results = await env.DB.batch([
    q(
      env.DB,
      `INSERT OR IGNORE INTO public_subscription_requests(id,request_key,first_name,email,name,workspace_type,language,answers,consent_at,created,ip_hash,copy_version,identity_id) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM public_subscription_nonces WHERE token_hash=? AND claimed_request IS NULL AND created>?) AND (SELECT COUNT(*) FROM public_subscription_requests WHERE created>?)<2000 AND (SELECT COUNT(*) FROM public_subscription_requests WHERE ip_hash=? AND created>?)<5 AND (SELECT COUNT(*) FROM public_subscription_requests WHERE email=? AND created>?)<2`,
      id,
      b.request_key,
      firstName,
      email,
      name,
      b.workspaceType,
      b.language,
      JSON.stringify(answers),
      now,
      now,
      ip,
      MAIL_COPY_VERSION,
      visitor,
      hash,
      fresh,
      past,
      ip,
      hour,
      email,
      past,
    ),
    q(
      env.DB,
      "UPDATE public_subscription_nonces SET claimed_request=? WHERE token_hash=? AND claimed_request IS NULL AND EXISTS(SELECT 1 FROM public_subscription_requests WHERE id=?)",
      id,
      hash,
      id,
    ),
  ]);
  if (!results[0].meta.changes)
    fail(429, "La demande ne peut pas être transmise maintenant. Réessayez plus tard. / Inténtalo más tarde.");
  await sendPublicReceipt(env, id);
  const row = await one(env.DB, "SELECT mail_status FROM public_subscription_requests WHERE id=?", id);
  return json({ ok: true, mail: row.mail_status });
}
export async function sendPublicReceipt(env, id) {
  if (!mailReadiness(env).deliveryEnabled) return;
  const row = await one(
    env.DB,
    "SELECT * FROM public_subscription_requests WHERE id=? AND copy_version=? AND mail_status='held'",
    id,
    MAIL_COPY_VERSION,
  );
  if (!row) return;
  // Only the newly submitted request is released; enabling Brevo never sends a backlog.
  if (Date.now() - Date.parse(row.created) > 60000) return;
  const claim = await q(
    env.DB,
    "UPDATE public_subscription_requests SET mail_status='sending' WHERE id=? AND mail_status='held'",
    id,
  ).run();
  if (!claim.meta.changes) return;
  try {
    // Adresse non encore vérifiée : le prénom n’est repris que s’il ressemble à un prénom (pas de phrase libre).
    const safeName = /^[\p{L}][\p{L}' .-]{0,29}$/u.test(row.first_name || "")
      ? row.first_name
      : row.language === "es"
        ? "y bienvenida"
        : row.language === "en"
          ? "and welcome"
          : "et bienvenue";
    const mail = studioEmail("received", row.language, {
      firstName: safeName,
      studioUrl: new URL("/studio", env.STUDIO_URL).href,
    });
    const result = await brevo(env, "POST", "/smtp/email", {
      sender: { email: env.BREVO_SENDER_EMAIL, name: "Louvet & Partners" },
      to: [{ email: row.email }],
      subject: mail.subject,
      htmlContent: mail.html,
      textContent: mail.text,
      headers: { IdempotencyKey: "public-received:" + id },
      tags: ["studio", "received", MAIL_COPY_VERSION],
    });
    if (!result.messageId) {
      const e = new Error("Envoi à vérifier dans Brevo.");
      e.uncertain = true;
      throw e;
    }
    await q(
      env.DB,
      "UPDATE public_subscription_requests SET mail_status='sent',provider_id=? WHERE id=?",
      result.messageId,
      id,
    ).run();
  } catch (e) {
    await q(
      env.DB,
      "UPDATE public_subscription_requests SET mail_status=?,mail_error=? WHERE id=?",
      e.uncertain ? "uncertain" : "failed",
      e.message,
      id,
    ).run();
  }
}
export async function publicRequestsState(env, user) {
  if (user.role !== "agency") fail(403, "Accès agence uniquement.");
  return (
    await q(
      env.DB,
      "SELECT id,first_name,email,name,workspace_type,language,answers,status,created,mail_status,mail_error FROM public_subscription_requests ORDER BY created DESC LIMIT 200",
    ).all()
  ).results.map((r) => ({ ...r, answers: JSON.parse(r.answers) }));
}
