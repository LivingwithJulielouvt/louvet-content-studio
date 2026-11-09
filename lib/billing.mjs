import { PRICING, REGIONS, normRegion } from "./pricing.mjs";
// Stripe is called server-side only. Existing workspaces remain exempt until the
// agency explicitly enables billing for that workspace. No card data is stored.
const q = (db, sql, ...a) => db.prepare(sql).bind(...a);
const first = (db, sql, ...a) => q(db, sql, ...a).first();
const all = async (db, sql, ...a) => (await q(db, sql, ...a).all()).results;
const run = (db, sql, ...a) => q(db, sql, ...a).run();
const time = (env) => Math.floor((env.BILLING_NOW?.() ?? Date.now()) / 1000);
const stamp = () => new Date().toISOString();
const objectId = (o) => (typeof o === "string" ? o : o?.id);
const validId = (s, prefix) => typeof s === "string" && new RegExp("^" + prefix + "_[a-zA-Z0-9]+$").test(s);
const parse = (s) => JSON.parse(s);
function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
const admin = (u) => {
  if (u.role !== "agency") fail(403, "Cette action est réservée à l’agence.");
};
async function client(env, u, cid) {
  if (u.role !== "agency" && u.client_id !== cid) fail(403, "Cet abonnement ne vous est pas accessible.");
  const c = await first(env.DB, "SELECT * FROM clients WHERE id=?", cid);
  if (!c) fail(404, "Espace introuvable.");
  return c;
}
export const stripeMode = (env) =>
  /^([sr]k)_live_/.test(env.STRIPE_SECRET_KEY || "")
    ? "live"
    : /^([sr]k)_test_/.test(env.STRIPE_SECRET_KEY || "")
      ? "test"
      : null;
// Les tarifs « catalogue » du studio, un par pays (voir lib/pricing.mjs pour les montants affichés).
function regionalOffers(env) {
  const out = {};
  for (const r of REGIONS) {
    // Un identifiant par pays, sans secours : STRIPE_DEFAULT_PRICE_ID ne remplace plus le tarif mexicain
    // (il pointait souvent vers l'ancien prix 89 USD).
    const pid = env["STRIPE_PRICE_ID_" + r] || "";
    if (pid)
      out[r] = {
        priceId: pid,
        amount: Math.round(PRICING[r].studio * 100),
        currency: PRICING[r].currency.toLowerCase(),
        name: "Louvet Content Studio · " + PRICING[r].label.fr,
        region: r,
        interval: "month",
      };
  }
  return out;
}
// Abonnement annuel (2 mois offerts), facultatif : STRIPE_PRICE_ID_FR_YEAR / _MX_YEAR / _US_YEAR.
function yearlyOffers(env) {
  const out = {};
  for (const r of REGIONS) {
    const pid = env["STRIPE_PRICE_ID_" + r + "_YEAR"] || "";
    if (pid)
      out[r] = {
        priceId: pid,
        amount: Math.round(PRICING[r].studioYear * 100),
        currency: PRICING[r].currency.toLowerCase(),
        name: "Louvet Content Studio · " + PRICING[r].label.fr + " · annuel",
        region: r,
        interval: "year",
      };
  }
  return out;
}
const catalogue = (env) => [...Object.values(regionalOffers(env)), ...Object.values(yearlyOffers(env))];
// Pays du client (réglé par l'agence dans « Marque & accès ») → tarif Stripe de ce pays.
const regionOf = (c) => {
  try {
    return normRegion(JSON.parse(c?.config || "{}").country);
  } catch {
    return normRegion(null);
  }
};
const regionalPriceFor = (env, c) => regionalOffers(env)[regionOf(c)]?.priceId || null;
const yearlyPriceFor = (env, c) => yearlyOffers(env)[regionOf(c)]?.priceId || null;
const standardPrice = (env, pid) =>
  !!pid && (pid === env.STRIPE_DEFAULT_PRICE_ID || catalogue(env).some((o) => o.priceId === pid));
const offerForPrice = (env, pid, b) => {
  if (!pid) return null;
  const regional = catalogue(env).find((o) => o.priceId === pid);
  if (regional) return regional;
  // Tarif personnalisé : montant et devise lus chez Stripe et mémorisés à l'enregistrement.
  if (b?.price_id === pid && Number.isInteger(b.price_amount) && b.price_currency)
    return { priceId: pid, amount: b.price_amount, currency: b.price_currency, name: "Louvet Content Studio · tarif personnalisé", region: null };
  return pid === env.STRIPE_DEFAULT_PRICE_ID ? billingReadiness(env).offer : null;
};
// Région dont ce price_id est le tarif catalogue (null pour un tarif personnalisé).
const regionOfPrice = (env, pid) => catalogue(env).find((o) => o.priceId === pid)?.region || null;
const intervalOfPrice = (env, pid) => catalogue(env).find((o) => o.priceId === pid)?.interval || null;
/**
 * Pays dont la devise est celle de l'abonnement du client : les remises (parrainage, Reels) doivent être
 * créditées dans la devise de l'abonnement Stripe, sinon Stripe les refuse ou ne les déduit jamais.
 * Sans abonnement connu : le pays du client. Devise sans équivalent dans PRICING → null (à signaler).
 */
export async function creditRegionFor(db, env, cid) {
  const b = await first(db, "SELECT * FROM billing_accounts WHERE client_id=?", cid).catch(() => null),
    c = await first(db, "SELECT config FROM clients WHERE id=?", cid);
  const cur =
    (b?.price_currency && String(b.price_currency).toLowerCase()) ||
    (env && b?.price_id && regionOfPrice(env, b.price_id)
      ? PRICING[regionOfPrice(env, b.price_id)].currency.toLowerCase()
      : null);
  if (!cur) return regionOf(c);
  return REGIONS.find((r) => PRICING[r].currency.toLowerCase() === cur) || null;
}
export function billingReadiness(env) {
  return {
    configured: !!stripeMode(env) && !!env.STUDIO_URL,
    mode: stripeMode(env),
    webhookConfigured: !!env.STRIPE_WEBHOOK_SECRET,
    productionReady:
      !!stripeMode(env) &&
      !!env.STUDIO_URL &&
      !!env.STRIPE_WEBHOOK_SECRET &&
      env.STRIPE_WEBHOOK_INGRESS_READY === "true",
    taxReady: env.STRIPE_SOURCE_AUTOMATIC_TAX !== "true" || env.STRIPE_TAX_REGISTRATIONS_VERIFIED === "true",
    defaultPriceId: env.STRIPE_DEFAULT_PRICE_ID || null,
    regionalOffers: regionalOffers(env),
    yearlyOffers: yearlyOffers(env),
    sourcePaymentLink: env.STRIPE_SOURCE_PAYMENT_LINK || null,
    offer: env.STRIPE_DEFAULT_PRICE_ID
      ? {
          priceId: env.STRIPE_DEFAULT_PRICE_ID,
          amount: env.STRIPE_DEFAULT_AMOUNT ? Number(env.STRIPE_DEFAULT_AMOUNT) : null,
          currency: env.STRIPE_DEFAULT_CURRENCY || null,
          name: "Louvet Content Studio · abonnement mensuel",
        }
      : null,
    taxWarning: env.STRIPE_SOURCE_AUTOMATIC_TAX === "true",
    apiVersion: "2026-08-26.dahlia",
  };
}
function requireLiveSetup(env, pid) {
  if (stripeMode(env) !== "live") return;
  if (!billingReadiness(env).productionReady)
    fail(
      503,
      "Avant l’activation réelle, configurez la réception des notifications Stripe et sa signature. Le site privé doit disposer d’une entrée accessible à Stripe.",
    );
  if (standardPrice(env, pid) && !billingReadiness(env).taxReady)
    fail(
      503,
      "Le lien fourni utilise Stripe Tax. Vérifiez les immatriculations fiscales actives avant d’activer ce tarif.",
    );
}
export async function stripe(env, method, path, body, key) {
  if (env.BETA_MODE === "true") fail(409, "Aucun paiement pendant la bêta.");
  if (!stripeMode(env)) fail(503, "La connexion Stripe doit être configurée par l’agence.");
  let r;
  try {
    r = await (env.STRIPE_FETCH || fetch)("https://api.stripe.com/v1" + path, {
      method,
      headers: {
        Authorization: "Bearer " + env.STRIPE_SECRET_KEY,
        "Stripe-Version": "2026-08-26.dahlia",
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      ...(body ? { body: new URLSearchParams(body).toString() } : {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    fail(503, "Stripe ne répond pas. Réessayez plus tard ou contactez l’agence.");
  }
  let data;
  try {
    data = await r.json();
  } catch {
    fail(503, "La réponse Stripe n’a pas pu être vérifiée.");
  }
  if (!r.ok)
    fail(
      r.status >= 500 ? 503 : 400,
      `Stripe a refusé cette opération (HTTP ${r.status}). Vérifiez la configuration dans l’espace agence.`,
    );
  return data;
}
function origin(env) {
  let u;
  try {
    u = new URL(env.STUDIO_URL);
  } catch {
    fail(503, "L’adresse du studio doit être configurée par l’agence.");
  }
  if (u.protocol !== "https:") fail(503, "L’adresse du studio doit utiliser HTTPS.");
  return u.origin;
}
async function row(env, cid) {
  return first(env.DB, "SELECT * FROM billing_accounts WHERE client_id=?", cid);
}
async function ensureRow(env, cid) {
  await run(env.DB, "INSERT OR IGNORE INTO billing_accounts(client_id,updated) VALUES(?,?)", cid, stamp());
  return row(env, cid);
}
async function audit(env, u, cid, action, detail = {}) {
  await run(
    env.DB,
    "INSERT INTO audit VALUES(?,?,?,?,?,?,?)",
    crypto.randomUUID(),
    cid,
    u.id,
    action,
    cid,
    JSON.stringify(detail),
    stamp(),
  );
}
function modeMatches(env, b) {
  if (b.stripe_mode && b.stripe_mode !== stripeMode(env))
    fail(
      409,
      "Cet espace utilise un autre environnement Stripe. Utilisez un espace distinct pour les essais et les paiements réels.",
    );
}
export function billingAccess(b, now) {
  if (!b?.enabled)
    return { allowed: true, state: "exempt", message: "Cet espace est géré directement par votre agence." };
  if (b.override_until > now)
    return {
      allowed: true,
      state: "exception",
      until: b.override_until,
      message:
        "Votre agence a accordé un délai jusqu’au " +
        new Date(b.override_until * 1000).toLocaleDateString("fr-FR", { timeZone: "America/Monterrey" }) +
        ".",
    };
  if (b.sync_error)
    return {
      allowed: false,
      state: "verification",
      message:
        "Nous ne pouvons pas vérifier votre abonnement pour le moment. Vos contenus sont conservés. Réessayez ou contactez votre agence.",
    };
  if (["canceled", "unpaid", "paused", "incomplete_expired"].includes(b.status))
    return {
      allowed: false,
      state: "suspended",
      message: "Votre abonnement ne permet plus de créer de nouveaux contenus. Vos contenus existants sont conservés.",
    };
  if (b.paid_until > now && b.status === "active")
    return { allowed: true, state: "paid", until: b.paid_until, message: "Votre abonnement est à jour." };
  // Grace is for an existing paying subscriber, never for the first unpaid invoice.
  const deadline =
    b.delinquent_since != null ? b.delinquent_since + b.grace_days * 86400 : b.paid_until + b.grace_days * 86400;
  if (["active", "past_due"].includes(b.status) && b.paid_until > 0 && deadline > now)
    return {
      allowed: true,
      state: "grace",
      until: deadline,
      message:
        "Votre renouvellement est en attente. Merci de régulariser votre paiement avant le " +
        new Date(deadline * 1000).toLocaleDateString("fr-FR", { timeZone: "America/Monterrey" }) +
        ".",
    };
  return {
    allowed: false,
    state: b.paid_until ? "suspended" : "payment_required",
    message: b.paid_until
      ? "Votre paiement n’a pas pu être confirmé. Vos contenus sont conservés. Pour reprendre vos créations, veuillez mettre à jour votre paiement."
      : "Votre studio est prêt. Réglez votre abonnement pour commencer à créer.",
  };
}
async function validatePrice(env, pid) {
  if (!validId(pid, "price")) fail(400, "Indiquez un identifiant de tarif Stripe commençant par price_.");
  const p = await stripe(env, "GET", "/prices/" + encodeURIComponent(pid));
  // Un tarif catalogue doit correspondre exactement au montant affiché (89 EUR, 1 800 MXN, 120 USD).
  const region = regionOfPrice(env, pid),
    yearly = intervalOfPrice(env, pid) === "year";
  if (
    region &&
    (String(p.currency || "").toLowerCase() !== PRICING[region].currency.toLowerCase() ||
      p.unit_amount !== Math.round((yearly ? PRICING[region].studioYear : PRICING[region].studio) * 100))
  )
    fail(
      400,
      yearly
        ? "Le tarif annuel Stripe de ce pays ne correspond pas au prix affiché (890 EUR, 18000 MXN ou 1200 USD par an). Vérifiez STRIPE_PRICE_ID_FR_YEAR, _MX_YEAR et _US_YEAR."
        : "Le tarif Stripe de ce pays ne correspond pas au prix affiché (89 EUR, 1800 MXN ou 120 USD). Vérifiez STRIPE_PRICE_ID_FR, _MX et _US.",
    );
  if (
    !p.active ||
    p.type !== "recurring" ||
    p.recurring?.interval !== (yearly ? "year" : "month") ||
    p.recurring?.interval_count !== 1 ||
    p.recurring?.usage_type !== "licensed" ||
    !Number.isInteger(p.unit_amount) ||
    p.unit_amount <= 0 ||
    p.transform_quantity
  )
    fail(400, yearly ? "Choisissez un tarif annuel fixe, actif et supérieur à zéro." : "Choisissez un tarif mensuel fixe, actif et supérieur à zéro.");
  if (p.livemode !== (stripeMode(env) === "live")) fail(400, "Ce tarif utilise un autre environnement Stripe.");
  return p;
}
async function subscriptions(env, b) {
  const list = await stripe(
    env,
    "GET",
    "/subscriptions?customer=" + encodeURIComponent(b.customer_id) + "&status=all&limit=100",
  );
  if (list.has_more) fail(409, "Trop d’abonnements liés à ce client. Vérification manuelle nécessaire.");
  const active = (list.data || []).filter((s) => !["canceled", "incomplete_expired"].includes(s.status));
  if (active.length > 1)
    fail(409, "Plusieurs abonnements sont liés à ce client Stripe. L’agence doit vérifier la liaison.");
  return active[0] || (list.data || []).find((s) => s.id === b.subscription_id) || null;
}
function periodFor(sub, b) {
  const items = sub.items?.data || [];
  if (items.length !== 1 || objectId(items[0].price) !== b.price_id || items[0].quantity !== 1)
    fail(409, "Le forfait Stripe ne correspond pas au forfait prévu pour cet espace.");
  const item = items[0];
  return {
    start: Number(item.current_period_start ?? sub.current_period_start) || 0,
    end: Number(item.current_period_end ?? sub.current_period_end) || 0,
  };
}
async function invoiceFor(env, sub) {
  if (!sub.latest_invoice) return null;
  return typeof sub.latest_invoice === "object"
    ? sub.latest_invoice
    : stripe(env, "GET", "/invoices/" + encodeURIComponent(sub.latest_invoice));
}
function invoiceSubscription(i) {
  return objectId(i?.parent?.subscription_details?.subscription || i?.subscription);
}
/** Début du « mois » en cours dans une période annuelle (même quantième que le début, en UTC). */
export function monthSliceStart(start, now) {
  const d0 = new Date(start * 1000);
  let k = 0,
    t = start;
  for (let i = 1; i <= 12; i++) {
    const d = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + i, 1, d0.getUTCHours(), d0.getUTCMinutes(), d0.getUTCSeconds()));
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(d0.getUTCDate(), last));
    const ts = Math.floor(d.getTime() / 1000);
    if (ts > now) break;
    k = i;
    t = ts;
  }
  return k ? t : start;
}
export async function syncBilling(env, cid, { strict = false } = {}) {
  const b = await row(env, cid);
  if (!b?.enabled) return b;
  try {
    modeMatches(env, b);
    if (!stripeMode(env)) fail(503, "La connexion Stripe doit être configurée par l’agence.");
    if (!b.customer_id) {
      await run(
        env.DB,
        "UPDATE billing_accounts SET synced_at=?,sync_error=NULL WHERE client_id=? AND version=?",
        time(env),
        cid,
        b.version,
      );
      return row(env, cid);
    }
    const sub = await subscriptions(env, b),
      now = time(env);
    let next = {
      status: "not_started",
      subscription: null,
      start: 0,
      end: 0,
      paid: b.paid_until,
      delinquent: null,
      quota: 0,
    };
    if (sub) {
      if (objectId(sub.customer) !== b.customer_id || sub.livemode !== (stripeMode(env) === "live"))
        fail(403, "L’abonnement ne correspond pas à cet espace.");
      const p = periodFor(sub, b),
        invoice = await invoiceFor(env, sub);
      next = {
        ...next,
        status: sub.status,
        subscription: sub.id,
        start: p.start,
        end: p.end,
        paid: b.subscription_id && b.subscription_id !== sub.id ? 0 : b.paid_until,
      };
      if (invoice) {
        if (objectId(invoice.customer) !== b.customer_id || invoiceSubscription(invoice) !== sub.id)
          fail(403, "La facture ne correspond pas à cet abonnement.");
        // Accept only paid monthly subscription cycles, not one-off/proration invoices.
        const lines = invoice.lines?.data || [],
          line = lines.find(
            (l) =>
              !l.proration &&
              !l.parent?.subscription_item_details?.proration &&
              objectId(l.pricing?.price_details?.price || l.price) === b.price_id &&
              Number(l.period?.start) === p.start &&
              Number(l.period?.end) === p.end,
          );
        if (
          sub.status === "active" &&
          invoice.status === "paid" &&
          ["subscription_create", "subscription_cycle"].includes(invoice.billing_reason) &&
          line &&
          p.end > now &&
          p.start > 0
        ) {
          next.paid = Math.max(b.paid_until, p.end);
          // Abonnement annuel : les visuels se renouvellent chaque mois (même jour que le début de l'année payée).
          next.quota = intervalOfPrice(env, b.price_id) === "year" ? monthSliceStart(p.start, now) : p.start;
        } else if (invoice.status !== "paid")
          next.delinquent = Number(invoice.due_date) || p.start || Number(invoice.created) || b.delinquent_since || now;
      }
      if (!next.delinquent && next.paid <= now && next.paid > 0) next.delinquent = next.paid;
    } else if (b.subscription_id) next.status = "canceled";
    const marker = crypto.randomUUID(),
      reset = next.quota > b.quota_period_start;
    const stmts = [
      q(
        env.DB,
        "UPDATE billing_accounts SET subscription_id=?,stripe_mode=?,status=?,period_start=?,period_end=?,paid_until=?,delinquent_since=?,synced_at=?,sync_error=?,version=version+1,updated=? WHERE client_id=? AND version=?",
        next.subscription,
        stripeMode(env),
        next.status,
        next.start,
        next.end,
        next.paid,
        next.delinquent,
        now,
        marker,
        stamp(),
        cid,
        b.version,
      ),
    ];
    if (reset) {
      stmts.push(
        q(
          env.DB,
          "UPDATE clients SET quota_limit=?,quota_used=0 WHERE id=? AND EXISTS(SELECT 1 FROM billing_accounts WHERE client_id=? AND sync_error=?)",
          b.monthly_credits,
          cid,
          cid,
          marker,
        ),
      );
      stmts.push(
        q(
          env.DB,
          "UPDATE billing_accounts SET quota_period_start=? WHERE client_id=? AND sync_error=?",
          next.quota,
          cid,
          marker,
        ),
      );
    }
    stmts.push(
      q(env.DB, "UPDATE billing_accounts SET sync_error=NULL WHERE client_id=? AND sync_error=?", cid, marker),
    );
    const result = await env.DB.batch(stmts);
    if (!result[0].meta.changes) return row(env, cid);
    return row(env, cid);
  } catch (e) {
    await run(
      env.DB,
      "UPDATE billing_accounts SET sync_error=?,synced_at=? WHERE client_id=? AND version=?",
      e.message,
      time(env),
      cid,
      b.version,
    );
    if (strict) throw e;
    return row(env, cid);
  }
}
export async function billingState(env, u, cid, { sync = false } = {}) {
  const c = await client(env, u, cid),
    region = regionOf(c),
    // Prix affiché au client : celui de son pays (89 €, 1 800 MXN, 120 USD), même avant la connexion Stripe.
    localPrice = { region, amount: PRICING[region].studio, yearly: PRICING[region].studioYear, currency: PRICING[region].currency };
  if (env.BETA_MODE === "true")
    return {
      enabled: false,
      access: { allowed: true, state: "beta", message: "Version bêta : aucun paiement demandé." },
      configured: false,
      mode: "beta",
      status: "beta",
      monthlyCredits: 20,
      localPrice,
    };
  let b = await row(env, cid);
  if (sync && b?.enabled) b = await syncBilling(env, cid);
  const access = billingAccess(b, time(env)),
    common = {
      enabled: !!b?.enabled,
      access,
      configured: billingReadiness(env).configured,
      mode: b?.stripe_mode || stripeMode(env),
      status: b?.status || "not_started",
      paidUntil: b?.paid_until || 0,
      graceDays: b?.grace_days ?? 3,
      monthlyCredits: b?.monthly_credits || 0,
      hasCustomer: !!b?.customer_id,
      hasSubscription: !!b?.subscription_id,
      hasPrice: !!b?.price_id,
      offer: offerForPrice(env, b?.price_id, b),
      // Le bouton « S'abonner » n'a de sens que si un tarif existe pour ce client (catalogue du pays ou personnalisé).
      checkoutReady: !!b?.enabled && billingReadiness(env).configured && !!(regionalPriceFor(env, c) || b?.price_id),
      // Abonnement annuel proposé seulement si un tarif annuel existe pour le pays de la cliente.
      yearlyReady: !!b?.enabled && billingReadiness(env).configured && !!yearlyPriceFor(env, c),
      interval: intervalOfPrice(env, b?.price_id) || "month",
      localPrice,
      syncedAt: b?.synced_at || 0,
    };
  return u.role === "agency" ? { ...common, record: b, readiness: billingReadiness(env) } : common;
}
export async function billingSummary(env) {
  if (env.BETA_MODE === "true") return [];
  const rows = await all(
    env.DB,
    "SELECT b.*,c.name FROM billing_accounts b JOIN clients c ON c.id=b.client_id ORDER BY c.name",
  );
  return rows.map((b) => ({
    client_id: b.client_id,
    name: b.name,
    enabled: !!b.enabled,
    status: b.status,
    paidUntil: b.paid_until,
    access: billingAccess(b, time(env)),
  }));
}
export async function requirePaid(env, u, cid) {
  if (env.BETA_MODE === "true") {
    await client(env, u, cid);
    return;
  }
  await client(env, u, cid);
  const before = await row(env, cid);
  if (before?.enabled && before.override_until > time(env)) return;
  const b = await syncBilling(env, cid, { strict: true }),
    a = billingAccess(b, time(env));
  if (!a.allowed) fail(402, a.message);
}
export async function saveBilling(env, u, b) {
  admin(u);
  const c = await client(env, u, b.client_id);
  const old = await ensureRow(env, b.client_id);
  if (b.version !== old.version) fail(409, "Les réglages ont changé. Actualisez avant d’enregistrer.");
  const grace = Number(b.grace_days),
    credits = Number(b.monthly_credits),
    enabled = b.enabled === true,
    // Sans tarif saisi : le tarif du pays du client (STRIPE_PRICE_ID_FR / _MX / _US).
    pid = String(b.price_id || "").trim() || (enabled ? regionalPriceFor(env, c) : null) || null;
  if (
    !Number.isInteger(grace) ||
    grace < 0 ||
    grace > 30 ||
    !Number.isInteger(credits) ||
    credits < 1 ||
    credits > 100000
  )
    fail(400, "Choisissez un délai de 0 à 30 jours et un nombre de crédits de 1 à 100 000.");
  if (old.subscription_id && pid !== old.price_id)
    fail(
      409,
      "Pour changer un abonnement existant, contactez votre agence de développement. Le tarif ne peut pas être remplacé ici.",
    );
  if (pid && !validId(pid, "price")) fail(400, "Identifiant de tarif Stripe invalide.");
  let priceInfo = pid === old.price_id ? { amount: old.price_amount ?? null, currency: old.price_currency ?? null } : { amount: null, currency: null };
  if (enabled) {
    if (stripeMode(env)) modeMatches(env, old);
    if (!old.enabled || pid !== old.price_id) {
      const p = await validatePrice(env, pid);
      priceInfo = { amount: p.unit_amount, currency: String(p.currency || "").toLowerCase() || null };
      requireLiveSetup(env, pid);
    }
    origin(env);
  }
  const override = b.override_until ? Math.floor(Date.parse(b.override_until) / 1000) : null,
    reason = String(b.override_reason || "")
      .trim()
      .slice(0, 500);
  if (
    override != null &&
    (!Number.isFinite(override) || override <= time(env) || override > time(env) + 366 * 86400 || !reason)
  )
    fail(400, "Indiquez une date future (un an maximum) et le motif de l’exception.");
  const r = await run(
    env.DB,
    "UPDATE billing_accounts SET enabled=?,price_id=?,price_amount=?,price_currency=?,grace_days=?,monthly_credits=?,override_until=?,override_reason=?,version=version+1,updated=? WHERE client_id=? AND version=?",
    enabled ? 1 : 0,
    pid,
    priceInfo.amount,
    priceInfo.currency,
    grace,
    credits,
    override,
    reason || null,
    stamp(),
    b.client_id,
    old.version,
  );
  if (!r.meta.changes) fail(409, "Ces réglages ont changé. Actualisez.");
  await audit(env, u, b.client_id, "billing_settings_updated", {
    enabled,
    price_id: pid,
    grace_days: grace,
    monthly_credits: credits,
    override_until: override,
    override_reason: reason,
  });
  return billingState(env, u, b.client_id, { sync: enabled });
}
export async function linkSubscription(env, u, b) {
  admin(u);
  await client(env, u, b.client_id);
  const old = await ensureRow(env, b.client_id);
  if (old.version !== b.version) fail(409, "Ces réglages ont changé. Actualisez.");
  if (old.customer_id || old.subscription_id)
    fail(409, "Cet espace est déjà lié à Stripe. La liaison ne peut pas être remplacée ici.");
  if (!old.price_id) fail(400, "Enregistrez d’abord le tarif prévu pour ce client.");
  if (!validId(b.customer_id, "cus") || !validId(b.subscription_id, "sub"))
    fail(400, "Indiquez les identifiants client et abonnement Stripe.");
  const sub = await stripe(env, "GET", "/subscriptions/" + b.subscription_id),
    customer = await stripe(env, "GET", "/customers/" + b.customer_id);
  if (customer.deleted || objectId(sub.customer) !== b.customer_id || sub.livemode !== (stripeMode(env) === "live"))
    fail(400, "Ces identifiants ne correspondent pas.");
  if (
    (customer.metadata?.studio_client_id && customer.metadata.studio_client_id !== b.client_id) ||
    (sub.metadata?.studio_client_id && sub.metadata.studio_client_id !== b.client_id)
  )
    fail(403, "Ce client Stripe appartient à un autre espace.");
  periodFor(sub, old);
  const duplicate = await first(
    env.DB,
    "SELECT client_id FROM billing_accounts WHERE customer_id=? OR subscription_id=?",
    b.customer_id,
    b.subscription_id,
  );
  if (duplicate) fail(409, "Ce client ou cet abonnement est déjà lié à un autre espace.");
  try {
    const r = await run(
      env.DB,
      "UPDATE billing_accounts SET customer_id=?,subscription_id=?,stripe_mode=?,version=version+1,updated=? WHERE client_id=? AND version=?",
      b.customer_id,
      b.subscription_id,
      stripeMode(env),
      stamp(),
      b.client_id,
      old.version,
    );
    if (!r.meta.changes) fail(409, "Ces réglages ont changé. Actualisez.");
  } catch (e) {
    if (e.status) throw e;
    fail(409, "Une liaison existe déjà. Actualisez et vérifiez les espaces.");
  }
  await audit(env, u, b.client_id, "billing_subscription_linked", {
    customer_id: b.customer_id,
    subscription_id: b.subscription_id,
  });
  return billingState(env, u, b.client_id, { sync: true });
}
async function customerFor(env, u, c) {
  let b = await row(env, c.id);
  modeMatches(env, b);
  if (b.customer_id) return b;
  const now = time(env);
  if (b.customer_attempt_at && now - b.customer_attempt_at > 23 * 3600)
    fail(409, "La création du client Stripe doit être vérifiée par l’agence avant une nouvelle tentative.");
  if (!b.customer_attempt_at)
    await run(
      env.DB,
      "UPDATE billing_accounts SET customer_attempt_at=? WHERE client_id=? AND customer_attempt_at=0",
      now,
      c.id,
    );
  const profile = await first(env.DB, "SELECT * FROM registration_profiles WHERE client_id=?", c.id);
  const cus = await stripe(
    env,
    "POST",
    "/customers",
    { name: c.name, email: profile?.email || u.email, "metadata[studio_client_id]": c.id },
    "studio-customer:" + stripeMode(env) + ":" + c.id,
  );
  if (!validId(cus.id, "cus")) fail(503, "Stripe n’a pas confirmé le client.");
  await run(
    env.DB,
    "UPDATE billing_accounts SET customer_id=?,stripe_mode=?,version=version+1,updated=? WHERE client_id=? AND customer_id IS NULL",
    cus.id,
    stripeMode(env),
    stamp(),
    c.id,
  );
  return row(env, c.id);
}
export async function checkout(env, u, cid, { interval = "month" } = {}) {
  const c = await client(env, u, cid),
    intake = await first(env.DB, "SELECT status FROM client_intakes WHERE client_id=?", cid);
  if (intake?.status !== "reviewed") fail(409, "Votre agence doit d’abord préparer et ouvrir votre studio.");
  let b = await row(env, cid);
  if (!b?.enabled) fail(409, "Cet espace n’utilise pas le paiement automatique.");
  // Pas encore abonné : un tarif « catalogue » suit le pays du client (l'agence a pu changer le pays après coup).
  // Un tarif personnalisé saisi par l'agence est toujours conservé.
  // Mensuel par défaut ; annuel (2 mois offerts) si la cliente le choisit et qu'un tarif annuel existe pour son pays.
  const regional = (interval === "year" && yearlyPriceFor(env, c)) || regionalPriceFor(env, c);
  if (interval === "year" && !yearlyPriceFor(env, c)) fail(409, "L’abonnement annuel n’est pas encore ouvert pour votre pays.");
  if (
    regional &&
    regional !== b.price_id &&
    (!b.price_id || standardPrice(env, b.price_id)) &&
    (!b.subscription_id || ["canceled", "incomplete_expired"].includes(b.status))
  ) {
    const moved = await run(
      env.DB,
      "UPDATE billing_accounts SET price_id=?,checkout_attempt=NULL,checkout_expires=0,checkout_id=NULL,version=version+1,updated=? WHERE client_id=? AND version=?",
      regional,
      stamp(),
      cid,
      b.version,
    );
    if (!moved.meta.changes) fail(409, "Une page de paiement est déjà en préparation. Réessayez.");
    await audit(env, u, cid, "billing_price_follows_country", { from: b.price_id, to: regional, region: regionOf(c) });
    b = await row(env, cid);
  }
  if (!b.price_id) fail(409, "Le tarif de votre pays n’est pas encore configuré. Contactez votre agence.");
  requireLiveSetup(env, b.price_id);
  const checkedPrice = await validatePrice(env, b.price_id);
  if (b.price_amount !== checkedPrice.unit_amount || b.price_currency !== String(checkedPrice.currency || "").toLowerCase())
    await run(
      env.DB,
      "UPDATE billing_accounts SET price_amount=?,price_currency=? WHERE client_id=? AND price_id=?",
      checkedPrice.unit_amount,
      String(checkedPrice.currency || "").toLowerCase() || null,
      cid,
      b.price_id,
    );
  b = await customerFor(env, u, c);
  await syncBilling(env, cid, { strict: true });
  b = await row(env, cid);
  if (b.subscription_id && !["canceled", "incomplete_expired"].includes(b.status)) return portal(env, u, cid);
  const now = time(env);
  if (!b.checkout_attempt || b.checkout_expires <= now) {
    const changed = await run(
      env.DB,
      "UPDATE billing_accounts SET checkout_attempt=?,checkout_expires=?,checkout_id=NULL,version=version+1 WHERE client_id=? AND version=?",
      crypto.randomUUID(),
      now + 3600,
      cid,
      b.version,
    );
    if (!changed.meta.changes) fail(409, "Une page de paiement est déjà en préparation. Réessayez.");
    b = await row(env, cid);
  }
  const base = origin(env),
    session = await stripe(
      env,
      "POST",
      "/checkout/sessions",
      {
        mode: "subscription",
        ...(standardPrice(env, b.price_id) &&
        env.STRIPE_SOURCE_AUTOMATIC_TAX === "true" &&
        env.STRIPE_TAX_REGISTRATIONS_VERIFIED === "true"
          ? { "automatic_tax[enabled]": "true" }
          : {}),
        integration_identifier:
          "louvet-studio-" +
          [...b.checkout_attempt.replaceAll("-", "").slice(0, 8)]
            .map((h) => String.fromCharCode(97 + parseInt(h, 16)))
            .join(""),
        customer: b.customer_id,
        "line_items[0][price]": b.price_id,
        "line_items[0][quantity]": "1",
        client_reference_id: cid,
        "metadata[studio_client_id]": cid,
        "subscription_data[metadata][studio_client_id]": cid,
        success_url: base + "/studio?billing=success",
        cancel_url: base + "/studio?billing=cancel",
        expires_at: String(b.checkout_expires),
        locale: ["fr", "es", "en"].includes(parse(c.config).language) ? parse(c.config).language : "fr",
      },
      "studio-checkout:" + cid + ":" + b.checkout_attempt,
    );
  const url = verifiedStripeURL(session.url, "checkout.stripe.com");
  await run(
    env.DB,
    "UPDATE billing_accounts SET checkout_id=? WHERE client_id=? AND checkout_attempt=?",
    session.id,
    cid,
    b.checkout_attempt,
  );
  return { url };
}
function verifiedStripeURL(value, host) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(503, "Stripe n’a pas confirmé la page de paiement.");
  }
  if (url.protocol !== "https:" || url.hostname !== host) fail(503, "Adresse de paiement Stripe invalide.");
  return url.href;
}
export async function portal(env, u, cid) {
  const c = await client(env, u, cid);
  const b = await row(env, cid);
  if (!b?.enabled || !b.customer_id) fail(409, "Aucun abonnement Stripe n’est encore lié à cet espace.");
  modeMatches(env, b);
  let language = "fr";
  try {
    language = JSON.parse(c.config || "{}").language;
  } catch {}
  // Portail client Stripe : factures, moyen de paiement, résiliation (réglages dans Stripe → Portail client).
  const session = await stripe(env, "POST", "/billing_portal/sessions", {
    customer: b.customer_id,
    return_url: origin(env) + "/studio?billing=return",
    locale: ["fr", "es", "en"].includes(language) ? language : "fr",
    ...(validId(env.STRIPE_PORTAL_CONFIGURATION_ID, "bpc") ? { configuration: env.STRIPE_PORTAL_CONFIGURATION_ID } : {}),
  });
  return { url: verifiedStripeURL(session.url, "billing.stripe.com") };
}
export async function verifyStripeSignature(raw, header, secret, now) {
  if (!secret || !header) fail(400, "Signature Stripe manquante.");
  const pieces = header.split(",").map((s) => s.trim().split("=")),
    t = pieces.find(([k]) => k === "t")?.[1],
    signatures = pieces.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!/^\d+$/.test(t || "") || Math.abs(now - Number(t)) > 300) fail(400, "Signature Stripe expirée.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  for (const sig of signatures) {
    if (!/^[0-9a-f]{64}$/i.test(sig)) continue;
    const bytes = new Uint8Array(sig.match(/../g).map((h) => parseInt(h, 16)));
    if (await crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(t + "." + raw))) return true;
  }
  fail(400, "Signature Stripe invalide.");
}
export async function stripeWebhook(req, env) {
  if (req.method !== "POST") fail(405, "Méthode non autorisée.");
  if (!env.STRIPE_WEBHOOK_SECRET) fail(503, "Notifications Stripe non configurées.");
  if (Number(req.headers.get("content-length") || 0) > 262144) fail(413, "Notification trop volumineuse.");
  const raw = await req.text();
  if (raw.length > 262144) fail(413, "Notification trop volumineuse.");
  await verifyStripeSignature(raw, req.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET, time(env));
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    fail(400, "Notification illisible.");
  }
  if (!validId(event.id, "evt") || event.livemode !== (stripeMode(env) === "live"))
    fail(400, "Notification d’un environnement Stripe différent.");
  if (
    ![
      "invoice.paid",
      "invoice.payment_failed",
      "invoice.payment_action_required",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
    ].includes(event.type)
  )
    return { received: true, ignored: true };
  const old = await first(env.DB, "SELECT * FROM billing_events WHERE id=?", event.id);
  if (old?.status === "done") return { received: true, duplicate: true };
  const now = time(env),
    claim = await run(
      env.DB,
      "INSERT INTO billing_events VALUES(?,?,NULL,'processing',?) ON CONFLICT(id) DO UPDATE SET status='processing',updated=excluded.updated WHERE billing_events.status='failed' OR (billing_events.status='processing' AND billing_events.updated<?)",
      event.id,
      event.type,
      now,
      now - 60,
    );
  if (!claim.meta.changes) fail(409, "Notification déjà en cours.");
  try {
    const customer = objectId(event.data?.object?.customer),
      b = customer ? await first(env.DB, "SELECT * FROM billing_accounts WHERE customer_id=?", customer) : null;
    if (b) {
      await syncBilling(env, b.client_id, { strict: true });
      // Parrainage : premier paiement d'une marque parrainée → remise pour le parrain, dans la devise de son abonnement.
      try {
        const { onReferredPayment, applyReferralCredits } = await import("./referrals.mjs");
        if (event.type === "invoice.paid") await onReferredPayment(env, b.client_id, event.data?.object);
        await applyReferralCredits(env, b.client_id);
        const { applyReelCredits } = await import("./collabs.mjs");
        await applyReelCredits(env, b.client_id);
      } catch {}
      await run(
        env.DB,
        "UPDATE billing_events SET status='done',client_id=?,updated=? WHERE id=?",
        b.client_id,
        now,
        event.id,
      );
    } else await run(env.DB, "UPDATE billing_events SET status='done',updated=? WHERE id=?", now, event.id);
    return { received: true };
  } catch (e) {
    await run(env.DB, "UPDATE billing_events SET status='failed',updated=? WHERE id=?", now, event.id);
    throw e;
  }
}
