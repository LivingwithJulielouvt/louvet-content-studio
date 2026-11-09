// Parrainage : chaque client a un code. Pour chaque marque parrainée qui paie son premier mois,
// le parrain reçoit une remise unique dans la devise de son abonnement (10 € en France, 200 MXN au Mexique, 10 USD aux États-Unis), appliquée automatiquement sur sa prochaine facture Stripe
// (crédit de solde client). Rien n'est envoyé ni débité tant que Stripe n'est pas configuré.
import { stripe, stripeMode, creditRegionFor } from "./billing.mjs";
import { referralReward, normRegion } from "./pricing.mjs";
const q = (db, sql, ...a) => db.prepare(sql).bind(...a);
const first = (db, sql, ...a) => q(db, sql, ...a).first();
const all = async (db, sql, ...a) => (await q(db, sql, ...a).all()).results;
const run = (db, sql, ...a) => q(db, sql, ...a).run();
const stamp = () => new Date().toISOString();
function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
// Valeurs historiques (États-Unis) ; le montant réel dépend du pays du parrain : voir rewardFor().
export const REFERRAL_REWARD_CENTS = 1000,
  REFERRAL_CURRENCY = "usd";
async function regionOfClient(db, cid) {
  const c = await first(db, "SELECT config FROM clients WHERE id=?", cid);
  try {
    return normRegion(JSON.parse(c?.config || "{}").country);
  } catch {
    return normRegion(null);
  }
}
/** Remise du parrain, dans la devise de son propre abonnement (le solde Stripe doit être dans cette devise).
 *  Renvoie null si l'abonnement est dans une devise sans montant prévu. */
export async function rewardFor(db, cid, env = null) {
  const region = await creditRegionFor(db, env, cid);
  return region ? referralReward(region) : null;
}
export const normalizeCode = (v) =>
  String(v || "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 24);
function newCode(name) {
  const base =
    String(name || "LOUVET")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8) || "LOUVET";
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const tail = [...crypto.getRandomValues(new Uint8Array(4))].map((x) => alphabet[x % alphabet.length]).join("");
  return `${base}-${tail}`;
}
export async function referralCode(db, cid) {
  const existing = await first(db, "SELECT code FROM referral_codes WHERE client_id=?", cid);
  if (existing) return existing.code;
  const c = await first(db, "SELECT name FROM clients WHERE id=?", cid);
  if (!c) fail(404, "Espace introuvable.");
  for (let i = 0; i < 5; i++) {
    const code = newCode(c.name);
    const saved = await run(
      db,
      "INSERT OR IGNORE INTO referral_codes(code,client_id,created) VALUES(?,?,?)",
      code,
      cid,
      stamp(),
    );
    if (saved.meta.changes) return code;
    const mine = await first(db, "SELECT code FROM referral_codes WHERE client_id=?", cid);
    if (mine) return mine.code;
  }
  fail(503, "Code de parrainage indisponible. Réessayez.");
}
/** Formulaire public / inscription : mémorise le code saisi par un prospect, rattaché à son e-mail. */
export async function claimReferral(db, email, code) {
  const clean = normalizeCode(code);
  if (!clean) return null;
  const owner = await first(db, "SELECT client_id FROM referral_codes WHERE code=?", clean);
  if (!owner) fail(400, "Ce code de parrainage n’existe pas. Vérifiez-le ou laissez le champ vide.");
  await run(
    db,
    // Le premier code rattaché à une adresse vérifiée l’emporte : jamais d’écrasement.
    "INSERT INTO referral_claims(email,code,created) VALUES(?,?,?) ON CONFLICT(email) DO NOTHING",
    String(email).toLowerCase(),
    clean,
    stamp(),
  );
  return clean;
}
/** Quand un compte rejoint son espace, le parrainage éventuellement saisi est rattaché à cet espace.
 *  Appelée uniquement avec l’adresse vérifiée (OTP). Le formulaire public ne fait que conserver le code
 *  dans la demande (answers._ref) ; il est repris ici depuis la plus ancienne demande de cette adresse. */
export async function linkReferralByEmail(db, email, referredCid) {
  const mail = String(email || "").toLowerCase();
  let claim = await first(db, "SELECT * FROM referral_claims WHERE email=?", mail);
  if (!claim) {
    const req = await first(
      db,
      "SELECT answers FROM public_subscription_requests WHERE lower(email)=? ORDER BY created ASC LIMIT 1",
      mail,
    ).catch(() => null);
    let ref = null;
    try {
      ref = normalizeCode(JSON.parse(req?.answers || "{}")._ref);
    } catch {}
    if (ref) claim = { email: mail, code: ref };
  }
  if (!claim) return null;
  const linked = await linkReferral(db, referredCid, claim.code).catch(() => null);
  await run(db, "DELETE FROM referral_claims WHERE email=?", claim.email);
  return linked;
}
export async function linkReferral(db, referredCid, code) {
  const owner = await first(db, "SELECT client_id FROM referral_codes WHERE code=?", normalizeCode(code));
  if (!owner) fail(400, "Code de parrainage inconnu.");
  if (owner.client_id === referredCid) fail(400, "Un espace ne peut pas se parrainer lui-même.");
  const referred = await first(db, "SELECT name FROM clients WHERE id=?", referredCid);
  if (!referred) fail(404, "Espace introuvable.");
  const now = stamp(),
    reward = (await rewardFor(db, owner.client_id)) || referralReward(await regionOfClient(db, owner.client_id));
  await run(
    db,
    "INSERT OR IGNORE INTO referrals(id,client_id,referred_client_id,referred_name,status,amount_cents,currency,created,updated) VALUES(?,?,?,?,?,?,?,?,?)",
    crypto.randomUUID(),
    owner.client_id,
    referredCid,
    referred.name,
    "pending",
    reward.cents,
    reward.currency,
    now,
    now,
  );
  return first(db, "SELECT * FROM referrals WHERE referred_client_id=?", referredCid);
}
/** Appelé par le webhook Stripe : premier paiement d'une marque parrainée → remise pour le parrain. */
export async function onReferredPayment(env, referredCid, invoice) {
  if (!invoice || Number(invoice.amount_paid || 0) <= 0) return null;
  await run(
    env.DB,
    "UPDATE referrals SET status='qualified',updated=? WHERE referred_client_id=? AND status='pending'",
    stamp(),
    referredCid,
  );
  const r = await first(env.DB, "SELECT client_id FROM referrals WHERE referred_client_id=?", referredCid);
  return r ? applyReferralCredits(env, r.client_id) : null;
}
/** Applique les remises acquises sur le solde Stripe du parrain (déduites automatiquement de sa prochaine facture). */
export async function applyReferralCredits(env, referrerCid) {
  const b = await first(env.DB, "SELECT customer_id FROM billing_accounts WHERE client_id=?", referrerCid);
  if (!b?.customer_id || !stripeMode(env)) return { credited: 0, waiting: true };
  let credited = 0;
  const reward = await rewardFor(env.DB, referrerCid, env);
  if (!reward) {
    await run(
      env.DB,
      "UPDATE referrals SET credit_error=?,updated=? WHERE client_id=? AND status='qualified'",
      "Devise de l’abonnement sans montant de parrainage prévu : à créditer à la main dans Stripe.",
      stamp(),
      referrerCid,
    );
    return { credited: 0, error: "currency" };
  }
  for (const r of await all(env.DB, "SELECT * FROM referrals WHERE client_id=? AND status='qualified'", referrerCid)) {
    const claim = await run(
      env.DB,
      "UPDATE referrals SET status='crediting',updated=? WHERE id=? AND status='qualified'",
      stamp(),
      r.id,
    );
    if (!claim.meta.changes) continue;
    // La remise suit la devise de l'abonnement Stripe du parrain (pas seulement son pays).
    if (r.currency !== reward.currency) {
      await run(env.DB, "UPDATE referrals SET amount_cents=?,currency=? WHERE id=?", reward.cents, reward.currency, r.id);
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
          description: `Parrainage : ${r.referred_name}`,
          "metadata[studio_referral_id]": r.id,
        },
        "studio-referral:" + r.id,
      );
      await run(
        env.DB,
        "UPDATE referrals SET status='credited',stripe_reference=?,credit_error=NULL,updated=? WHERE id=?",
        txn.id || null,
        stamp(),
        r.id,
      );
      credited++;
    } catch (e) {
      // Échec Stripe : la remise reste due (nouvel essai au prochain paiement) et l'erreur est visible par l'agence.
      await run(
        env.DB,
        "UPDATE referrals SET status='qualified',credit_error=?,updated=? WHERE id=?",
        String(e?.message || "Stripe a refusé le crédit.").slice(0, 300),
        stamp(),
        r.id,
      );
    }
  }
  return { credited };
}
export async function referralState(env, user, cid) {
  if (!cid || cid === "__none__") return { referral: null };
  const db = env.DB;
  const rows = await all(
    db,
    "SELECT referred_name,status,amount_cents,currency,credit_error,created,updated FROM referrals WHERE client_id=? ORDER BY created DESC",
    cid,
  );
  const base = (() => {
    try {
      return new URL(env.STUDIO_URL).origin;
    } catch {
      return "";
    }
  })();
  const code = await referralCode(db, cid),
    reward = (await rewardFor(db, cid, env)) || referralReward(await regionOfClient(db, cid));
  const earned = rows.filter((r) => r.status === "credited").reduce((s, r) => s + r.amount_cents, 0),
    waiting = rows.filter((r) => ["qualified", "crediting"].includes(r.status)).reduce((s, r) => s + r.amount_cents, 0);
  return {
    referral: {
      code,
      link: `${base}/souscrire?ref=${encodeURIComponent(code)}`,
      reward_cents: reward.cents,
      currency: reward.currency,
      referrals: rows,
      earned_cents: earned,
      waiting_cents: waiting,
    },
    ...(user.role === "agency"
      ? {
          referralOverview: await all(
            db,
            "SELECT r.id,r.client_id,r.status,r.amount_cents,r.credit_error,r.created,r.updated,r.referred_name,c.name AS referrer_name FROM referrals r JOIN clients c ON c.id=r.client_id ORDER BY r.created DESC LIMIT 100",
          ),
        }
      : {}),
  };
}
