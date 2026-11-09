import type { NextConfig } from "next";

// En-têtes de sécurité appliqués à toutes les pages et routes (interdiction d'affichage dans un cadre,
// HTTPS strict, politique de sécurité du contenu adaptée à Supabase, au moteur vidéo WebAssembly et à Turnstile).
function supabaseOrigins() {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
    const ws = (u.protocol === "https:" ? "wss://" : "ws://") + u.host;
    return [u.origin, ws];
  } catch {
    return [];
  }
}
export function securityHeaders() {
  const dev = process.env.NODE_ENV !== "production";
  const supa = ["https://*.supabase.co", "wss://*.supabase.co", ...supabaseOrigins()].join(" ");
  const turnstile = "https://challenges.cloudflare.com";
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: ${turnstile}${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${supa}`,
    `media-src 'self' blob: data: ${supa}`,
    "font-src 'self' data:",
    `connect-src 'self' blob: data: ${supa} ${turnstile}`,
    "worker-src 'self' blob:",
    `frame-src ${turnstile}`,
    "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=()" },
  ];
}

const config: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Aucune image n'utilise next/image : l'optimiseur d'images (sujet à plusieurs failles) est désactivé.
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders() }];
  },
};
export default config;
