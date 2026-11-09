// Pages légales publiques (/conditions, /confidentialite, /mentions-legales) en FR / ES / EN.
// Les textes sont dans lib/legal-copy.mjs. Marqués « Brouillon » tant qu'un juriste ne les a pas validés.
import { LEGAL_PAGES, LEGAL_UI, LEGAL_SLUGS, LEGAL_UPDATED } from "../lib/legal-copy.mjs";

type Lang = "fr" | "es" | "en";
const pages = LEGAL_PAGES as unknown as Record<string, Record<Lang, { title: string; intro: string; sections: [string, string[]][] }>>;
const ui = LEGAL_UI as Record<Lang, any>;

export function legalLang(v: unknown): Lang {
  return v === "es" || v === "en" ? v : "fr";
}

export default function LegalPage({ slug, lang }: { slug: string; lang: Lang }) {
  const page = pages[slug][lang],
    t = ui[lang];
  const updated = new Date(LEGAL_UPDATED + "T12:00:00Z").toLocaleDateString(
    lang === "es" ? "es-MX" : lang === "en" ? "en-US" : "fr-FR",
    { day: "numeric", month: "long", year: "numeric" },
  );
  return (
    <div className="legal-page" lang={lang}>
      <header className="legal-top">
        <a href={"/?lang=" + lang} className="legal-logo">
          louvet<span>& partners</span>
        </a>
        <nav aria-label="Langue">
          {(["fr", "es", "en"] as Lang[]).map((l) => (
            <a key={l} href={`/${slug}?lang=${l}`} aria-current={l === lang ? "true" : undefined}>
              {l.toUpperCase()}
            </a>
          ))}
        </nav>
      </header>
      <main className="legal-main">
        <p className="legal-draft" role="note">
          <b>{t.draft}</b>
          <span>{t.draftNote}</span>
        </p>
        <h1>{page.title}</h1>
        <p className="legal-updated">
          {t.updated} : {updated}
        </p>
        <p className="legal-intro">{page.intro}</p>
        {page.sections.map(([h, paras]) => (
          <section key={h}>
            <h2>{h}</h2>
            {paras.length > 2 && paras.every((p) => p.length < 260) ? (
              <ul>
                {paras.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : (
              paras.map((p) => <p key={p}>{p}</p>)
            )}
          </section>
        ))}
      </main>
      <footer className="legal-footer">
        {LEGAL_SLUGS.map((s: string) => (
          <a key={s} href={`/${s}?lang=${lang}`} aria-current={s === slug ? "page" : undefined}>
            {t.links[s]}
          </a>
        ))}
        <a href={"/?lang=" + lang}>{t.back}</a>
      </footer>
    </div>
  );
}
