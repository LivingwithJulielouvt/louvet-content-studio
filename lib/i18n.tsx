"use client";
// Langue de l'interface client : français, espagnol ou anglais.
// L'espace agence reste en français ; seuls les écrans vus par les clients changent de langue.
import { createContext, useContext } from "react";

export type Lang = "fr" | "es" | "en";
export const LANGS: { code: Lang; short: string; label: string }[] = [
  { code: "fr", short: "FR", label: "Français" },
  { code: "en", short: "EN", label: "English" },
  { code: "es", short: "ES", label: "Español" },
];
export const isLang = (x: unknown): x is Lang => x === "fr" || x === "es" || x === "en";
export const normLang = (x: unknown): Lang => (isLang(x) ? x : "fr");

/** Choisit le texte dans la bonne langue : pick(lang, "français", "español", "English"). */
export const pick = <T,>(lang: Lang, fr: T, es: T, en: T): T => (lang === "es" ? es : lang === "en" ? en : fr);

/** Format des dates selon la langue. */
export const dateLocale = (lang: Lang) => (lang === "es" ? "es-MX" : lang === "en" ? "en-US" : "fr-FR");

const LangContext = createContext<Lang>("fr");
export const LangProvider = LangContext.Provider;
export const useLang = () => useContext(LangContext);
/** Dans un composant : const L = useL(); puis L("Bonjour", "Hola", "Hello"). */
export function useL() {
  const lang = useContext(LangContext);
  return <T,>(fr: T, es: T, en: T): T => pick(lang, fr, es, en);
}

// Choix mémorisé sur l'appareil (choisi sur la page d'accueil, à la connexion ou dans le studio).
export const LANG_STORAGE_KEY = "louvet-studio-lang";
export function readStoredLang(): Lang | null {
  try {
    const v = window.localStorage.getItem(LANG_STORAGE_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}
export function storeLang(lang: Lang) {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {}
  try {
    document.cookie = LANG_STORAGE_KEY + "=" + lang + ";path=/;max-age=31536000;samesite=lax";
  } catch {}
}
/** Langue préférée du navigateur, si c'est l'une des trois. */
export function browserLang(): Lang | null {
  try {
    for (const l of navigator.languages || [navigator.language]) {
      const c = String(l).slice(0, 2).toLowerCase();
      if (isLang(c)) return c;
    }
  } catch {}
  return null;
}

/** Petit sélecteur FR · EN · ES réutilisable. */
export function LanguageSwitcher({
  value,
  onChange,
  className = "lang-switcher",
}: {
  value: Lang;
  onChange: (l: Lang) => void;
  className?: string;
}) {
  return (
    <div className={className} role="group" aria-label="Langue · Language · Idioma">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          data-language={l.code}
          aria-pressed={value === l.code}
          title={l.label}
          lang={l.code}
          onClick={() => onChange(l.code)}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
