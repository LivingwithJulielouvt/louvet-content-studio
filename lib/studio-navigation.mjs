// Only these destinations may follow sign-in. Never accept off-site return URLs.
export function studioDestination(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/studio";
  try {
    const u = new URL(value, "https://studio.local");
    if (u.origin !== "https://studio.local" || !["/studio", "/souscrire"].includes(u.pathname)) return "/studio";
    const l = u.searchParams.get("lang");
    const out = new URLSearchParams();
    if (l === "es" || l === "en") out.set("lang", l);
    // « Recréer ce post » : un lien Instagram reçu avant la connexion est gardé (et revérifié par le studio).
    const r = u.searchParams.get("recreate") || "";
    if (u.pathname === "/studio" && /^https:\/\/(www\.|m\.)?instagram\.com\/[A-Za-z0-9_\-\/.?=&%]{1,200}$/.test(r)) out.set("recreate", r);
    const qs = out.toString();
    return u.pathname + (qs ? "?" + qs : "");
  } catch {
    return "/studio";
  }
}
/** @param {string} [destination] @param {string|null} [language] */
export function studioLoginPath(destination = "/studio", language = null) {
  language = language ?? new URL(studioDestination(destination), "https://studio.local").searchParams.get("lang");
  return (
    "/connexion?next=" +
    encodeURIComponent(studioDestination(destination)) +
    "&lang=" +
    (language === "es" || language === "en" ? language : "fr")
  );
}
