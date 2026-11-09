// Publication directe sur Instagram (API Instagram avec connexion Instagram, plateforme Meta).
// Désactivée tant que META_PUBLISHING_ENABLED n'est pas "true" et que l'app Meta n'a pas été approuvée.
// Les jetons d'accès sont chiffrés (AES-256-GCM) avant d'être enregistrés.
const q = (db, sql, ...a) => db.prepare(sql).bind(...a);
const first = (db, sql, ...a) => q(db, sql, ...a).first();
const run = (db, sql, ...a) => q(db, sql, ...a).run();
const all = async (db, sql, ...a) => (await q(db, sql, ...a).all()).results;
const stamp = () => new Date().toISOString();
function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
export const META_SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];
const graph = (env) => "https://graph.instagram.com/" + (env.META_GRAPH_VERSION || "v23.0");

export function metaReadiness(env) {
  const configured = !!(env.META_APP_ID && env.META_APP_SECRET && env.META_TOKEN_KEY && env.STUDIO_URL);
  return { configured, enabled: configured && env.META_PUBLISHING_ENABLED === "true" };
}
function requireEnabled(env) {
  const r = metaReadiness(env);
  if (!r.configured) fail(503, "La publication Meta n’est pas encore configurée par l’agence.");
  if (!r.enabled) fail(503, "La publication Meta est en attente d’activation (validation de l’application par Meta).");
}
function redirectUri(env) {
  return new URL("/api/studio/meta-callback", env.STUDIO_URL).toString();
}
async function key(env) {
  const raw = Buffer.from(String(env.META_TOKEN_KEY || ""), "base64");
  if (raw.length !== 32) fail(503, "META_TOKEN_KEY doit contenir 32 octets encodés en base64.");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function sealToken(env, token) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(env), new TextEncoder().encode(token)));
  return Buffer.from(iv).toString("base64") + "." + Buffer.from(data).toString("base64");
}
export async function openToken(env, sealed) {
  const [iv, data] = String(sealed).split(".");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(iv, "base64") },
    await key(env),
    Buffer.from(data, "base64"),
  );
  return new TextDecoder().decode(plain);
}
async function call(env, url, { method = "GET", form = null } = {}) {
  let r;
  try {
    r = await (env.META_FETCH || fetch)(url, {
      method,
      ...(form ? { headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form).toString() } : {}),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    fail(503, "Instagram ne répond pas. Réessayez dans quelques minutes.");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.error) {
    const msg = data.error?.error_user_msg || data.error?.message || data.error_message || "Instagram a refusé l’opération.";
    fail(r.status >= 500 ? 503 : 400, "Instagram : " + msg);
  }
  return data;
}

/** Étape 1 : lien de connexion du compte Instagram professionnel du client. */
export async function metaConnectUrl(env, user, cid) {
  requireEnabled(env);
  const state = [...crypto.getRandomValues(new Uint8Array(24))].map((x) => x.toString(16).padStart(2, "0")).join("");
  await run(env.DB, "DELETE FROM meta_oauth_states WHERE expires<?", stamp());
  await run(
    env.DB,
    "INSERT INTO meta_oauth_states(state,client_id,user_id,expires) VALUES(?,?,?,?)",
    state,
    cid,
    user.id,
    new Date(Date.now() + 15 * 60000).toISOString(),
  );
  const u = new URL("https://www.instagram.com/oauth/authorize");
  u.searchParams.set("client_id", env.META_APP_ID);
  u.searchParams.set("redirect_uri", redirectUri(env));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", META_SCOPES.join(","));
  u.searchParams.set("state", state);
  return u.toString();
}
/** Étape 2 : retour d'Instagram, échange du code contre un jeton longue durée (60 jours). */
export async function metaCallback(env, user, params) {
  requireEnabled(env);
  const state = String(params.get("state") || "");
  const row = await first(env.DB, "SELECT * FROM meta_oauth_states WHERE state=?", state);
  await run(env.DB, "DELETE FROM meta_oauth_states WHERE state=?", state);
  if (!row || row.user_id !== user.id || row.expires < stamp()) fail(400, "Connexion Instagram expirée. Recommencez.");
  if (params.get("error")) fail(400, "Connexion Instagram annulée.");
  const code = String(params.get("code") || "").replace(/#_$/, "");
  if (!code) fail(400, "Code Instagram manquant.");
  const short = await call(env, "https://api.instagram.com/oauth/access_token", {
    method: "POST",
    form: {
      client_id: env.META_APP_ID,
      client_secret: env.META_APP_SECRET,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(env),
      code,
    },
  });
  const long = await call(
    env,
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(env.META_APP_SECRET)}&access_token=${encodeURIComponent(short.access_token)}`,
  );
  const me = await call(env, `${graph(env)}/me?fields=user_id,username&access_token=${encodeURIComponent(long.access_token)}`);
  const now = stamp();
  await run(
    env.DB,
    "INSERT INTO meta_connections(client_id,ig_user_id,username,token_encrypted,token_expires,connected_by,created,updated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(client_id) DO UPDATE SET ig_user_id=excluded.ig_user_id,username=excluded.username,token_encrypted=excluded.token_encrypted,token_expires=excluded.token_expires,connected_by=excluded.connected_by,updated=excluded.updated",
    row.client_id,
    String(me.user_id || short.user_id),
    me.username || null,
    await sealToken(env, long.access_token),
    new Date(Date.now() + Number(long.expires_in || 5184000) * 1000).toISOString(),
    user.id,
    now,
    now,
  );
  return { client_id: row.client_id, username: me.username || null };
}
export async function metaDisconnect(env, cid) {
  await run(env.DB, "DELETE FROM meta_connections WHERE client_id=?", cid);
  return { ok: true };
}
/** Renouvelle le jeton s'il expire dans moins de 10 jours (jeton valable 60 jours). */
async function token(env, conn) {
  let t = await openToken(env, conn.token_encrypted);
  if (conn.token_expires && new Date(conn.token_expires).getTime() - Date.now() < 10 * 86400000) {
    const fresh = await call(env, `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(t)}`);
    t = fresh.access_token;
    await run(
      env.DB,
      "UPDATE meta_connections SET token_encrypted=?,token_expires=?,updated=? WHERE client_id=?",
      await sealToken(env, t),
      new Date(Date.now() + Number(fresh.expires_in || 5184000) * 1000).toISOString(),
      stamp(),
      conn.client_id,
    );
  }
  return t;
}
/**
 * Publie un post du calendrier sur Instagram : image (convertie en JPEG) ou vidéo (Reel).
 * `deps` fournit l'accès au stockage privé et la validation du post (fonctions du studio).
 */
export async function metaPublish(env, user, b, deps) {
  requireEnabled(env);
  const db = env.DB,
    post = await deps.post(b.post_id);
  const requestKey = String(b.request_key || "").slice(0, 100);
  if (requestKey.length < 8) fail(400, "Identifiant de demande manquant. Rechargez la page.");
  const done = await first(db, "SELECT * FROM meta_publications WHERE request_key=?", requestKey);
  if (done) return { ...done, duplicate: true };
  const already = await first(db, "SELECT * FROM meta_publications WHERE post_id=? AND status='published'", post.id);
  if (already) fail(409, "Ce post est déjà publié sur Instagram.");
  const conn = await first(db, "SELECT * FROM meta_connections WHERE client_id=?", post.client_id);
  if (!conn) fail(409, "Connectez d’abord le compte Instagram de cette marque.");
  if (!post.file_id) fail(400, "Ajoutez un visuel ou une vidéo à ce post avant de le publier.");
  const file = await first(db, "SELECT * FROM files WHERE id=? AND client_id=?", post.file_id, post.client_id);
  if (!file) fail(404, "Le visuel de ce post est introuvable.");
  const id = crypto.randomUUID(),
    now = stamp();
  await run(
    db,
    "INSERT INTO meta_publications(id,client_id,post_id,request_key,status,user_id,created,updated) VALUES(?,?,?,?,?,?,?,?)",
    id,
    post.client_id,
    post.id,
    requestKey,
    "publishing",
    user.id,
    now,
    now,
  );
  try {
    const t = await token(env, conn),
      base = `${graph(env)}/${encodeURIComponent(conn.ig_user_id)}`;
    const video = file.mime.startsWith("video/");
    const mediaUrl = await deps.publicUrl(file, video);
    const caption = String(post.caption || "").slice(0, 2200);
    const container = await call(env, `${base}/media`, {
      method: "POST",
      form: video
        ? { media_type: "REELS", video_url: mediaUrl, caption, access_token: t }
        : { image_url: mediaUrl, caption, access_token: t },
    });
    // Instagram prépare le média (quelques secondes pour une image, plus pour une vidéo).
    for (let i = 0; i < (video ? 20 : 6); i++) {
      const s = await call(env, `${graph(env)}/${container.id}?fields=status_code&access_token=${encodeURIComponent(t)}`);
      if (s.status_code === "FINISHED" || !s.status_code) break;
      if (s.status_code === "ERROR" || s.status_code === "EXPIRED") fail(400, "Instagram n’a pas pu préparer ce média.");
      await new Promise((r) => setTimeout(r, deps.wait ?? 2500));
    }
    const media = await call(env, `${base}/media_publish`, {
      method: "POST",
      form: { creation_id: container.id, access_token: t },
    });
    let permalink = null;
    try {
      permalink = (await call(env, `${graph(env)}/${media.id}?fields=permalink&access_token=${encodeURIComponent(t)}`)).permalink || null;
    } catch {}
    await run(
      db,
      "UPDATE meta_publications SET status='published',media_id=?,permalink=?,updated=? WHERE id=?",
      media.id,
      permalink,
      stamp(),
      id,
    );
    await deps.markPublished(post);
    return { id, status: "published", media_id: media.id, permalink };
  } catch (e) {
    await run(db, "UPDATE meta_publications SET status='failed',error=?,updated=? WHERE id=?", String(e.message).slice(0, 500), stamp(), id);
    throw e;
  }
}
export async function metaState(env, cid) {
  if (!cid || cid === "__none__") return { meta: { ...metaReadiness(env), connection: null, publications: [] } };
  const conn = await first(env.DB, "SELECT username,token_expires,updated FROM meta_connections WHERE client_id=?", cid);
  return {
    meta: {
      ...metaReadiness(env),
      connection: conn,
      publications: await all(
        env.DB,
        "SELECT post_id,status,permalink,error,updated FROM meta_publications WHERE client_id=? ORDER BY created DESC LIMIT 100",
        cid,
      ),
    },
  };
}
