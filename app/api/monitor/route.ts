// Erreurs du navigateur → Sentry (si SENTRY_DSN est renseigné). Même origine : aucun domaine tiers dans la page.
import { reportError } from "../../../lib/monitor.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const seen = new Map<string, { n: number; t: number }>();
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
  // Limite simple par adresse : 20 rapports par 10 minutes.
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  const now = Date.now(),
    s = seen.get(ip);
  if (s && now - s.t < 600000 && s.n >= 20) return new Response(null, { status: 429 });
  seen.set(ip, s && now - s.t < 600000 ? { n: s.n + 1, t: s.t } : { n: 1, t: now });
  if (seen.size > 5000) seen.clear();
  let body: any = {};
  try {
    const text = await request.text();
    if (text.length > 8000) return new Response(null, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!process.env.SENTRY_DSN) return new Response(null, { status: 204 });
  await reportError(process.env as any, {
    message: String(body.message || ""),
    stack: String(body.stack || ""),
    source: "browser",
    path: String(body.path || ""),
  });
  return new Response(null, { status: 204 });
}
