import { studioEnv } from "../../../lib/vercel-env.mjs";
import { unsubscribeRequest } from "../../../lib/studio-mail.mjs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  try {
    return await unsubscribeRequest(request, studioEnv());
  } catch (e: any) {
    return new Response(e.message, {
      status: e.status || 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}
export const GET = handle;
export const POST = handle;
