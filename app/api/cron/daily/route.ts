import { studioEnv } from "../../../../lib/vercel-env.mjs";
import { runDailyStudio } from "../../../../lib/studio.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
/**
 * Tâche quotidienne (Vercel Cron, 15 h UTC = 9 h à Monterrey) :
 * - à partir du 3 du mois, envoie aux clients les livraisons que l'agence a validées ;
 * - le 25, prépare les 6 contenus du mois suivant si MONTHLY_DELIVERY_AUTO_PREPARE=true.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || req.headers.get("authorization") !== "Bearer " + secret)
    return new Response("Refusé", { status: 403 });
  if (process.env.MONTHLY_DELIVERY_ENABLED !== "true")
    return Response.json({ sent: 0, reason: "livraison mensuelle désactivée" });
  try {
    return Response.json(await runDailyStudio(studioEnv()));
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: e.status || 503 });
  }
}
