import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import ErrorMonitor from "./error-monitor";
// Polices hébergées avec le site (aucun appel à Google Fonts depuis le navigateur des visiteurs).
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./globals.css";
import "./public-site.css";
import "./home.css";
import "./additions.css";
import "./studio-simple.css";
import "./final-ux.css";
export const metadata: Metadata = {
  title: "Louvet Content Studio",
  description: "Votre marque. Vos photos. Du contenu qui vous ressemble.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        {children}
        <ErrorMonitor />
        {/* Mesure d’audience sans cookie ni donnée personnelle : activée seulement si NEXT_PUBLIC_ANALYTICS=vercel. */}
        {process.env.NEXT_PUBLIC_ANALYTICS === "vercel" && <Analytics />}
      </body>
    </html>
  );
}
