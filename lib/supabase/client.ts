"use client";
import { createBrowserClient } from "@supabase/ssr";
export function createSupabaseBrowser() {
  // Cookies de session : Secure en HTTPS, SameSite=Lax. (Le client navigateur doit pouvoir les lire : pas HttpOnly ;
  // la politique de sécurité du contenu réduit le risque de vol par script.)
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: {
      secure: typeof window !== "undefined" && window.location.protocol === "https:",
      sameSite: "lax",
      path: "/",
    },
  });
}
