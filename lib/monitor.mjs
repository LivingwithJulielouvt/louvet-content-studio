// Suivi des erreurs, facultatif : actif seulement si SENTRY_DSN est renseigné (sinon simple journal serveur).
// Aucune dépendance ajoutée : l'erreur est envoyée à Sentry par son point d'entrée « envelope », côté serveur.
// Aucune donnée personnelle : les adresses e-mail, jetons et identifiants longs sont masqués avant l'envoi.
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  TOKEN = /\b(sk|rk|pk|whsec|xkeysib|sb_secret|sb_publishable)_[A-Za-z0-9_-]+/g,
  BEARER = /Bearer\s+[A-Za-z0-9._-]+/gi,
  UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  QUERY = /([?&](?:token|code|email|key|signature)=)[^&\s]+/gi;
export function scrub(value, max = 2000) {
  return String(value ?? "")
    .replace(EMAIL, "[email]")
    .replace(TOKEN, "[secret]")
    .replace(BEARER, "Bearer [secret]")
    .replace(UUID, "[id]")
    .replace(QUERY, "$1[masqué]")
    .slice(0, max);
}
export function parseDsn(dsn) {
  try {
    const u = new URL(dsn);
    const project = u.pathname.replace(/^\/+/, "");
    if (u.protocol !== "https:" || !u.username || !/^\d+$/.test(project)) return null;
    return { key: u.username, host: u.host, project, url: `https://${u.host}/api/${project}/envelope/` };
  } catch {
    return null;
  }
}
/**
 * Envoie une erreur (serveur ou navigateur) à Sentry si configuré. Ne lève jamais d'exception.
 * @param {any} env
 * @param {{ message?: string, stack?: string, source?: string, path?: string, release?: string }} [info]
 */
export async function reportError(env, { message, stack, source = "server", path = "", release = "" } = {}) {
  const msg = scrub(message, 500),
    st = scrub(stack, 4000);
  const dsn = parseDsn(env?.SENTRY_DSN || "");
  if (!dsn) return { sent: false };
  const id = crypto.randomUUID().replaceAll("-", "");
  const event = {
    event_id: id,
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    environment: env?.SENTRY_ENVIRONMENT || (env?.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "production" : "test"),
    release: release || env?.VERCEL_GIT_COMMIT_SHA || undefined,
    tags: { source },
    transaction: scrub(path, 200) || undefined,
    exception: { values: [{ type: source === "browser" ? "BrowserError" : "ServerError", value: msg }] },
    extra: st ? { stack: st } : undefined,
  };
  const body =
    JSON.stringify({ event_id: id, sent_at: new Date().toISOString() }) +
    "\n" +
    JSON.stringify({ type: "event" }) +
    "\n" +
    JSON.stringify(event);
  try {
    const f = env?.MONITOR_FETCH || fetch;
    const r = await f(dsn.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=louvet-studio/1.0, sentry_key=${dsn.key}`,
      },
      body,
    });
    return { sent: r.ok };
  } catch {
    return { sent: false };
  }
}
