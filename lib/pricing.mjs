// Prix du studio et de l'offre complète, par pays.
// ➜ Pour changer un prix, il suffit de modifier les montants ci-dessous (et le prix correspondant dans Stripe).
export const REGIONS = ["FR", "MX", "US"];

export const PRICING = {
  FR: {
    label: { fr: "France", es: "Francia", en: "France" },
    currency: "EUR",
    studio: 89, // accès à la plateforme, par mois
    studioYear: 890, // abonnement annuel : 10 mois payés, 2 mois offerts
    offer: 900, // offre complète de l'agence, par mois
    offerCurrency: "USD",
    offerAds: 150, // dont budget publicitaire inclus
    referral: 10, // remise parrainage, dans la devise du studio
    reelCollab: 2, // remise par Reel publié en collaboration avec @withjulielouvet
  },
  MX: {
    label: { fr: "Mexique", es: "México", en: "Mexico" },
    currency: "MXN",
    studio: 1800,
    studioYear: 18000,
    offer: 900,
    offerCurrency: "USD",
    offerAds: 150,
    referral: 200,
    reelCollab: 40,
  },
  US: {
    label: { fr: "États-Unis", es: "Estados Unidos", en: "United States" },
    currency: "USD",
    studio: 120,
    studioYear: 1200,
    offer: 1400,
    offerCurrency: "USD",
    offerAds: 150,
    referral: 10,
    reelCollab: 2,
  },
};
// Nombre maximum de Reels remboursés par client et par mois (mois de validation par l'agence).
export const reelCollabMaxPerMonth = 10;
// Compte Instagram avec lequel le Reel doit être publié en collaboration.
export const REEL_COLLAB_ACCOUNT = "withjulielouvet";

export const normRegion = (x) => (REGIONS.includes(x) ? x : "MX");
/** Pays proposé par défaut selon la langue choisie : français → France, espagnol → Mexique, anglais → États-Unis. */
export const regionForLanguage = (lang) => (lang === "fr" ? "FR" : lang === "en" ? "US" : "MX");

const locales = { fr: "fr-FR", es: "es-MX", en: "en-US" };
/** Affiche un montant : « 89 € », « $1,800 MXN », « $120 USD ». */
export function formatMoney(amount, currency, lang = "fr") {
  const s = new Intl.NumberFormat(locales[lang] || "fr-FR", {
    style: "currency",
    currency,
    currencyDisplay: currency === "EUR" ? "symbol" : "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(amount);
  return currency === "EUR" ? s : s + "\u00a0" + currency; // espace insécable : « $120 USD » ne se coupe pas
}
export const studioPrice = (region, lang) => {
  const p = PRICING[normRegion(region)];
  return formatMoney(p.studio, p.currency, lang);
};
export const offerPrice = (region, lang) => {
  const p = PRICING[normRegion(region)];
  return { amount: formatMoney(p.offer, p.offerCurrency, lang), ads: formatMoney(p.offerAds, p.offerCurrency, lang) };
};
/** Remise de parrainage pour un pays : montant en centimes + devise Stripe (minuscules). */
export const referralReward = (region) => {
  const p = PRICING[normRegion(region)];
  return { cents: Math.round(p.referral * 100), currency: p.currency.toLowerCase(), amount: p.referral };
};
/** Montant en centimes + devise (« eur », « mxn »…) → texte localisé. */
export const formatCents = (cents, currency, lang = "fr") =>
  formatMoney(Number(cents || 0) / 100, String(currency || "usd").toUpperCase(), lang);
/** Remise par Reel en collaboration pour un pays : montant en centimes + devise Stripe (minuscules). */
export const reelCollabReward = (region) => {
  const p = PRICING[normRegion(region)];
  return { cents: Math.round(p.reelCollab * 100), currency: p.currency.toLowerCase(), amount: p.reelCollab };
};
/** Abonnement annuel (2 mois offerts) : « 890 € », et l'équivalent mensuel arrondi « 74 € ». */
export const studioYearPrice = (region, lang) => {
  const p = PRICING[normRegion(region)];
  return { year: formatMoney(p.studioYear, p.currency, lang), perMonth: formatMoney(Math.floor(p.studioYear / 12), p.currency, lang) };
};
