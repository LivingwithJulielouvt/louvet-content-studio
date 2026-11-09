import { handleStudio } from "../../../../lib/studio.mjs";
import { studioEnv } from "../../../../lib/vercel-env.mjs";
import { verifiedStudioUser } from "../../../../lib/supabase/server";
import { translateServerMessage } from "../../../../lib/server-messages.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const open = new Set(["public-info", "subscription-request", "stripe-webhook"]);
// Langue choisie par le client (cookie posé par le sélecteur de langue). L'agence reste en français.
function clientLanguage(request: Request, email?: string | null): "es" | "en" | null {
  const owner = (process.env.AGENCY_OWNER_EMAIL || "").trim().toLowerCase();
  if (email && owner && email.trim().toLowerCase() === owner) return null;
  const match = /(?:^|;\s*)louvet-studio-lang=(es|en)(?:;|$)/.exec(request.headers.get("cookie") || "");
  return match ? (match[1] as "es" | "en") : null;
}
async function translateError(response: Response, lang: "es" | "en"): Promise<Response> {
  try {
    if (response.status < 400 || !(response.headers.get("content-type") || "").includes("application/json"))
      return response;
    const body: any = await response.clone().json();
    if (!body || typeof body.error !== "string") return response;
    const translated = translateServerMessage(body.error, lang);
    if (translated === body.error) return response;
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(JSON.stringify({ ...body, error: translated }), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
}
// Notifications du studio (enregistrées en français) : traduites pour un client en espagnol ou en anglais.
async function translateNotifications(response: Response, lang: "es" | "en"): Promise<Response> {
  try {
    if (!response.ok || !(response.headers.get("content-type") || "").includes("application/json")) return response;
    const body: any = await response.clone().json();
    if (!Array.isArray(body?.notifications)) return response;
    body.notifications = body.notifications.map((n: any) => ({ ...n, message: translateServerMessage(n.message, lang) }));
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(JSON.stringify(body), { status: response.status, headers });
  } catch {
    return response;
  }
}
async function call(request: Request) {
  const action = new URL(request.url).pathname.split("/")[3] || "state";
  const user = open.has(action) ? null : await verifiedStudioUser();
  const lang = clientLanguage(request, user?.email);
  const response = await handleStudio(request, studioEnv(user));
  if (lang && response && action === "state") return translateNotifications(response, lang);
  return lang && response ? translateError(response, lang) : response;
}
export const GET = call;
export const POST = call;
