import { studioEnv } from "../../../../lib/vercel-env.mjs";
import { runWeeklyMail } from "../../../../lib/studio-mail.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Vercel sends GET /api/cron/weekly and Authorization: Bearer $CRON_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || req.headers.get("authorization") !== "Bearer " + secret)
    return new Response("Refusé", { status: 403 });
  if (process.env.EMAIL_DELIVERY_ENABLED !== "true" || process.env.MAIL_WEEKLY_ENABLED !== "true")
    return Response.json({ sent: false, reason: "rappel désactivé" });
  try {
    return Response.json(await runWeeklyMail(studioEnv()));
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: e.status || 503 });
  }
}
