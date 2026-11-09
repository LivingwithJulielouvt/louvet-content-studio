// Catalogue unique des modèles : modèles à calques + modèles classiques (texte, services, montages tendance),
// avec un seul jeu de filtres (format, intention, ambiance). Les doublons proches ne sont montrés qu'une fois.
import { TEMPLATES } from "./templates.mjs";
import { INTENTS, LAYER_TEMPLATES, fitsPickFormat, rankTemplates } from "./layer-templates.mjs";

const t3 = (fr, es, en) => ({ fr, es, en });
export const TEXT_INTENT = { id: "text", emoji: "🔤", label: t3("Texte seul", "Solo texto", "Text only") };
/** Intentions des créatrices (celles des modèles à calques + « Texte seul »). */
export const CREATOR_INTENTS = [...INTENTS, TEXT_INTENT];
/** Intentions des marques. */
export const BRAND_INTENTS = [
  { id: "product", emoji: "🛍️", label: t3("Produit", "Producto", "Product") },
  { id: "offer", emoji: "🏷️", label: t3("Offre / promo", "Oferta / promo", "Offer / promo") },
  { id: "review", emoji: "⭐", label: t3("Avis client", "Opinión de cliente", "Customer review") },
  { id: "bts", emoji: "🎬", label: t3("Coulisses", "Detrás de cámaras", "Behind the scenes") },
  { id: "tips", emoji: "💡", label: t3("Conseil", "Consejo", "Tip") },
  TEXT_INTENT,
  { id: "beforeafter", emoji: "↔️", label: t3("Avant / après", "Antes / después", "Before / after") },
  { id: "event", emoji: "📅", label: t3("Événement", "Evento", "Event") },
];
// Pour une marque, quelles intentions « créatrice » des modèles à calques correspondent à chaque intention marque.
const BRAND_LAYER_MAP = {
  product: ["outfit", "dump"],
  offer: [],
  review: [],
  bts: ["bts", "day"],
  tips: ["tips", "list"],
  beforeafter: ["beforeafter"],
  event: ["travel"],
};
// Doublons proches : on garde une seule version dans le catalogue (les visuels déjà enregistrés restent modifiables).
export const HIDDEN_FROM_CATALOGUE = ["e-beforeafter", "t-day", "t-recipe", "t-split"];

// Modèles classiques : intentions, formats du sélecteur, ambiance.
const CLASSIC = {
  quote: { intents: ["text", "quote"], mood: "minimal" },
  announce: { intents: ["text", "offer", "event"], mood: "editorial" },
  tip: { intents: ["text", "tips"], mood: "minimal" },
  list: { intents: ["text", "list", "tips"], mood: "minimal" },
  question: { intents: ["text", "tips"], mood: "fun" },
  number: { intents: ["text", "tips"], mood: "editorial" },
  carousel: { intents: ["text", "tips", "list"], mood: "minimal", carousel: true },
  beforeAfter: { intents: ["beforeafter"], mood: "minimal" },
  portfolio: { intents: ["product", "dump"], mood: "editorial" },
  collage: { intents: ["product", "dump"], mood: "fun" },
  behind: { intents: ["bts"], mood: "minimal" },
  steps: { intents: ["tips", "list"], mood: "editorial" },
  offer: { intents: ["offer", "product"], mood: "editorial" },
  review: { intents: ["review"], mood: "minimal" },
  "t-film": { intents: ["dump", "day"], mood: "fun", carouselToo: true },
  "t-polaroid": { intents: ["dump", "travel"], mood: "fun" },
  "t-scrap": { intents: ["dump", "travel"], mood: "fun", carouselToo: true },
  "t-mag": { intents: ["product", "tips"], mood: "editorial", cover: true },
  "t-dump": { intents: ["dump"], mood: "fun", carouselToo: true },
  "t-mood": { intents: ["outfit", "dump"], mood: "luxe" },
  "t-minimal": { intents: ["quote", "product"], mood: "minimal", cover: true },
  "t-digicam": { intents: ["day", "dump"], mood: "fun", cover: true },
  "t-ootd": { intents: ["outfit", "product"], mood: "editorial", cover: true },
  "t-ticket": { intents: ["travel", "event"], mood: "luxe" },
  "t-blurquote": { intents: ["quote", "text"], mood: "luxe", cover: true },
  "t-pano": { intents: ["travel", "dump"], mood: "editorial", carousel: true },
};
/** Formats du sélecteur (story, reel, post, carousel) où le modèle classique peut servir. */
function classicFormats(id, meta) {
  if (meta.carousel) return ["carousel"];
  const out = ["story", "post"];
  if (meta.cover) out.push("reel");
  if (meta.carouselToo) out.push("carousel");
  return out;
}
/** Entrées classiques du catalogue (hors modèles masqués par l'agence et doublons). */
export function classicEntries(config = {}) {
  const hidden = new Set([...(Array.isArray(config.hiddenTemplates) ? config.hiddenTemplates : []), ...HIDDEN_FROM_CATALOGUE]);
  return TEMPLATES.filter((t) => !hidden.has(t.id) && CLASSIC[t.id]).map((t) => {
    const meta = CLASSIC[t.id];
    return {
      id: t.id,
      kind: "classic",
      name: t.name,
      intents: meta.intents,
      mood: meta.mood,
      formats: classicFormats(t.id, meta),
      photos: t.photos,
    };
  });
}
const fitsPhotos = (range, count) => !count || (range[0] <= count && count <= range[1]) || (range[1] > 0 && Math.abs(range[1] - count) <= 1);

/**
 * Le catalogue filtré, dans l'ordre d'affichage : { forYou, rest } où chaque entrée est
 * { kind: "layer", t } ou { kind: "classic", e }. Déterministe.
 */
export function catalogue(config = {}, { brand = false, favorites = [], recent = [], format = "story", intent = "", photoCount = 0 } = {}) {
  const layerOk = (t) => {
    if (HIDDEN_FROM_CATALOGUE.includes(t.id)) return false;
    if (!intent) return true;
    if (intent === "text") return t.photos === 0;
    if (brand) return t.intents.some((i) => (BRAND_LAYER_MAP[intent] || []).includes(i));
    return t.intents.includes(intent);
  };
  const plainIntent = !brand && intent && intent !== "text" ? intent : "";
  const layers = rankTemplates(config, { favorites, recent, format, intent: plainIntent, photoCount }).filter(layerOk);
  const classics = classicEntries(config).filter(
    (e) => e.formats.includes(format) && (!intent || e.intents.includes(intent)) && fitsPhotos(e.photos, photoCount),
  );
  const fav = (id) => favorites.indexOf(id);
  const all = [
    ...layers.map((t, i) => ({ kind: "layer", id: t.id, t, mood: t.mood, score: (fav(t.id) >= 0 ? 1000 - fav(t.id) : 0) + (layers.length - i) })),
    ...classics.map((e, i) => ({ kind: "classic", id: e.id, e, mood: e.mood, score: (fav(e.id) >= 0 ? 1000 - fav(e.id) : 0) + (brand ? classics.length - i + layers.length : 0) - i * 0.01 })),
  ];
  const ranked = [...all].sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  const forYou = ranked.slice(0, 6);
  const rest = all.filter((x) => !forYou.includes(x));
  return { forYou, rest, total: all.length };
}
export const allCatalogueIds = () => [...LAYER_TEMPLATES.map((t) => t.id), ...TEMPLATES.map((t) => t.id)];
export { fitsPickFormat };
