import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
const publicPaths = new Set([
  "/",
  "/connexion",
  "/souscrire",
  "/conditions",
  "/confidentialite",
  "/mentions-legales",
  "/api/studio/public-info",
  "/api/studio/subscription-request",
  "/api/studio/stripe-webhook",
  "/api/cron/weekly",
  "/api/cron/daily",
  "/mail/unsubscribe",
  "/auth/logout",
  "/api/monitor",
]);
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (
    publicPaths.has(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/media-engine/") ||
    // Mesure d’audience Vercel (sans cookie), si elle est activée.
    pathname.startsWith("/_vercel/insights/") ||
    // Fichiers statiques seulement : une extension ajoutée à une route d’API ne dispense jamais de session.
    (!pathname.startsWith("/api/") && !pathname.startsWith("/auth/") && /\.[a-z0-9]{2,6}$/i.test(pathname))
  )
    return NextResponse.next();
  let response = NextResponse.next({ request });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    return NextResponse.redirect(new URL("/connexion", request.url));
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: { secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/" },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values: { name: string; value: string; options?: any }[]) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user?.id || !user.email_confirmed_at) {
    if (pathname.startsWith("/api/")) return Response.json({ error: "Session requise." }, { status: 401 });
    const url = new URL("/connexion", request.url);
    // Le lien partagé depuis Instagram (?recreate=…) survit à la connexion (filtré par studioDestination).
    url.searchParams.set("next", pathname === "/studio" && request.nextUrl.searchParams.has("recreate") ? "/studio?recreate=" + encodeURIComponent(request.nextUrl.searchParams.get("recreate") || "") : "/studio");
    return NextResponse.redirect(url);
  }
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
