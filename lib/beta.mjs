// Beta invitations bind once to the verified Supabase Auth identity, never to a
// browser-supplied email or role. Only token hashes are stored in the database.
const q = (db, sql, ...a) => db.prepare(sql).bind(...a);
const first = (db, sql, ...a) => q(db, sql, ...a).first();
const now = () => new Date().toISOString();
const fail = (status, message) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};
export const betaMode = (env) => env.BETA_MODE === "true";
export async function betaHash(value) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function betaClaim(env, user, input) {
  if (user.role !== "unlinked") fail(409, "Votre compte possède déjà un espace.");
  const db = env.DB,
    stamp = now();
  const attempts = await first(
    db,
    "SELECT COUNT(*) AS n FROM audit WHERE author=? AND action='beta_join_attempt' AND created>?",
    user.id,
    new Date(Date.now() - 600000).toISOString(),
  );
  if (attempts.n >= 5) fail(429, "Trop de tentatives. Réessayez dans dix minutes.");
  await q(
    db,
    "INSERT INTO audit VALUES(?,NULL,?,'beta_join_attempt',?,'{}',?)",
    crypto.randomUUID(),
    user.id,
    user.id,
    stamp,
  ).run();
  const code = String(input.code || "")
    .trim()
    .toUpperCase();
  if (!/^BETA-[A-F0-9]{32}$/.test(code)) fail(400, "Code d’invitation invalide ou déjà utilisé.");
  const invite = await first(
    db,
    "SELECT i.* FROM beta_invites i JOIN clients c ON c.id=i.client_id WHERE i.token_hash=? AND i.claimed_by IS NULL AND i.expires_at>? AND c.active=1",
    await betaHash(code),
    stamp,
  );
  if (!invite) fail(400, "Code d’invitation invalide, expiré ou déjà utilisé.");
  const name =
    String(input.first_name || "Testeur")
      .trim()
      .slice(0, 80) || "Testeur";
  try {
    await db.batch([
      q(
        db,
        "UPDATE beta_invites SET claimed_by=?,claimed_at=? WHERE client_id=? AND claimed_by IS NULL AND token_hash=? AND expires_at>? AND NOT EXISTS(SELECT 1 FROM accounts WHERE id=?)",
        user.id,
        stamp,
        invite.client_id,
        invite.token_hash,
        stamp,
        user.id,
      ),
      q(
        db,
        "INSERT INTO accounts(id,email,role,client_id,active,created) SELECT ?,?,'client',client_id,1,? FROM beta_invites WHERE client_id=? AND claimed_by=? AND claimed_at=?",
        user.id,
        user.email,
        stamp,
        invite.client_id,
        user.id,
        stamp,
      ),
      q(
        db,
        "INSERT INTO registration_profiles(client_id,first_name,email,created) SELECT client_id,?,?,? FROM beta_invites WHERE client_id=? AND claimed_by=? AND claimed_at=?",
        name,
        user.email,
        stamp,
        invite.client_id,
        user.id,
        stamp,
      ),
    ]);
  } catch {
    fail(409, "Cette invitation a déjà été utilisée. Contactez l’agence.");
  }
  const account = await first(db, "SELECT client_id FROM accounts WHERE id=?", user.id);
  if (account?.client_id !== invite.client_id) fail(409, "Cette invitation a déjà été utilisée.");
  return { ok: true };
}
export async function betaState(env, user, clientId) {
  const usage = clientId
    ? await first(env.DB, "SELECT image_attempts FROM beta_usage WHERE client_id=?", clientId)
    : null;
  const common = {
    enabled: betaMode(env),
    imageLimit: 20,
    imageAttempts: usage?.image_attempts || 0,
    remaining: usage ? Math.max(0, 20 - usage.image_attempts) : null,
  };
  if (user.role !== "agency") return common;
  return {
    ...common,
    invitations: (
      await q(
        env.DB,
        "SELECT i.client_id,c.name,i.claimed_by IS NOT NULL AS used,i.claimed_at,i.expires_at,u.image_attempts FROM beta_invites i JOIN clients c ON c.id=i.client_id JOIN beta_usage u ON u.client_id=i.client_id ORDER BY c.name",
      ).all()
    ).results,
    feedback: (
      await q(
        env.DB,
        "SELECT f.id,f.client_id,f.category,f.message,f.page,f.created,c.name AS client_name FROM beta_feedback f LEFT JOIN clients c ON c.id=f.client_id ORDER BY f.created DESC LIMIT 100",
      ).all()
    ).results,
  };
}
export async function betaFeedback(env, user, input) {
  if (user.role === "unlinked") fail(403, "Rejoignez votre espace de test avant d’envoyer votre avis.");
  const message = String(input.message || "").trim(),
    category = String(input.category || "suggestion"),
    page = String(input.page || "/").slice(0, 200);
  if (
    message.length < 5 ||
    message.length > 4000 ||
    !["bug", "question", "suggestion", "appreciation"].includes(category)
  )
    fail(400, "Écrivez un avis de 5 à 4 000 caractères.");
  const count = await first(
    env.DB,
    "SELECT COUNT(*) AS n FROM beta_feedback WHERE user_id=? AND created>?",
    user.id,
    new Date(Date.now() - 600000).toISOString(),
  );
  if (count.n >= 5) fail(429, "Merci pour vos retours ! Réessayez dans dix minutes.");
  const key = String(input.request_key || "");
  if (!/^[a-zA-Z0-9-]{8,100}$/.test(key)) fail(400, "Rechargez le formulaire avant de réessayer.");
  await q(
    env.DB,
    "INSERT OR IGNORE INTO beta_feedback(id,user_id,client_id,category,message,page,request_key,created) VALUES(?,?,?,?,?,?,?,?)",
    crypto.randomUUID(),
    user.id,
    user.client_id || null,
    category,
    message,
    page,
    key,
    now(),
  ).run();
  return { ok: true };
}
