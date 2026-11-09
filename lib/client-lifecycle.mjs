import { stripe, stripeMode } from "./billing.mjs";
const q = (db, s, ...a) => db.prepare(s).bind(...a),
  one = (db, s, ...a) => q(db, s, ...a).first();
const stamp = () => new Date().toISOString();
const fail = (status, message) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};
export const tenantTables = [
  "shot_clips",
  "monthly_deliveries",
  "referral_codes",
  "referrals",
  "offer_requests",
  "booking_requests",
  "chat_messages",
  "calendar_entries",
  "opportunity_status",
  "brand_collab_profiles",
  "collab_requests",
  "reel_collab_claims",
  "test_versions",
  "test_batches",
  "inspirations",
  "site_imports",
  "places",
  "designs",
  "meta_connections",
  "meta_oauth_states",
  "meta_publications",
  "accounts",
  "audit",
  "beta_feedback",
  "beta_invites",
  "beta_usage",
  "billing_accounts",
  "billing_events",
  "client_intakes",
  "client_video_styles",
  "corrections",
  "custom_occasions",
  "email_outbox",
  "files",
  "intake_tests",
  "jobs",
  "notifications",
  "products",
  "publication_posts",
  "recipes",
  "registration_profiles",
  "reward_events",
  "rules",
  "studio_mail_members",
  "tasks",
  "video_edits",
  "video_ideas",
  "video_plans",
  "video_renders",
  "upload_intents",
];
export async function assertClientWritable(env, cid) {
  if (
    !(await one(env.DB, "SELECT id FROM clients WHERE id=?", cid)) ||
    (await one(env.DB, "SELECT client_id FROM client_deletions WHERE client_id=?", cid))
  )
    fail(410, "Cet espace est en cours de suppression ou a été supprimé.");
}
export async function storeClientObject(env, cid, key, bytes, metadata, persist) {
  await assertClientWritable(env, cid);
  await env.BUCKET.put(key, bytes, { httpMetadata: metadata });
  try {
    await assertClientWritable(env, cid);
    await persist();
    await assertClientWritable(env, cid);
  } catch (e) {
    await env.BUCKET.delete(key);
    throw e;
  }
}
export async function clientLifecycle(env, user, input) {
  if (user.role !== "agency") fail(403, "Cette action est réservée à l’agence.");
  const db = env.DB,
    cid = String(input.client_id || ""),
    mode = input.mode;
  if (!["deactivate", "reactivate", "delete"].includes(mode))
    fail(400, "Choisissez désactiver, réactiver ou supprimer.");
  const c = await one(db, "SELECT * FROM clients WHERE id=?", cid),
    deletion = await one(db, "SELECT * FROM client_deletions WHERE client_id=?", cid);
  if (!c) {
    if (mode === "delete" && deletion?.status === "done") return { deleted: true };
    fail(404, "Espace introuvable.");
  }
  if (String(input.confirm_name || "").trim() !== c.name)
    fail(400, "Retapez exactement le nom du client pour confirmer.");
  if (await one(db, "SELECT id FROM accounts WHERE client_id=? AND role='agency'", cid))
    fail(409, "Un compte agence ne peut pas être supprimé par cette action.");
  if (mode !== "delete") {
    if (deletion) fail(409, "Une suppression définitive est déjà engagée. Elle ne peut pas être annulée.");
    await q(db, "UPDATE clients SET active=? WHERE id=? AND name=?", mode === "reactivate" ? 1 : 0, cid, c.name).run();
    return { active: mode === "reactivate" };
  }
  // Un abonnement Stripe encore actif continuerait d'être prélevé après l'effacement : on bloque,
  // sauf si l'agence demande explicitement sa résiliation immédiate (cancel_subscription: true).
  const bill = await one(db, "SELECT subscription_id,status FROM billing_accounts WHERE client_id=?", cid);
  if (bill?.subscription_id && !["canceled", "incomplete_expired"].includes(bill.status) && deletion?.status !== "purging" && deletion?.status !== "failed") {
    if (input.cancel_subscription !== true || !stripeMode(env))
      fail(
        409,
        "Résiliez d’abord l’abonnement Stripe de ce client (ou cochez « Résilier l’abonnement maintenant ») : sinon il continuerait d’être prélevé.",
      );
    await stripe(env, "DELETE", "/subscriptions/" + encodeURIComponent(bill.subscription_id), null, "studio-delete-cancel:" + cid);
    await q(db, "UPDATE billing_accounts SET status='canceled',updated=? WHERE client_id=?", stamp(), cid).run();
  }
  // Lock identities and in-flight writes before touching objects. A minimal
  // tombstone survives the purge so a late provider result cannot recreate data.
  await db.batch([
    q(
      db,
      "INSERT INTO client_deletions VALUES(?,?,'purging',NULL,?) ON CONFLICT(client_id) DO UPDATE SET status='purging',error=NULL,updated=excluded.updated",
      cid,
      user.id,
      stamp(),
    ),
    q(db, "UPDATE clients SET active=0 WHERE id=?", cid),
  ]);
  try {
    for (let page = 0; page < 8; page++) {
      const result = await env.BUCKET.list({ prefix: cid + "/", limit: 1000 });
      if (!result.objects.length) {
        if (env.AUTH_ADMIN) {
          const identities = (await q(db, "SELECT id FROM accounts WHERE client_id=? AND role='client'", cid).all())
            .results;
          for (const identity of identities) await env.AUTH_ADMIN.deleteUser(identity.id);
        }
        // Données personnelles rattachées par e-mail ou identité (demandes publiques, parrainage déclaré).
        const people = (
          await q(
            db,
            "SELECT id,email FROM accounts WHERE client_id=? AND role='client' UNION SELECT NULL AS id,email FROM registration_profiles WHERE client_id=?",
            cid,
            cid,
          ).all()
        ).results;
        const commands = [q(db, "DELETE FROM audit WHERE author IN (SELECT id FROM accounts WHERE client_id=?)", cid)];
        for (const p of people) {
          if (p.email) {
            commands.push(q(db, "DELETE FROM public_subscription_requests WHERE lower(email)=lower(?)", p.email));
            commands.push(q(db, "DELETE FROM referral_claims WHERE lower(email)=lower(?)", p.email));
          }
          if (p.id) {
            commands.push(q(db, "DELETE FROM public_subscription_requests WHERE identity_id=?", p.id));
            commands.push(q(db, "DELETE FROM public_subscription_nonces WHERE identity_id=?", p.id));
          }
        }
        // Parrainage où ce client était le filleul (celui où il était parrain est effacé avec les tables du client).
        commands.push(q(db, "DELETE FROM referrals WHERE referred_client_id=?", cid));
        for (const table of tenantTables) commands.push(q(db, `DELETE FROM ${table} WHERE client_id=?`, cid));
        // Propositions reçues par cette marque (celles envoyées par une créatrice sont effacées ci-dessus).
        commands.push(q(db, "DELETE FROM collab_requests WHERE brand_client_id=?", cid));
        commands.push(q(db, "DELETE FROM clients WHERE id=?", cid));
        commands.push(
          q(db, "UPDATE client_deletions SET status='done',error=NULL,updated=? WHERE client_id=?", stamp(), cid),
        );
        await db.batch(commands);
        return { deleted: true };
      }
      await env.BUCKET.delete(result.objects.map((o) => o.key));
    }
    return {
      deleted: false,
      pending: true,
      message: "L’accès est fermé. L’effacement est en cours ; reprenez la suppression pour terminer.",
    };
  } catch {
    await q(
      db,
      "UPDATE client_deletions SET status='failed',error='Effacement interrompu. Reprendre la suppression.',updated=? WHERE client_id=?",
      stamp(),
      cid,
    ).run();
    fail(503, "L’accès est fermé. L’effacement a été interrompu ; reprenez la suppression pour terminer.");
  }
}
