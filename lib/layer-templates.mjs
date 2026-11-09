// Modèles de départ de l'éditeur à calques (créatrices de contenu). Tous originaux : ils reprennent
// des codes visuels courants (titres éditoriaux, annotations manuscrites, fausses interfaces de téléphone,
// bulles de message, carrousels continus) sans copier aucun modèle existant ni aucune marque.
import { LAYER_FORMATS, SLIDE_W, layerCanvasSize, sanitizeLayered } from "./layers.mjs";

const t3 = (fr, es, en) => ({ fr, es, en });
export const INTENTS = [
  { id: "tips", emoji: "💡", label: t3("Conseils & astuces", "Consejos y trucos", "Tips & tricks") },
  { id: "day", emoji: "☀️", label: t3("Ma journée", "Mi día", "My day") },
  { id: "outfit", emoji: "👗", label: t3("Ma tenue", "Mi outfit", "My outfit") },
  { id: "recipe", emoji: "🍋", label: t3("Recette", "Receta", "Recipe") },
  { id: "quote", emoji: "🤍", label: t3("Citation / réflexion", "Cita / reflexión", "Quote / thought") },
  { id: "list", emoji: "📝", label: t3("Liste", "Lista", "List") },
  { id: "travel", emoji: "✈️", label: t3("Voyage", "Viaje", "Travel") },
  { id: "beforeafter", emoji: "↔️", label: t3("Avant / après", "Antes / después", "Before / after") },
  { id: "dump", emoji: "📸", label: t3("Photo dump", "Photo dump", "Photo dump") },
  { id: "bts", emoji: "🎬", label: t3("Coulisses", "Detrás de cámaras", "Behind the scenes") },
];
export const MOODS = [
  { id: "minimal", label: t3("Minimal", "Minimal", "Minimal") },
  { id: "editorial", label: t3("Éditorial", "Editorial", "Editorial") },
  { id: "fun", label: t3("Fun", "Divertido", "Fun") },
  { id: "luxe", label: t3("Luxe", "Lujo", "Luxe") },
];
// Formats proposés en haut de l'écran.
export const PICK_FORMATS = [
  { id: "story", label: t3("Story", "Historia", "Story") },
  { id: "reel", label: t3("Couverture de Reel", "Portada de Reel", "Reel cover") },
  { id: "post", label: t3("Publication", "Publicación", "Post") },
  { id: "carousel", label: t3("Carrousel", "Carrusel", "Carousel") },
];

let n = 0;
const id = () => "e" + (n++).toString(36);
// Petites fabriques de calques (coordonnées : centre de l'élément).
const P = (x, y, w, h, o = {}) => ({ id: id(), type: "photo", x, y, w, h, rot: 0, file: "", crop: { x: 0, y: 0, z: 1 }, ...o });
const Tx = (text, x, y, w, h, font, size, color, o = {}) => ({ id: id(), type: "text", x, y, w, h, rot: 0, text, font, size, color, align: "center", lh: 1.05, ...o });
const Bu = (text, x, y, w, h, o = {}) => ({ id: id(), type: "bubble", x, y, w, h, rot: 0, text, font: "body", size: 44, color: "#86CDF5", textColor: "#FFFFFF", tail: "right", sticker: "", ...o });
const La = (text, x, y, w, h, o = {}) => ({ id: id(), type: "label", x, y, w, h, rot: 0, text, font: "body", size: 32, color: "#FFFFFF", textColor: "#1A1A1A", ...o });
const St = (glyph, x, y, s, color, o = {}) => ({ id: id(), type: "sticker", x, y, w: s, h: s, rot: 0, glyph, emoji: "", color, ...o });
const Ar = (x, y, w, h, color, o = {}) => ({ id: id(), type: "arrow", x, y, w, h, rot: 0, color, width: 5, curve: 0.5, ...o });
const Ui = (variant, x, y, w, h, o = {}) => ({ id: id(), type: "ui", x, y, w, h, rot: 0, variant, title: "", text: "", name: "", handle: "", items: [], accent: "#2F80ED", ...o });
const Dd = (variant, x, y, w, h, color, o = {}) => ({ id: id(), type: "doodle", x, y, w, h, rot: 0, variant, color, width: 5, ...o });
const Sh = (shape, x, y, w, h, o = {}) => ({ id: id(), type: "shape", x, y, w, h, rot: 0, shape, color: "", stroke: "", strokeWidth: 0, radius: 0, alpha: 1, ...o });
const Ci = (text, x, y, s, o = {}) => ({ id: id(), type: "circletext", x, y, w: s, h: s, rot: 0, text, font: "lora", size: 40, color: "#FFFFFF", start: 0, ...o });

const pick = (lang, o) => o[lang] || o.fr;
// Photo plein cadre sur une diapo.
const full = (W, H, s = 0) => P(s * SLIDE_W + SLIDE_W / 2, H / 2, SLIDE_W, H);

/**
 * Catalogue. `photos` = nombre d'emplacements ; `slides` = diapos (1 = visuel simple) ;
 * `formats` = formats autorisés ; `cover` = bonne couverture de Reel ; `build(c)` renvoie { bg, layers }.
 */
export const LAYER_TEMPLATES = [
  {
    id: "e-five",
    name: t3("Cinq idées", "Cinco ideas", "Five ideas"),
    intents: ["tips", "list"],
    mood: "editorial",
    photos: 1,
    cover: true,
    build: ({ W, H, T, story }) => ({
      bg: { color: "#1A1A1A" },
      layers: [
        full(W, H),
        Sh("rect", W / 2, H * 0.62, W, H * 0.76, { color: "#000000", alpha: 0.18 }),
        Tx(T("cinq", "cinco", "five"), W / 2, H * (story ? 0.47 : 0.45), 900, 220, "montserrat", 200, "#FFFFFF", { shadow: true }),
        Tx(T("idées de contenu", "ideas de contenido", "content ideas"), W / 2, H * (story ? 0.56 : 0.58), 900, 180, "dancing", 130, "#FFFFFF", { rot: -4, shadow: true }),
        Tx(T("quand vous ne savez pas quoi publier", "cuando no sabes qué publicar", "when you don’t know what to post"), W / 2, H * (story ? 0.65 : 0.7), 700, 90, "body", 34, "#FFFFFF", { upper: true, spacing: 0.12 }),
        St("sparkle", W * 0.8, H * (story ? 0.41 : 0.37), 90, "#FFE9A8"),
      ],
    }),
  },
  {
    id: "e-headline",
    name: t3("Grand titre", "Gran título", "Big headline"),
    intents: ["tips", "bts"],
    mood: "editorial",
    photos: 1,
    cover: true,
    build: ({ W, H, T, story }) => ({
      bg: { color: "#2A2522" },
      layers: [
        full(W, H),
        Ui("selectbar", W * 0.42, H * (story ? 0.38 : 0.33), 560, 74, { items: [T("Copier", "Copiar", "Copy"), T("Tout sélectionner", "Seleccionar todo", "Select all"), T("Partager", "Compartir", "Share")] }),
        Tx(T("Mon rituel", "Mi ritual", "My go-to"), W * 0.45, H * (story ? 0.44 : 0.41), 700, 110, "caveat", 96, "#FFFFFF", { rot: -3, shadow: true }),
        Tx(T("TEXTURES", "TEXTURAS", "TEXTURES"), W / 2, H * (story ? 0.52 : 0.52), 960, 200, "anton", 190, "#FFFFFF", { shadow: true }),
        Tx(T("qui changent tout", "que lo cambian todo", "that change everything"), W * 0.55, H * (story ? 0.6 : 0.63), 760, 110, "dancing", 88, "#F4B6CF", { rot: -4 }),
        St("star", W * 0.2, H * (story ? 0.36 : 0.3), 70, "#F5C542"),
        St("sparkle", W * 0.84, H * (story ? 0.47 : 0.45), 80, "#FFFFFF"),
      ],
    }),
  },
  {
    id: "e-keywords",
    name: t3("Mots-clés fléchés", "Palabras clave con flechas", "Keyword arrows"),
    intents: ["tips", "travel"],
    mood: "fun",
    photos: 1,
    build: ({ W, H, T, story }) => ({
      bg: { color: "#BFD6E8" },
      layers: [
        full(W, H),
        Tx(T("Ne partez pas sans", "No te vayas sin", "Don’t go without"), W / 2, H * (story ? 0.16 : 0.13), 860, 120, "caveat", 100, "#FFFFFF", { shadow: true }),
        Tx(T("ces trois choses", "estas tres cosas", "these three things"), W / 2, H * (story ? 0.22 : 0.21), 860, 110, "caveat", 92, "#FFFFFF", { shadow: true }),
        La(T("Mot-clé", "Palabra clave", "Keyword"), W * 0.24, H * 0.4, 250, 64, { font: "caveat", size: 40, color: "#FFFFFF" }),
        Ar(W * 0.27, H * 0.47, 120, 110, "#FFFFFF", { rot: 95, curve: 0.6 }),
        La(T("Mot-clé", "Palabra clave", "Keyword"), W * 0.78, H * 0.34, 250, 64, { font: "caveat", size: 40, color: "#FFFFFF" }),
        Ar(W * 0.74, H * 0.41, 120, 110, "#FFFFFF", { rot: 160, curve: -0.6 }),
        La(T("Mot-clé", "Palabra clave", "Keyword"), W * 0.3, H * 0.7, 250, 64, { font: "caveat", size: 40, color: "#FFFFFF" }),
        Ar(W * 0.44, H * 0.64, 120, 110, "#FFFFFF", { rot: 10, curve: 0.5 }),
        St("sparkle", W * 0.86, H * 0.12, 70, "#FFFFFF"),
        St("heart", W * 0.12, H * 0.18, 56, "#FFFFFF"),
      ],
    }),
  },
  {
    id: "e-tipcard",
    name: t3("Carte conseil", "Tarjeta consejo", "Tip card"),
    intents: ["tips", "quote"],
    mood: "minimal",
    photos: 1,
    build: ({ W, H, T, story, name, handle }) => ({
      bg: { color: "#E8E2DA" },
      layers: [
        full(W, H),
        Sh("rect", W * 0.62, H * (story ? 0.29 : 0.33), 680, story ? 580 : 560, { color: "#FFFFFF", alpha: 0.86, radius: 34 }),
        Tx(T("La vraie raison pour laquelle votre contenu ne décolle pas", "La verdadera razón por la que tu contenido no despega", "The real reason your content isn’t growing"), W * 0.62, H * (story ? 0.22 : 0.24), 600, 240, "serif", 64, "#1A1A1A", { align: "left", lh: 1.08 }),
        Tx(T("Ce n’est pas une question de quantité, mais d’intention. Publiez moins, publiez mieux.", "No es cuestión de cantidad, sino de intención. Publica menos, publica mejor.", "It’s not about posting more, it’s about posting with purpose."), W * 0.62, H * (story ? 0.36 : 0.42), 600, 170, "body", 34, "#1A1A1A", { align: "left", lh: 1.3 }),
        Ui("profile", W * 0.5, H * (story ? 0.9 : 0.9), 760, 90, { name, handle, dark: false }),
      ],
    }),
  },
  {
    id: "e-thoughts",
    name: t3("Pensées à challenger", "Pensamientos a cuestionar", "Thoughts to challenge"),
    intents: ["list", "quote"],
    mood: "minimal",
    photos: 0,
    build: ({ W, H, T, story, name, handle }) => ({
      bg: { color: "#EDEAE6" },
      layers: [
        Tx(T("5 pensées à challenger quand le doute arrive", "5 pensamientos a cuestionar cuando llega la duda", "5 thoughts to challenge when doubt shows up"), W * 0.4, H * 0.2, 640, 160, "body", 40, "#1A1A1A", { align: "left", lh: 1.2 }),
        Sh("line", W * 0.8, H * 0.18, 180, 3, { stroke: "#1A1A1A", strokeWidth: 3 }),
        Sh("line", W * 0.9, H * (story ? 0.3 : 0.32), H * 0.24, 3, { stroke: "#1A1A1A", strokeWidth: 3, rot: 90 }),
        Tx(
          T(
            "« Je dois tout contrôler. » → Pas vraiment.\n« Tout le monde me juge. » → Rarement.\n« Je n’y arriverai pas. » → Vous le faites déjà.",
            "«Debo controlarlo todo.» → No realmente.\n«Todos me juzgan.» → Rara vez.\n«No lo lograré.» → Ya lo estás haciendo.",
            "“I have to control everything.” → Not really.\n“Everyone is judging me.” → Rarely.\n“I can’t do this.” → You already are.",
          ),
          W * 0.55, H * 0.55, 860, story ? 520 : 420, "serif", 50, "#1A1A1A", { align: "right", lh: 1.45, italic: false },
        ),
        Tx(T("Changez vos pensées, changez vos émotions.", "Cambia tus pensamientos, cambia tus emociones.", "Shift your thoughts, shift your feelings."), W * 0.62, H * 0.8, 700, 80, "body", 30, "#1A1A1A", { align: "right" }),
        Ui("profile", W * 0.62, H * 0.89, 520, 80, { name, handle }),
      ],
    }),
  },
  {
    id: "e-dayinlife",
    name: t3("Une journée avec moi", "Un día conmigo", "A day with me"),
    intents: ["day", "bts"],
    mood: "fun",
    photos: 4,
    slides: 4,
    build: ({ H, T }) => {
      const msgs = [
        [T("Mon matin", "Mi mañana", "My morning"), "☕"],
        [T("Pause sport", "Pausa deporte", "Workout break"), "🎀"],
        [T("Mon café préféré", "Mi café favorito", "My favorite coffee shop"), "🤍"],
        [T("Un peu de shopping", "Un poco de shopping", "A little shopping"), "🛍️"],
      ];
      const layers = [];
      msgs.forEach(([m, e], s) => {
        layers.push(full(SLIDE_W, H, s));
        layers.push(Bu(m, s * SLIDE_W + 540, H * 0.5, 560, 116, { sticker: e, tail: s % 2 ? "left" : "right" }));
      });
      layers.push(Tx(T("[la routine parfaite]", "[la rutina perfecta]", "[the perfect routine]"), 540, H * 0.5 + 110, 620, 70, "body", 40, "#FFFFFF", { shadow: true }));
      return { bg: { color: "#E9E4DE" }, layers };
    },
  },
  {
    id: "e-insets",
    name: t3("Photos encadrées", "Fotos enmarcadas", "Framed insets"),
    intents: ["day", "bts", "dump"],
    mood: "fun",
    photos: 4,
    build: ({ W, H, T, story }) => ({
      bg: { color: "#EAE3DA" },
      layers: [
        full(W, H),
        Bu(T("Mon matin", "Mi mañana", "My morning"), W * 0.36, H * 0.17, 440, 104, { sticker: "💖" }),
        Tx(T("[la routine parfaite]", "[la rutina perfecta]", "[the perfect routine]"), W * 0.36, H * 0.17 + 90, 520, 60, "body", 36, "#FFFFFF", { shadow: true }),
        P(W * 0.17, H * (story ? 0.38 : 0.42), 230, 270, { border: 10, borderColor: "#FFFFFF", label: T("Café", "Café", "Coffee"), rot: -2 }),
        P(W * 0.75, H * (story ? 0.56 : 0.6), 230, 270, { border: 10, borderColor: "#FFFFFF", label: T("Détails", "Detalles", "Details"), rot: 3 }),
        P(W * 0.22, H * (story ? 0.72 : 0.8), 230, 270, { border: 10, borderColor: "#FFFFFF", label: T("Ambiance", "Ambiente", "Atmosphere"), rot: -3 }),
        St("star", W * 0.33, H * (story ? 0.34 : 0.37), 66, "#F5C542"),
        St("star", W * 0.9, H * (story ? 0.52 : 0.55), 66, "#F5C542"),
        St("star", W * 0.43, H * (story ? 0.66 : 0.73), 60, "#F5C542"),
      ],
    }),
  },
  {
    id: "e-gridbubble",
    name: t3("Grille et bulle", "Cuadrícula y burbuja", "Grid & bubble"),
    intents: ["day", "dump", "outfit"],
    mood: "minimal",
    photos: 4,
    build: ({ W, H, T }) => ({
      bg: { color: "#FFFFFF" },
      layers: [
        P(W * 0.25, H * 0.25, W / 2, H / 2),
        P(W * 0.75, H * 0.25, W / 2, H / 2),
        P(W * 0.25, H * 0.75, W / 2, H / 2),
        P(W * 0.75, H * 0.75, W / 2, H / 2),
        Bu(T("Mon café préféré", "Mi café favorito", "My favorite coffee shop"), W / 2, H / 2, 560, 110, { sticker: "☕" }),
      ],
    }),
  },
  {
    id: "e-quest",
    name: t3("Mode quête", "Modo misión", "Quest mode"),
    intents: ["day", "bts"],
    mood: "fun",
    photos: 1,
    build: ({ W, H, T, story }) => {
      const acts = [
        [T("faire du shopping 🛍️", "ir de compras 🛍️", "go shopping 🛍️"), 0.2, 0.3],
        [T("prendre des photos 📸", "tomar fotos 📸", "take some pics 📸"), 0.2, 0.38],
        [T("un café entre amies ☕", "café con amigas ☕", "coffee dates ☕"), 0.2, 0.46],
        [T("marcher jusqu’à la mer", "caminar al mar", "walk to the ocean"), 0.8, 0.3],
        [T("aller à la salle 💪", "ir al gym 💪", "go to the gym 💪"), 0.8, 0.38],
        [T("moment pour moi 🤍", "tiempo para mí 🤍", "self-care time 🤍"), 0.8, 0.46],
      ];
      return {
        bg: { color: "#D9D4CD" },
        layers: [
          full(W, H),
          St("diamond", W / 2, H * (story ? 0.17 : 0.13), 150, "#3DDC5A"),
          ...acts.map(([t, x, y]) => La(t, W * x, H * (story ? y : y + 0.02), 340, 58, { size: 26, color: "#FFFFFF", shadow: true })),
        ],
      };
    },
  },
  {
    id: "e-outfitdays",
    name: t3("Tenues de la semaine", "Outfits de la semana", "Outfits of the week"),
    intents: ["outfit", "travel"],
    mood: "editorial",
    photos: 5,
    build: ({ W, H, T, story }) => ({
      bg: { color: "#D9D2C9" },
      layers: [
        full(W, H),
        P(W * 0.2, H * (story ? 0.2 : 0.18), 200, 230, { border: 8, label: T("Jour 1", "Día 1", "Day 1") }),
        P(W * 0.8, H * (story ? 0.28 : 0.27), 200, 230, { border: 8, label: T("Jour 2", "Día 2", "Day 2") }),
        P(W * 0.2, H * (story ? 0.74 : 0.8), 200, 230, { border: 8, label: T("Jour 4", "Día 4", "Day 4") }),
        P(W * 0.78, H * (story ? 0.8 : 0.84), 200, 230, { border: 8, label: T("Jour 3", "Día 3", "Day 3") }),
        Tx(T("Valise capsule", "Maleta cápsula", "Capsule travel"), W * 0.48, H * (story ? 0.45 : 0.43), 700, 100, "dancing", 80, "#FFFFFF", { shadow: true }),
        Tx(T("TENUES", "OUTFITS", "OUTFITS"), W / 2, H * (story ? 0.52 : 0.52), 900, 170, "anton", 170, "#FFFFFF", { shadow: true }),
        Tx(T("7 looks avec 10 pièces", "7 looks con 10 prendas", "7 looks from 10 pieces"), W * 0.55, H * (story ? 0.58 : 0.6), 700, 80, "serif", 54, "#FFFFFF", { shadow: true, italic: true }),
        St("sparkle", W * 0.82, H * (story ? 0.47 : 0.46), 70, "#FFFFFF"),
        St("heart", W * 0.62, H * (story ? 0.36 : 0.36), 50, "#FF8FB8"),
      ],
    }),
  },
  {
    id: "e-notes",
    name: t3("Note du jour", "Nota del día", "Note of the day"),
    intents: ["outfit", "bts", "list"],
    mood: "minimal",
    photos: 2,
    build: ({ W, H, T, story }) => ({
      bg: { color: "#F2F1EF" },
      layers: [
        Ui("notes", W / 2, H / 2, W - 140, H - (story ? 260 : 160), { title: T("Nouveau", "Nuevo", "New"), handle: T("Aujourd’hui à 10:15", "Hoy a las 10:15", "Today at 10:15") }),
        P(W * 0.5, H * (story ? 0.4 : 0.42), 420, 520, { rot: -4, shadow: true, radius: 16 }),
        P(W * 0.62, H * (story ? 0.62 : 0.68), 420, 470, { rot: 5, shadow: true, radius: 16 }),
        La(T("tenue du dimanche", "outfit de domingo", "sunday outfit"), W * 0.72, H * (story ? 0.79 : 0.86), 300, 54, { color: "#5B8DEF", textColor: "#FFFFFF", size: 26 }),
      ],
    }),
  },
  {
    id: "e-recipe",
    name: t3("Recette en une image", "Receta en una imagen", "Recipe cover"),
    intents: ["recipe"],
    mood: "editorial",
    photos: 1,
    cover: true,
    build: ({ W, H, T, story }) => ({
      bg: { color: "#F3EEE6" },
      layers: [
        full(W, H),
        Tx(T("recette", "receta", "recipe"), W / 2, H * (story ? 0.18 : 0.16), 900, 200, "dancing", 170, "#FFFFFF", { shadow: true, rot: -5 }),
        Tx(T("3 boissons d’été qui ont l’air chères (mais pas du tout)", "3 bebidas de verano que parecen caras (pero no lo son)", "3 summer drinks that look expensive (but aren’t)"), W / 2, H * (story ? 0.3 : 0.31), 820, 200, "lora", 56, "#FFFFFF", { shadow: true, lh: 1.15 }),
        Ui("readcaption", W / 2, H * (story ? 0.84 : 0.86), 420, 50, { title: T("Lire la légende", "Lee la descripción", "Read the caption") }),
        St("sun", W * 0.84, H * (story ? 0.1 : 0.08), 90, "#FFD15C"),
      ],
    }),
  },
  {
    id: "e-calmquote",
    name: t3("Pensée douce", "Pensamiento suave", "Soft thought"),
    intents: ["quote"],
    mood: "luxe",
    photos: 1,
    build: ({ W, H, T, story, handle, name }) => ({
      bg: { color: "#E7E1D8" },
      layers: [
        full(W, H),
        Tx([handle || "@pseudo", name || T("Votre nom", "Tu nombre", "Your name"), T("PSYCHOLOGIE", "PSICOLOGÍA", "PSYCHOLOGY")].join("      ").toUpperCase(), W / 2, H * 0.05, 960, 40, "body", 20, "#FFFFFF", { spacing: 0.1 }),
        Tx(T("Vous n’avez pas besoin d’être forte tout le temps", "No tienes que ser fuerte todo el tiempo", "You don’t have to be strong all the time"), W * 0.68, H * (story ? 0.33 : 0.35), 560, 260, "serif", 66, "#FFFFFF", { align: "right", lh: 1.08, shadow: true }),
        Tx(T("Demander de l’aide n’est pas une faiblesse, c’est du courage.", "Pedir ayuda no es debilidad, es valentía.", "Asking for help isn’t weakness, it’s courage."), W * 0.74, H * (story ? 0.45 : 0.5), 440, 120, "body", 30, "#FFFFFF", { align: "right", lh: 1.3, shadow: true }),
      ],
    }),
  },
  {
    id: "e-giantword",
    name: t3("Mot géant", "Palabra gigante", "Giant word"),
    intents: ["quote", "tips"],
    mood: "luxe",
    photos: 1,
    cover: true,
    build: ({ W, H, T, story }) => ({
      bg: { color: "#D8D0C5" },
      layers: [
        full(W, H),
        Tx(T("VOTRE MARQUE PARLE AVANT LES MOTS.", "TU MARCA HABLA ANTES QUE LAS PALABRAS.", "YOUR BRAND SPEAKS BEFORE WORDS."), W / 2, H * (story ? 0.4 : 0.38), 700, 120, "body", 40, "#FFFFFF", { spacing: 0.08, lh: 1.25 }),
        Tx(T("posez votre profil avec assurance", "posiciona tu perfil con seguridad", "position your profile with authority"), W * 0.62, H * (story ? 0.47 : 0.48), 380, 100, "caveat", 40, "#FFFFFF", { rot: -8 }),
        Ar(W * 0.4, H * (story ? 0.47 : 0.48), 110, 70, "#FFFFFF", { rot: 160, curve: -0.6, width: 4 }),
        Tx(T("marque", "marca", "brand"), W / 2, H * (story ? 0.82 : 0.86), 1200, 420, "serif", 360, "#FFFFFF", { opacity: 0.7, italic: false }),
      ],
    }),
  },
  {
    id: "e-circle",
    name: t3("Texte en cercle", "Texto en círculo", "Circle text"),
    intents: ["quote", "bts"],
    mood: "luxe",
    photos: 1,
    build: ({ W, H, T }) => ({
      bg: { color: "#3A2A22" },
      layers: [
        full(W, H),
        Ci(T("Le déclic arrive quand on comprend enfin pourquoi •", "El clic llega cuando por fin entiendes por qué •", "The turning point happens when you understand why •"), W / 2, H / 2, 760, { size: 46, font: "lora" }),
        Tx(T("celle qui doit oser", "quien necesita atreverse", "who needs to take a stand"), W / 2, H / 2 - 10, 380, 120, "caveat", 54, "#FFFFFF", { shadow: true }),
        Ui("readcaption", W / 2, H / 2 + 80, 300, 34, { title: T("Lire la légende", "Lee la descripción", "Read the caption") }),
      ],
    }),
  },
  {
    id: "e-checklist",
    name: t3("Liste à cocher", "Lista para marcar", "Checklist"),
    intents: ["list", "tips", "travel"],
    mood: "minimal",
    photos: 1,
    build: ({ W, H, T, story }) => ({
      bg: { color: "#E6E1DA" },
      layers: [
        full(W, H),
        Ui("checklist", W / 2, H * (story ? 0.55 : 0.56), 820, story ? 760 : 640, {
          title: T("Mes essentiels du matin", "Mis básicos de la mañana", "My morning essentials"),
          items: [T("Un grand verre d’eau", "Un gran vaso de agua", "A big glass of water"), T("10 minutes dehors", "10 minutos afuera", "10 minutes outside"), T("Mes trois priorités", "Mis tres prioridades", "My three priorities"), T("Pas de téléphone au réveil", "Sin teléfono al despertar", "No phone first thing"), T("Un café tranquille", "Un café tranquilo", "A slow coffee")],
        }),
        Tx(T("à garder", "para guardar", "save this"), W * 0.78, H * (story ? 0.22 : 0.17), 300, 90, "caveat", 70, "#FFFFFF", { rot: -8, shadow: true }),
        Ar(W * 0.7, H * (story ? 0.28 : 0.24), 110, 90, "#FFFFFF", { rot: 100, curve: 0.5 }),
      ],
    }),
  },
  {
    id: "e-thread",
    name: t3("Post façon fil", "Post estilo hilo", "Thread-style post"),
    intents: ["tips", "quote"],
    mood: "editorial",
    photos: 1,
    build: ({ W, H, T, story, name, handle }) => ({
      bg: { color: "#FFFFFF" },
      layers: [
        Ui("profile", W / 2, H * (story ? 0.15 : 0.1), 900, 100, { name, handle }),
        Tx(T("Un contenu régulier commence par un système simple, pas par la motivation.", "El contenido constante empieza con un sistema simple, no con la motivación.", "Consistent content starts with a simple system, not motivation."), W / 2, H * (story ? 0.27 : 0.24), 900, 220, "body", 50, "#1A1A1A", { align: "left", lh: 1.25 }),
        P(W / 2, H * (story ? 0.62 : 0.66), 900, story ? 900 : 760, { radius: 34 }),
        Tx("♡ 1,2k   💬 86   ↻ 41", W * 0.3, H * (story ? 0.92 : 0.96), 600, 50, "body", 30, "#8A8A8E", { align: "left" }),
      ],
    }),
  },
  {
    id: "e-adventure",
    name: t3("Aventure du jour", "Aventura del día", "Adventure of the day"),
    intents: ["travel", "day"],
    mood: "fun",
    photos: 1,
    build: ({ W, H, T, story }) => ({
      bg: { color: "#C9D7E3" },
      layers: [
        full(W, H),
        Tx(T("cet endroit a la plus belle vue", "este lugar tiene la mejor vista", "this place has the best views"), W * 0.72, H * (story ? 0.12 : 0.1), 340, 120, "caveat", 46, "#FFFFFF", { shadow: true }),
        Ar(W * 0.7, H * (story ? 0.19 : 0.18), 100, 110, "#FFFFFF", { rot: 110, curve: 0.5 }),
        Tx(T("Aventure", "Aventura", "Adventure"), W * 0.68, H * (story ? 0.85 : 0.84), 560, 120, "dancing", 100, "#FFFFFF", { shadow: true }),
        Tx(T("du jour", "del día", "of the day"), W * 0.74, H * (story ? 0.9 : 0.91), 400, 80, "serif", 50, "#FFFFFF", { shadow: true }),
        St("heart", W * 0.88, H * (story ? 0.8 : 0.78), 46, "#FFFFFF"),
      ],
    }),
  },
  {
    id: "e-folder",
    name: t3("Dossier souvenirs", "Carpeta de recuerdos", "Memory folder"),
    intents: ["dump", "travel", "outfit"],
    mood: "fun",
    photos: 7,
    build: ({ W, H, T, story, lang }) => {
      const months = { fr: ["Mars", "Avril", "Mai", "Juin", "Juillet", "Août"], es: ["Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto"], en: ["March", "April", "May", "June", "July", "August"] }[lang] || [];
      const pos = [
        [0.2, 0.62], [0.78, 0.24], [0.22, 0.36], [0.8, 0.52], [0.36, 0.78], [0.78, 0.76],
      ];
      return {
        bg: { color: "#D5D0CA" },
        layers: [
          full(W, H),
          Ui("folder", W * 0.4, H * (story ? 0.12 : 0.1), 160, 130, { title: "2026" }),
          ...pos.map(([x, y], i) => P(W * x, H * y, 180, 210, { border: 7, label: months[i], rot: (i % 2 ? 3 : -3) })),
        ],
      };
    },
  },
  {
    id: "e-beforeafter",
    name: t3("Avant / après annoté", "Antes / después anotado", "Annotated before / after"),
    intents: ["beforeafter"],
    mood: "minimal",
    photos: 2,
    build: ({ W, H, T }) => ({
      bg: { color: "#FFFFFF" },
      layers: [
        P(W / 2, H * 0.25, W, H / 2),
        P(W / 2, H * 0.75, W, H / 2),
        Bu(T("avant", "antes", "before"), W * 0.25, H * 0.42, 260, 96, { color: "#E9E9EB", textColor: "#1A1A1A", tail: "left" }),
        Bu(T("après ✨", "después ✨", "after ✨"), W * 0.75, H * 0.58, 280, 96, { tail: "right" }),
        Ar(W * 0.86, H * 0.47, 100, 120, "#FFFFFF", { rot: 70, curve: 0.5 }),
      ],
    }),
  },
  {
    id: "e-lifelately",
    name: t3("Ces derniers temps", "Últimamente", "Life lately"),
    intents: ["dump", "day"],
    mood: "minimal",
    photos: 7,
    build: ({ W, H, T, story }) => {
      const top = story ? 0.42 : 0.4;
      const gh = (H * (1 - top)) / 2;
      const cells = [];
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) cells.push(P(W / 6 + (c * W) / 3, H * top + gh / 2 + r * gh, W / 3 - 6, gh - 6));
      return {
        bg: { color: "#FFFFFF" },
        layers: [
          P(W / 2, (H * top) / 2, W, H * top),
          Ui("album", W / 2, H * top - 140, W, 280, { title: T("ces derniers temps", "últimamente", "life lately"), text: T("26 éléments", "26 elementos", "26 items") }),
          ...cells,
        ],
      };
    },
  },
  {
    id: "e-weekend",
    name: t3("Dump du week-end", "Dump del finde", "Weekend dump"),
    intents: ["dump"],
    mood: "fun",
    photos: 3,
    build: ({ W, H, T, story }) => ({
      bg: { color: "#1F3A5F" },
      layers: [
        P(W * 0.3, H * 0.3, W * 0.6, H * 0.6),
        P(W * 0.8, H * 0.3, W * 0.4, H * 0.6),
        P(W / 2, H * 0.8, W, H * 0.4),
        Tx(T("week", "fin", "week"), W * 0.72, H * (story ? 0.36 : 0.32), 420, 170, "montserrat", 160, "#FFFFFF", { shadow: true }),
        Tx(T("end", "de", "end"), W * 0.72, H * (story ? 0.44 : 0.43), 420, 170, "montserrat", 160, "#FFFFFF", { shadow: true }),
        La("DUMP", W * 0.9, H * (story ? 0.5 : 0.51), 150, 50, { size: 24, color: "#1A1A1A", textColor: "#FFFFFF", upper: true }),
        St("star", W * 0.55, H * (story ? 0.47 : 0.49), 60, "#F5C542"),
      ],
    }),
  },
  {
    id: "e-share",
    name: t3("Partage reçu", "Compartido recibido", "Incoming share"),
    intents: ["bts", "day"],
    mood: "fun",
    photos: 1,
    cover: true,
    build: ({ W, H, T, story, name }) => ({
      bg: { color: "#3B342F" },
      layers: [
        full(W, H),
        La(T("débordée", "agotada", "overworked"), W * 0.3, H * (story ? 0.2 : 0.14), 300, 70, { font: "caveat", size: 50, color: "#D96AA8", textColor: "#FFFFFF", rot: -6 }),
        Ui("sharesheet", W * 0.6, H * (story ? 0.32 : 0.3), 560, 300, { title: T("Partage", "Compartir", "Share"), text: T(`${name || "Votre nom"} souhaite vous partager une vidéo.`, `${name || "Tu nombre"} quiere compartirte un video.`, `${name || "Your name"} would like to share a video.`), items: [T("Ignorer", "Ignorar", "Ignore"), T("Accepter", "Aceptar", "Accept")] }),
        Tx(T("une journée dans ma vie…", "un día en mi vida…", "a day in the life…"), W * 0.38, H * (story ? 0.48 : 0.56), 600, 260, "montserrat", 110, "#FFFFFF", { align: "left", shadow: true, lh: 0.95 }),
        St("heart", W * 0.12, H * (story ? 0.42 : 0.46), 44, "#FF8FB8"),
        St("sparkle", W * 0.7, H * (story ? 0.55 : 0.66), 60, "#FFFFFF"),
      ],
    }),
  },
  {
    id: "e-notif",
    name: t3("Notification", "Notificación", "Notification"),
    intents: ["bts", "tips"],
    mood: "fun",
    photos: 1,
    cover: true,
    build: ({ W, H, T, story, name }) => ({
      bg: { color: "#2B2B2B" },
      layers: [
        full(W, H),
        Ui("notif", W / 2, H * (story ? 0.12 : 0.1), 940, 200, { name: name || T("Votre nom", "Tu nombre", "Your name"), handle: T("maintenant", "ahora", "now"), text: T("Je vous montre comment j’ai rendu mon feed plus cohérent en une semaine.", "Te muestro cómo hice mi feed más coherente en una semana.", "Here’s how I made my feed more cohesive in one week."), dark: true }),
        Tx(T("Arrêtez les fonds", "Deja los fondos", "Stop using"), W / 2, H * (story ? 0.62 : 0.64), 900, 110, "body", 64, "#FFFFFF", { shadow: true }),
        Tx(T("ENNUYEUX", "ABURRIDOS", "BORING"), W / 2, H * (story ? 0.7 : 0.74), 960, 170, "anton", 170, "#FFFFFF", { shadow: true }),
        Ui("comment", W * 0.6, H * (story ? 0.86 : 0.9), 640, 120, { name: T("une abonnée", "una seguidora", "a follower"), text: T("enfin quelqu’un qui l’explique simplement 🙌", "por fin alguien que lo explica fácil 🙌", "finally someone who explains it simply 🙌") }),
      ],
    }),
  },
  {
    id: "e-portfolio",
    name: t3("Titre bicolore", "Título bicolor", "Two-tone title"),
    intents: ["tips", "outfit"],
    mood: "editorial",
    photos: 1,
    cover: true,
    build: ({ W, H, T, story }) => ({
      bg: { color: "#7A1F2B" },
      layers: [
        Sh("rect", W / 2, H * 0.03, W, H * 0.06, { color: "#F3E9DE" }),
        P(W / 2, H * 0.55, W, H * 0.9),
        Tx(T("comment créer un", "cómo crear un", "how to build a"), W / 2, H * (story ? 0.42 : 0.4), 800, 80, "montserrat", 52, "#FFFFFF", { shadow: true }),
        Tx(T("portfolio", "portafolio", "strong"), W / 2, H * (story ? 0.49 : 0.49), 960, 160, "montserrat", 150, "#C8323F", { outline: "#FFFFFF" }),
        Tx(T("qui marque", "que deja huella", "portfolio"), W / 2, H * (story ? 0.56 : 0.59), 960, 150, "montserrat", 130, "#FFFFFF", { shadow: true }),
        Tx(T("encore du texte", "más texto", "more text"), W * 0.2, H * 0.27, 260, 70, "caveat", 44, "#FFFFFF", { rot: -8 }),
        Tx(T("c’est parti", "vamos allá", "let’s dive in"), W * 0.78, H * 0.93, 300, 70, "caveat", 46, "#FFFFFF", { rot: -6 }),
      ],
    }),
  },
  // ---------- Carrousels continus (une seule grande toile découpée en diapos) ----------
  {
    id: "e-sl-blank",
    name: t3("Carrousel continu vierge", "Carrusel continuo en blanco", "Blank seamless carousel"),
    intents: ["dump", "travel", "day"],
    mood: "minimal",
    photos: 0,
    slides: 3,
    seamless: true,
    build: () => ({ bg: { color: "#F6F1E9" }, layers: [] }),
  },
  {
    id: "e-sl-polaroids",
    name: t3("Polaroids qui débordent", "Polaroids que desbordan", "Overflowing instant photos"),
    intents: ["dump", "travel"],
    mood: "fun",
    photos: 5,
    slides: 3,
    seamless: true,
    build: ({ H, T }) => ({
      bg: { color: "#EFE8DD" },
      layers: [
        Tx(T("mon été", "mi verano", "my summer"), 520, H * 0.17, 800, 180, "caveat", 150, "#2B2B2B", { rot: -4 }),
        P(420, H * 0.58, 460, 560, { border: 20, bottom: 90, borderColor: "#FFFFFF", shadow: true, rot: -6 }),
        P(1080, H * 0.42, 460, 560, { border: 20, bottom: 90, borderColor: "#FFFFFF", shadow: true, rot: 5 }),
        P(1620, H * 0.66, 460, 560, { border: 20, bottom: 90, borderColor: "#FFFFFF", shadow: true, rot: -3 }),
        P(2160, H * 0.4, 460, 560, { border: 20, bottom: 90, borderColor: "#FFFFFF", shadow: true, rot: 6 }),
        P(2780, H * 0.62, 460, 560, { border: 20, bottom: 90, borderColor: "#FFFFFF", shadow: true, rot: -5 }),
        Dd("stars", 1360, H * 0.84, 200, 110, "#E2A23B"),
        Tx(T("à suivre…", "continuará…", "to be continued…"), 2860, H * 0.12, 360, 90, "caveat", 66, "#2B2B2B", { rot: -5 }),
      ],
    }),
  },
  {
    id: "e-sl-ribbon",
    name: t3("Ruban de photos", "Cinta de fotos", "Photo ribbon"),
    intents: ["dump", "day"],
    mood: "minimal",
    photos: 6,
    slides: 3,
    seamless: true,
    build: ({ H, T }) => {
      const layers = [Sh("line", 1620, H / 2, 3240, 4, { stroke: "#1A1A1A", strokeWidth: 3 })];
      for (let i = 0; i < 6; i++) layers.push(P(270 + i * 540, H / 2 + (i % 2 ? 70 : -70), 400, 500, { radius: 18, shadow: true }));
      layers.push(Tx(T("mes petits moments", "mis pequeños momentos", "little moments"), 540, H * 0.12, 900, 110, "serif", 80, "#1A1A1A"));
      layers.push(Tx(T("glissez →", "desliza →", "swipe →"), 900, H * 0.92, 300, 60, "body", 32, "#1A1A1A"));
      return { bg: { color: "#F4F1EC" }, layers };
    },
  },
  {
    id: "e-sl-bigword",
    name: t3("Mot sur trois diapos", "Palabra en tres slides", "Word across slides"),
    intents: ["quote", "travel", "dump"],
    mood: "editorial",
    photos: 3,
    slides: 3,
    seamless: true,
    build: ({ H, T }) => ({
      bg: { color: "#111111" },
      layers: [
        P(540, H * 0.5, 1080, H),
        P(1620, H * 0.5, 1080, H),
        P(2700, H * 0.5, 1080, H),
        Tx(T("ESCAPADE", "ESCAPADA", "GETAWAY"), 1620, H * 0.52, 3200, 700, "anton", 760, "#FFFFFF", { opacity: 0.88 }),
        Tx(T("trois jours, une ville", "tres días, una ciudad", "three days, one city"), 1620, H * 0.86, 900, 80, "caveat", 66, "#FFFFFF", { shadow: true }),
      ],
    }),
  },
  {
    id: "e-sl-pano",
    name: t3("Grande photo panoramique", "Gran foto panorámica", "Big panorama"),
    intents: ["travel", "dump"],
    mood: "luxe",
    photos: 2,
    slides: 3,
    seamless: true,
    build: ({ H, T }) => ({
      bg: { color: "#F6F1E9" },
      layers: [
        P(1080, H / 2, 2160, H),
        P(2700, H * 0.42, 620, 760, { border: 16, borderColor: "#FFFFFF", shadow: true, rot: 3 }),
        Tx(T("Carnet de route", "Diario de viaje", "Travel notes"), 2700, H * 0.84, 800, 110, "serif", 86, "#1A1A1A"),
        Tx(T("chapitre 01", "capítulo 01", "chapter 01"), 2700, H * 0.91, 600, 60, "body", 30, "#1A1A1A", { upper: true, spacing: 0.2 }),
      ],
    }),
  },
  {
    id: "e-sl-timeline",
    name: t3("Ligne du temps", "Línea del tiempo", "Timeline"),
    intents: ["day", "travel"],
    mood: "minimal",
    photos: 4,
    slides: 4,
    seamless: true,
    build: ({ H, T }) => {
      const times = ["07:30", "11:00", "15:30", "20:00"];
      const labels = [T("réveil doux", "despertar suave", "slow wake-up"), T("atelier", "taller", "studio time"), T("balade", "paseo", "a walk"), T("dîner", "cena", "dinner")];
      const layers = [Sh("dots", 2160, H * 0.78, 4200, 10, { color: "#1A1A1A" })];
      for (let i = 0; i < 4; i++) {
        layers.push(P(540 + i * 1080 + (i % 2 ? 120 : -120), H * 0.42, 620, 740, { radius: 24 }));
        layers.push(Tx(times[i], 540 + i * 1080, H * 0.84, 400, 90, "bebas", 90, "#1A1A1A"));
        layers.push(Tx(labels[i], 540 + i * 1080, H * 0.9, 500, 70, "caveat", 56, "#1A1A1A"));
      }
      layers.push(Tx(T("ma journée", "mi día", "my day"), 540, H * 0.08, 600, 90, "serif", 70, "#1A1A1A"));
      return { bg: { color: "#FBF8F3" }, layers };
    },
  },
];
LAYER_TEMPLATES.forEach((t) => (t.slides ||= 1));
export const layerTemplateById = (id) => LAYER_TEMPLATES.find((t) => t.id === id) || null;
/** Formats possibles d'un modèle : les carrousels (fixes ou continus) existent en 4:5 et en 9:16, les autres en story et publication. */
export const templateFormats = (t) => ["9:16", "4:5"];
/** Le modèle convient-il au format choisi en haut de l'écran ? */
export function fitsPickFormat(t, f) {
  if (f === "carousel") return t.slides > 1;
  if (f === "reel") return t.slides === 1 && !!t.cover;
  return t.slides === 1;
}
/** Construit le visuel de départ. `opt` : { lang, format, name, handle, slides (carrousel continu) }. */
export function buildLayered(tid, opt = {}) {
  const t = layerTemplateById(tid);
  if (!t) throw Error("Modèle inconnu.");
  const lang = ["fr", "es", "en"].includes(opt.lang) ? opt.lang : "fr";
  const format = LAYER_FORMATS[opt.format] ? opt.format : t.slides > 1 ? "4:5" : "9:16";
  const slides = t.seamless && opt.slides ? Math.max(2, Math.min(10, opt.slides | 0)) : t.slides;
  const [W, H] = layerCanvasSize({ format, slides: 1 });
  n = 0;
  const T = (fr, es, en) => pick(lang, { fr, es, en });
  const built = t.build({ W, H, T, lang, story: format === "9:16", name: opt.name || "", handle: opt.handle || "" });
  const d = { id: "layers", from: t.id, format, slides, bg: { color: "#F6F1E9", photo: "", blur: 0, dim: 0, ...built.bg }, layers: built.layers.map((l) => ({ opacity: 1, ...l })), slide: 0 };
  // Valeurs par défaut complétées (comme à l'enregistrement) : l'aperçu et l'image finale sont identiques.
  // Carrousel continu agrandi : les éléments restent à leur place, les diapos ajoutées sont vides.
  const { photos, handle, ...clean } = sanitizeLayered(d);
  return clean;
}
const NICHE = [
  [/beaut|soin|skin|make|maquill|cosm|belleza/i, ["tips", "outfit", "list"]],
  [/mode|fashion|style|tenue|outfit|moda/i, ["outfit", "dump", "day"]],
  [/cuisine|food|recette|recipe|receta|cocina|pâtiss|pan|boulang/i, ["recipe", "list", "bts"]],
  [/voyage|travel|viaje/i, ["travel", "dump", "day"]],
  [/sport|fitness|yoga|pilates|bien-être|wellness|salud/i, ["day", "tips", "list"]],
  [/psy|mental|mindset|coach|développement/i, ["quote", "tips", "list"]],
  [/maman|mom|famil|mamá/i, ["day", "dump", "tips"]],
  [/business|entrepreneur|marketing|contenu|content|emprend/i, ["tips", "list", "quote"]],
];
/** Intentions qui correspondent le mieux à la niche de la créatrice (piliers, positionnement, audience). */
export function nicheIntents(config = {}) {
  const s = config.creatorStrategy || {};
  const text = [...(s.pillars || []), s.positioning, s.audience, s.visualWorld, config.sector, config.niche].filter(Boolean).join(" ");
  const out = [];
  for (const [re, ids] of NICHE) if (re.test(text)) for (const i of ids) if (!out.includes(i)) out.push(i);
  return out;
}
/**
 * « Pour vous » : favoris, puis récemment utilisés, puis ceux qui correspondent à la niche, puis l'ordre du catalogue.
 * Déterministe : à données égales, même ordre.
 */
export function rankTemplates(config = {}, { favorites = [], recent = [], format = "story", intent = "", photoCount = 0 } = {}) {
  const prefs = nicheIntents(config);
  return LAYER_TEMPLATES.map((t, i) => {
    let s = 0;
    const f = favorites.indexOf(t.id);
    if (f >= 0) s += 1000 - f;
    const r = recent.indexOf(t.id);
    if (r >= 0) s += 500 - r * 10;
    const p = t.intents.reduce((m, it) => Math.max(m, prefs.includes(it) ? 100 - prefs.indexOf(it) * 10 : 0), 0);
    s += p;
    if (intent && t.intents[0] === intent) s += 30;
    if (photoCount && t.photos === photoCount) s += 40;
    return { t, s, i };
  })
    .filter(({ t }) => fitsPickFormat(t, format) && (!intent || t.intents.includes(intent)) && (!photoCount || t.photos === photoCount || (t.seamless && t.photos <= photoCount) || (photoCount > 1 && t.photos >= photoCount - 1 && t.photos <= photoCount + 1 && t.photos > 0)))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(({ t }) => t);
}
