"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { studioLoginPath } from "../lib/studio-navigation.mjs";
import { publicCopy } from "../lib/public-site-copy.mjs";
import { homeCopy, cmPrice, work, AGENCY_URL } from "../lib/home-copy.mjs";
import { LANGS, type Lang, isLang, readStoredLang, storeLang, browserLang, LanguageSwitcher } from "../lib/i18n";
import { PRICING, REGIONS, normRegion, regionForLanguage, studioPrice, studioYearPrice } from "../lib/pricing.mjs";
import { LEGAL_UI, LEGAL_SLUGS } from "../lib/legal-copy.mjs";
import Turnstile from "./turnstile";
type Language = Lang;
type Profile = { first_name: string; email: string; name: string; workspaceType: string };
const blank: Profile = { first_name: "", email: "", name: "", workspaceType: "brand" };

/** Visuel de réalisation : affiche l'image si elle existe dans public/realisations/, sinon un emplacement sobre. */
function WorkImage({ file, label, fallback }: { file: string; label: string; fallback: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div className="h-work-fallback" role="img" aria-label={label}>
      <span>{label}</span>
      <small>{fallback}</small>
    </div>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={"/realisations/" + file} alt={label} loading="lazy" onError={() => setFailed(true)} />
  );
}

export default function PublicSite({
  initialView = "home",
  initialLanguage = "fr",
  initialBeta = false,
  authenticatedEmail = "",
  initialCountry,
}: {
  initialCountry?: string;
  initialView?: "home" | "form";
  initialLanguage?: Language;
  initialBeta?: boolean;
  authenticatedEmail?: string;
}) {
  const [language, setLanguage] = useState<Language>(initialLanguage),
    [profile, setProfile] = useState<Profile>({ ...blank, email: authenticatedEmail }),
    [instagram, setInstagram] = useState(""),
    [note, setNote] = useState(""),
    [consent, setConsent] = useState(false),
    [consentHint, setConsentHint] = useState(false),
    consentRef = useRef<HTMLInputElement>(null),
    tsToken = useRef(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState(""),
    [beta, setBeta] = useState(initialBeta),
    [website, setWebsite] = useState(""),
    [referral, setReferral] = useState(""),
    // Pays de l'activité (France, Mexique, États-Unis) : accompagne la demande, sans prix affiché.
    [country, setCountry] = useState<string>(
      REGIONS.includes(initialCountry || "") ? (initialCountry as string) : regionForLanguage(initialLanguage),
    ),
    [countryTouched, setCountryTouched] = useState(REGIONS.includes(initialCountry || "")),
    // Bandeau « Ce site est aussi disponible en… » quand la langue a été devinée d'après le navigateur.
    [langBanner, setLangBanner] = useState(false);
  const nonce = useRef(""),
    attempt = useRef(""),
    heading = useRef<HTMLHeadingElement>(null);
  const t = publicCopy[language],
    legal = (LEGAL_UI as Record<string, any>)[language],
    h = homeCopy[language],
    isForm = initialView === "form";
  // Un seul prix affiché : celui du pays associé à la langue (français → France, espagnol → Mexique, anglais → États-Unis).
  const price = studioPrice(regionForLanguage(language), language),
    fill = (s: string) => s.replaceAll("{price}", price).replaceAll("{cm}", cmPrice[language]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search),
      ref = params.get("ref"),
      l = params.get("lang"),
      stored = readStoredLang();
    if (ref) setReferral(ref.toUpperCase().slice(0, 24));
    if (isLang(l)) applyLanguage(l, false);
    else if (stored) applyLanguage(stored, false);
    else {
      applyLanguage(browserLang() || "fr", false);
      if (!isForm) setLangBanner(true);
    }
    fetch("/api/studio/public-info")
      .then((r) => r.json())
      .then((d: any) => setBeta(!!d.beta))
      .catch(() => {});
    if (isForm) loadNonce();
  }, []);
  const setTsToken = useCallback((t: string) => {
    tsToken.current = t;
  }, []);
  async function loadNonce() {
    try {
      const r = await fetch("/api/studio/subscription-request", { cache: "no-store" });
      const d: any = await r.json();
      if (!r.ok) throw Error(t.error);
      nonce.current = d.nonce;
      attempt.current = crypto.randomUUID();
    } catch {
      setError(t.error);
    }
  }
  function applyLanguage(l: Language, remember = true) {
    setLanguage(l);
    document.documentElement.lang = l;
    if (!countryTouched) setCountry(regionForLanguage(l));
    if (remember) storeLang(l);
  }
  function setLang(l: Language) {
    applyLanguage(l);
    setLangBanner(false);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", l);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }
  function closeBanner() {
    storeLang(language);
    setLangBanner(false);
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy || receipt) return;
    if (!consent) {
      setConsentHint(true);
      consentRef.current?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (!nonce.current) await loadNonce();
      const r = await fetch("/api/studio/subscription-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Studio-Request": "1" },
        body: JSON.stringify({
          ...profile,
          instagram: instagram.trim() || undefined,
          message: note.trim() || undefined,
          language,
          country,
          consent,
          website,
          referral_code: referral.trim() || undefined,
          nonce: nonce.current,
          request_key: attempt.current,
          turnstile: tsToken.current || undefined,
        }),
      });
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error || t.error);
      setReceipt(d.mail || "held");
      heading.current?.focus();
    } catch (e: any) {
      setError(e.message || t.error);
    } finally {
      setBusy(false);
    }
  }
  const subscribeUrl = "/souscrire?lang=" + language,
    loginUrl = studioLoginPath("/studio", language);
  const label = (x: string | Record<string, string>) => (typeof x === "string" ? x : x[language]);
  return (
    <div className="louvet-public h-site" lang={language} data-public-view={initialView}>
      {langBanner && (
        <div className="h-langbar" role="region" aria-label="Langue · Idioma · Language">
          <span>{h.langBanner}</span>
          {LANGS.filter((x) => x.code !== language).map((x) => (
            <button key={x.code} type="button" lang={x.code} onClick={() => setLang(x.code)}>
              {x.label}
            </button>
          ))}
          <button type="button" className="h-langbar-close" aria-label={h.langBannerClose} onClick={closeBanner}>
            ×
          </button>
        </div>
      )}
      {beta && <div className="lp-beta">{t.beta}</div>}
      <header className="h-header">
        <a href={"/?lang=" + language} className="h-logo" aria-label="Louvet & Partners">
          louvet<span>& partners</span>
        </a>
        {!isForm && (
          <nav className="h-nav" aria-label={t.navLabel}>
            {h.nav.map(([href, text]: string[]) => (
              <a key={href} href={href}>
                {text}
              </a>
            ))}
          </nav>
        )}
        <div className="h-header-end">
          <LanguageSwitcher value={language} onChange={setLang} className="lp-language" />
          <a className="h-login" href={loginUrl} target="_top">
            <span className="h-login-long">{h.login}</span>
            <span className="h-login-short">{h.loginShort}</span>
          </a>
          {!isForm && (
            <a className="h-btn h-btn-primary h-btn-small" href={subscribeUrl}>
              {h.start}
            </a>
          )}
        </div>
      </header>
      {isForm ? (
        <main className="lp-form-main h-form-main">
          <a className="lp-back" href={"/?lang=" + language}>
            {t.back}
          </a>
          <div className="lp-form-intro">
            <h1 ref={heading} tabIndex={-1}>
              {receipt ? t.receivedTitle : t.formTitle}
            </h1>
            <p>{receipt ? t.received : t.shortIntro}</p>
          </div>
          {receipt ? (
            <section className="lp-receipt" role="status">
              <span aria-hidden="true">✓</span>
              <p>{receipt === "sent" ? t.sent : receipt === "held" ? t.held : t.mailPending}</p>
              <p>{t.access}</p>
              <a className="h-btn h-btn-ghost" href={"/?lang=" + language}>
                {t.back}
              </a>
            </section>
          ) : (
            <form className="lp-form h-form" onSubmit={send}>
              <div className="h-form-grid">
                {(["first_name", "email", "name"] as const).map((key, i) => (
                  <label key={key}>
                    {[t.firstName, t.email, t.name][i]}
                    <input
                      name={key}
                      type={key === "email" ? "email" : "text"}
                      required
                      maxLength={key === "email" ? 254 : key === "name" ? 120 : 80}
                      readOnly={key === "email" && !!authenticatedEmail}
                      autoComplete={key === "first_name" ? "given-name" : key === "email" ? "email" : "organization"}
                      value={profile[key]}
                      onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                    />
                  </label>
                ))}
                <label>
                  {t.country}
                  <select
                    value={country}
                    name="country"
                    onChange={(e) => {
                      setCountry(normRegion(e.target.value));
                      setCountryTouched(true);
                    }}
                  >
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {(PRICING as any)[r].label[language]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t.kind}
                  <select
                    value={profile.workspaceType}
                    onChange={(e) => setProfile({ ...profile, workspaceType: e.target.value })}
                  >
                    <option value="brand">{t.brand}</option>
                    <option value="creator">{t.creator}</option>
                  </select>
                </label>
                <label>
                  {t.instagram}
                  <input
                    name="instagram"
                    type="text"
                    maxLength={200}
                    autoComplete="url"
                    placeholder="@"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                  />
                  <small>{t.instagramHint}</small>
                </label>
                <label className="h-form-wide">
                  {t.message}
                  <textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
                <label>
                  {t.referral}
                  <input
                    type="text"
                    maxLength={24}
                    autoComplete="off"
                    value={referral}
                    onChange={(e) => setReferral(e.target.value.toUpperCase())}
                    placeholder="MARQUE-AB12"
                  />
                </label>
              </div>
              <Turnstile lang={language} onToken={setTsToken} />
              <label className="lp-consent">
                <input
                  ref={consentRef}
                  type="checkbox"
                  checked={consent}
                  aria-describedby={consentHint ? "lp-consent-hint" : undefined}
                  onChange={(e) => {
                    setConsent(e.target.checked);
                    if (e.target.checked) setConsentHint(false);
                  }}
                />
                <span>{t.consent}</span>
              </label>
              {consentHint && (
                <p className="lp-error" id="lp-consent-hint" role="alert">
                  {t.consentNeeded}
                </p>
              )}
              <p className="lp-small lp-legal-links">
                {legal.consent}{" "}
                <a href={"/conditions?lang=" + language} target="_blank" rel="noopener">
                  {legal.links.conditions.toLowerCase()}
                </a>{" "}
                {legal.and}{" "}
                <a href={"/confidentialite?lang=" + language} target="_blank" rel="noopener">
                  {legal.privacyPolicy}
                </a>
                .
              </p>
              <p className="lp-small">{t.privacy}</p>
              <div className="lp-trap" aria-hidden="true">
                <label>
                  Website
                  <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                </label>
              </div>
              {error && (
                <p className="lp-error" role="alert">
                  {error}
                </p>
              )}
              <button className="h-btn h-btn-primary" type="submit" disabled={busy}>
                {busy ? t.sending : t.submit}
              </button>
              <p className="lp-small h-form-note">{t.shortNote}</p>
            </form>
          )}
        </main>
      ) : (
        <main className="h-main">
          <section className="h-hero">
            <div className="h-hero-copy">
              <h1>{h.heroTitle}</h1>
              <p className="h-sub">{h.heroSub}</p>
              <ul className="h-stats">
                {h.heroStats.map(([n, text]: string[]) => (
                  <li key={text}>
                    <b aria-hidden={n === "✓" ? true : undefined}>{n}</b>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
              <p className="h-lead">{h.heroText}</p>
              <div className="h-hero-actions">
                <a className="h-btn h-btn-primary" href={subscribeUrl}>
                  {h.start}
                </a>
                <span className="h-hero-login">
                  {h.already}{" "}
                  <a href={loginUrl} target="_top">
                    {h.login}
                  </a>
                </span>
              </div>
              <p className="h-small">{h.heroNote}</p>
            </div>
            <figure className="h-delivery">
              <div className="h-delivery-head">
                <span className="h-stamp" aria-hidden="true">
                  3
                </span>
                <div>
                  <b>{h.deliveryLabel}</b>
                  <small>{h.deliveryDate}</small>
                </div>
              </div>
              <div className="h-delivery-grid">
                {work.map((w) => (
                  <WorkImage key={w.file} file={w.file} label={label(w.brand)} fallback={w.kind[language]} />
                ))}
              </div>
              <figcaption>
                <span aria-hidden="true">✓</span> {h.deliveryCheck}
              </figcaption>
            </figure>
          </section>

          <section className="h-section h-receive" id="recu">
            <h2>{h.receiveTitle}</h2>
            <ul>
              {h.receive.map(([title, text]: string[]) => (
                <li key={title}>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="h-human" id="methode">
            <div className="h-human-inner">
              <div className="h-human-intro">
                <h2>{h.humanTitle}</h2>
                <p>{h.humanText}</p>
              </div>
              <ol className="h-method">
                {h.method.map(([title, text]: string[]) => (
                  <li key={title}>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="h-section h-compare">
            <h2>{h.compareTitle}</h2>
            <div className="h-compare-grid">
              {h.compare.map(([title, text]: string[], i: number) => (
                <div key={title} className={i === 2 ? "h-compare-us" : ""}>
                  <h3>{title}</h3>
                  <p>{fill(text)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="h-section h-work">
            <div className="h-work-head">
              <h2>{h.workTitle}</h2>
              <p>{h.workText}</p>
            </div>
            <div className="h-work-grid">
              {work.map((w) => (
                <figure key={w.file}>
                  <WorkImage file={w.file} label={label(w.brand)} fallback={h.workFallback} />
                  <figcaption>
                    <b>{label(w.brand)}</b> {w.kind[language]}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section className="h-section h-story" id="histoire">
            <div className="h-story-text">
              <h2>{h.storyTitle}</h2>
              {h.story.map((p: string) => (
                <p key={p.slice(0, 24)}>{fill(p)}</p>
              ))}
              <p className="h-signature">{h.signature}</p>
            </div>
            <aside className="h-refs">
              <p>{h.refsTitle}</p>
              <ul className="h-refs-big">
                {h.refsBig.map((r: string) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <ul className="h-refs-small">
                {h.refsSmall.map((r: string) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <a className="h-agency-link" href={AGENCY_URL} target="_blank" rel="noopener">
                {h.agencyLink} ↗
              </a>
            </aside>
          </section>

          <section className="h-section h-price" id="tarif">
            <div>
              <h2>{h.priceTitle}</h2>
              <p>{fill(h.priceText)}</p>
              <p className="h-small">{h.priceNote}</p>
            </div>
            <div className="h-price-card">
              {beta && (
                <p className="h-price-beta">
                  {language === "es"
                    ? "Gratis durante la fase de prueba · plazas limitadas"
                    : language === "en"
                      ? "Free during the testing phase · limited spots"
                      : "Gratuit pendant la phase de test · places limitées"}
                </p>
              )}
              <p className={"h-price-value" + (beta ? " is-beta" : "")}>
                {price}
                <small>{h.monthly}</small>
              </p>
              {/* Annuel : seulement dans la devise de la langue de la page (jamais les prix des autres pays). */}
              {!beta && <p className="h-price-year">
                {(() => {
                  const y = studioYearPrice(regionForLanguage(language), language);
                  return language === "es"
                    ? `o ${y.year}/año (2 meses gratis)`
                    : language === "en"
                      ? `or ${y.year}/year (2 months free)`
                      : `ou ${y.year}/an (2 mois offerts)`;
                })()}
              </p>}
              <ul>
                {h.included.map((item: string) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <a className="h-btn h-btn-primary" href={subscribeUrl}>
                {beta
                  ? language === "es"
                    ? "Pedir mi acceso gratis"
                    : language === "en"
                      ? "Request free access"
                      : "Demander mon accès gratuit"
                  : h.start}
              </a>
              {beta && <p className="h-small">{t.betaNote}</p>}
            </div>
          </section>

          <section className="h-section h-faq" id="faq">
            <h2>{h.faqTitle}</h2>
            <div>
              {h.faqs.map(([q, a]: string[]) => (
                <details key={q}>
                  <summary>
                    {q}
                    <span aria-hidden="true">+</span>
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="h-final">
            <h2>{h.endTitle}</h2>
            <p>{h.endText}</p>
            <a className="h-btn h-btn-light" href={subscribeUrl}>
              {h.start}
            </a>
          </section>
        </main>
      )}
      <footer className="h-footer">
        <a href={"/?lang=" + language} className="h-logo">
          louvet<span>& partners</span>
        </a>
        <p>{h.footer}</p>
        <div className="h-footer-links">
          <a href={AGENCY_URL} target="_blank" rel="noopener">
            louvetpartners.com ↗
          </a>
          <a href={loginUrl} target="_top">
            {h.login}
          </a>
          {LEGAL_SLUGS.map((s: string) => (
            <a key={s} href={`/${s}?lang=${language}`}>
              {legal.links[s]}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}
