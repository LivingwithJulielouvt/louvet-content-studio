"use client";
// Vérification anti-robot Cloudflare Turnstile, facultative : rien ne s'affiche si NEXT_PUBLIC_TURNSTILE_SITE_KEY est vide.
import { useEffect, useRef } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
export const turnstileEnabled = !!SITE_KEY;

export default function Turnstile({ onToken, lang }: { onToken: (t: string) => void; lang: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!SITE_KEY || !box.current) return;
    let id: string | undefined;
    const render = () => {
      const w = (window as any).turnstile;
      if (!w || !box.current || id) return;
      id = w.render(box.current, {
        sitekey: SITE_KEY,
        language: lang,
        callback: (t: string) => onToken(t),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    };
    if ((window as any).turnstile) render();
    else {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = render;
      document.head.appendChild(s);
    }
    return () => {
      try {
        if (id) (window as any).turnstile?.remove(id);
      } catch {}
    };
  }, [lang, onToken]);
  if (!SITE_KEY) return null;
  return <div ref={box} className="lp-turnstile" />;
}
