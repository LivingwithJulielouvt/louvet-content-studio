import type { MetadataRoute } from "next";

// Studio installable sur l'écran d'accueil. Sur Android, il apparaît dans le menu « Partager » d'Instagram :
// le lien partagé ouvre « Recréer ce post » avec le lien déjà collé (?recreate=…).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Louvet Content Studio",
    short_name: "Louvet Studio",
    start_url: "/studio",
    scope: "/",
    display: "standalone",
    background_color: "#F6F1E9",
    theme_color: "#7A5240",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
    // Partage Android (Web Share Target) : Instagram envoie le lien dans « url » ou dans « text ».
    share_target: {
      action: "/studio",
      method: "GET",
      params: { title: "title", text: "text", url: "recreate" },
    },
  } as MetadataRoute.Manifest;
}
