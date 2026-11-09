// Atelier « Modèles » : visuels composés dans le navigateur (canvas), sans IA d'image.
// Le texte est écrit tel quel (aucune faute possible) et les photos du client ne sont jamais modifiées.
// Ce module est pur (aucun accès navigateur) : il sert à l'écran, au serveur (validation) et aux tests.
import { sanitizeLayered } from "./layers.mjs";

export const FORMATS = {
  "4:5": [1080, 1350],
  "1:1": [1080, 1080],
  "9:16": [1080, 1920],
};

// Polices libres (SIL Open Font License), fichiers dans public/media-engine/fonts/.
export const TEMPLATE_FONTS = [
  { id: "playfair", label: "Playfair", family: "LP Playfair", file: "PlayfairDisplay_700Bold.ttf", weight: 700, kind: "serif" },
  { id: "dmserif", label: "DM Serif", family: "LP DM Serif", file: "DMSerifDisplay_400Regular.ttf", weight: 400, kind: "serif" },
  { id: "lora", label: "Lora", family: "LP Lora", file: "Lora_600SemiBold.ttf", weight: 600, kind: "serif" },
  { id: "poppins", label: "Poppins", family: "LP Poppins", file: "Poppins_700Bold.ttf", weight: 700, kind: "sans" },
  { id: "inter", label: "Inter", family: "LP Inter", file: "Inter_800ExtraBold.ttf", weight: 800, kind: "sans" },
  { id: "montserrat", label: "Montserrat", family: "LP Montserrat", file: "Montserrat_800ExtraBold.ttf", weight: 800, kind: "sans" },
  { id: "spacegrotesk", label: "Space Grotesk", family: "LP Space Grotesk", file: "SpaceGrotesk_700Bold.ttf", weight: 700, kind: "sans" },
  { id: "bebas", label: "Bebas Neue", family: "LP Bebas", file: "BebasNeue_400Regular.ttf", weight: 400, kind: "display" },
  { id: "anton", label: "Anton", family: "LP Anton", file: "Anton_400Regular.ttf", weight: 400, kind: "display" },
  { id: "dancing", label: "Dancing Script", family: "LP Dancing", file: "DancingScript_700Bold.ttf", weight: 700, kind: "script" },
  { id: "caveat", label: "Caveat", family: "LP Caveat", file: "Caveat_700Bold.ttf", weight: 700, kind: "script" },
];
// Police du texte courant (sous-titres, légendes) : toujours lisible.
export const BODY_FONT = { id: "poppins-body", family: "LP Poppins Body", file: "Poppins_400Regular.ttf", weight: 400 };
export const SCRIPT_FONT = TEMPLATE_FONTS.find((f) => f.id === "caveat");
// Polices complémentaires des montages photo tendance (OFL, mêmes fichiers locaux).
export const TRENDY_FONTS = {
  mono: { family: "LP Courier", file: "CourierPrime_700Bold.ttf", weight: 700 },
  serifLight: { family: "LP Playfair Regular", file: "PlayfairDisplay_400Regular.ttf", weight: 400 },
  loraLight: { family: "LP Lora Regular", file: "Lora_400Regular.ttf", weight: 400 },
};
export const fontById = (id) => TEMPLATE_FONTS.find((f) => f.id === id) || TEMPLATE_FONTS[0];

// Fonds unis proposés en plus des couleurs de la marque (pas de dégradés par défaut).
export const BACKGROUND_PRESETS = ["#F6F1E9", "#1A1A1A", "#B8291A", "#EDE4D3", "#2F4A3A", "#F3D9D1", "#E9EEF2", "#FFFFFF"];

const t3 = (fr, es, en) => ({ fr, es, en });

// Catalogue des modèles. `photos` = [min, max]. `fields` = textes à saisir (jamais de faux chiffres ni de faux avis).
export const TEMPLATES = [
  {
    id: "quote",
    group: "text",
    name: t3("Citation", "Cita", "Quote"),
    hint: t3("Une phrase forte, sur un fond uni.", "Una frase fuerte sobre un fondo liso.", "A strong line on a plain background."),
    photos: [0, 0],
    fields: [
      { key: "text", label: t3("Citation", "Cita", "Quote"), multiline: true, max: 220, placeholder: t3("[Votre phrase]", "[Tu frase]", "[Your quote]") },
      { key: "author", label: t3("Auteur (facultatif)", "Autor (opcional)", "Author (optional)"), max: 60 },
    ],
  },
  {
    id: "announce",
    group: "text",
    name: t3("Annonce", "Anuncio", "Announcement"),
    hint: t3("Une nouveauté, un événement, une ouverture.", "Una novedad, un evento, una apertura.", "News, an event, an opening."),
    photos: [0, 0],
    fields: [
      { key: "kicker", label: t3("Petit titre", "Antetítulo", "Kicker"), max: 40, placeholder: t3("Nouveau", "Nuevo", "New") },
      { key: "title", label: t3("Titre", "Título", "Headline"), multiline: true, max: 90, placeholder: t3("[Votre annonce]", "[Tu anuncio]", "[Your announcement]") },
      { key: "body", label: t3("Détails", "Detalles", "Details"), multiline: true, max: 180 },
      { key: "cta", label: t3("Bouton", "Botón", "Button"), max: 40 },
    ],
  },
  {
    id: "tip",
    group: "text",
    name: t3("Astuce", "Consejo", "Tip"),
    hint: t3("Un conseil utile de votre métier.", "Un consejo útil de tu oficio.", "A useful tip from your trade."),
    photos: [0, 0],
    fields: [
      { key: "title", label: t3("Titre", "Título", "Title"), max: 80, placeholder: t3("[Le titre de l’astuce]", "[El título del consejo]", "[Tip title]") },
      { key: "body", label: t3("Astuce", "Consejo", "Tip"), multiline: true, max: 260 },
    ],
  },
  {
    id: "list",
    group: "text",
    name: t3("3 conseils", "3 consejos", "3 tips"),
    hint: t3("Une liste courte et claire.", "Una lista corta y clara.", "A short, clear list."),
    photos: [0, 0],
    fields: [
      { key: "title", label: t3("Titre", "Título", "Title"), max: 80, placeholder: t3("[3 conseils pour…]", "[3 consejos para…]", "[3 tips to…]") },
      { key: "item1", label: t3("Conseil 1", "Consejo 1", "Tip 1"), max: 90 },
      { key: "item2", label: t3("Conseil 2", "Consejo 2", "Tip 2"), max: 90 },
      { key: "item3", label: t3("Conseil 3", "Consejo 3", "Tip 3"), max: 90 },
    ],
  },
  {
    id: "question",
    group: "text",
    name: t3("Question", "Pregunta", "Question"),
    hint: t3("Faites parler votre communauté.", "Haz hablar a tu comunidad.", "Get your community talking."),
    photos: [0, 0],
    fields: [
      { key: "text", label: t3("Question", "Pregunta", "Question"), multiline: true, max: 140, placeholder: t3("[Votre question]", "[Tu pregunta]", "[Your question]") },
      { key: "cta", label: t3("Invitation", "Invitación", "Prompt"), max: 60, placeholder: t3("Répondez en commentaire", "Responde en los comentarios", "Answer in the comments") },
    ],
  },
  {
    id: "number",
    group: "text",
    name: t3("Chiffre clé", "Cifra clave", "Key number"),
    hint: t3("Un vrai chiffre de votre activité.", "Una cifra real de tu negocio.", "A real number from your business."),
    photos: [0, 0],
    fields: [
      { key: "number", label: t3("Chiffre (le vôtre)", "Cifra (la tuya)", "Number (yours)"), max: 12, placeholder: t3("[ex. 250]", "[ej. 250]", "[e.g. 250]") },
      { key: "label", label: t3("Ce que ça représente", "Qué representa", "What it means"), multiline: true, max: 120 },
      { key: "source", label: t3("Source (facultatif)", "Fuente (opcional)", "Source (optional)"), max: 80 },
    ],
  },
  {
    id: "carousel",
    group: "text",
    name: t3("Carrousel texte", "Carrusel de texto", "Text carousel"),
    hint: t3("2 à 6 diapos de texte, à faire défiler.", "De 2 a 6 diapositivas de texto para deslizar.", "2 to 6 text slides to swipe through."),
    photos: [0, 0],
    fields: [
      { key: "title", label: t3("Titre de couverture", "Título de portada", "Cover title"), max: 80, placeholder: t3("[Le titre]", "[El título]", "[The title]") },
      { key: "text", label: t3("Contenu des diapos", "Contenido de las diapositivas", "Slides content"), multiline: true, max: 1500 },
    ],
  },
  {
    id: "beforeAfter",
    group: "service",
    name: t3("Avant / Après", "Antes / Después", "Before / After"),
    hint: t3("Montrez la différence : ménage, coiffure, rénovation…", "Muestra la diferencia: limpieza, peinado, remodelación…", "Show the difference: cleaning, hair, renovation…"),
    photos: [2, 2],
    fields: [
      { key: "title", label: t3("Titre (facultatif)", "Título (opcional)", "Title (optional)"), max: 60 },
      { key: "before", label: t3("Étiquette 1", "Etiqueta 1", "Label 1"), max: 20, placeholder: t3("Avant", "Antes", "Before") },
      { key: "after", label: t3("Étiquette 2", "Etiqueta 2", "Label 2"), max: 20, placeholder: t3("Après", "Después", "After") },
    ],
  },
  {
    id: "portfolio",
    group: "service",
    name: t3("Galerie / Portfolio", "Galería / Portafolio", "Gallery / Portfolio"),
    hint: t3("Votre photo en grand, avec un cadre élégant. Elle n’est jamais modifiée.", "Tu foto en grande, con un marco elegante. Nunca se modifica.", "Your photo, large, with an elegant frame. It is never altered."),
    photos: [1, 1],
    fields: [
      { key: "title", label: t3("Titre", "Título", "Title"), max: 60 },
      { key: "caption", label: t3("Légende", "Pie de foto", "Caption"), max: 120 },
      { key: "credit", label: t3("Crédit photo", "Crédito de foto", "Photo credit"), max: 50 },
    ],
  },
  {
    id: "collage",
    group: "service",
    name: t3("Collage", "Collage", "Collage"),
    hint: t3("2 à 4 photos en grille.", "2 a 4 fotos en cuadrícula.", "2 to 4 photos in a grid."),
    photos: [2, 4],
    fields: [{ key: "title", label: t3("Titre (facultatif)", "Título (opcional)", "Title (optional)"), max: 60 }],
  },
  {
    id: "behind",
    group: "service",
    name: t3("Coulisses", "Detrás de cámaras", "Behind the scenes"),
    hint: t3("Une photo et une petite note manuscrite.", "Una foto y una notita manuscrita.", "A photo and a little handwritten note."),
    photos: [1, 1],
    fields: [{ key: "note", label: t3("Note", "Nota", "Note"), multiline: true, max: 90, placeholder: t3("[Ce matin à l’atelier…]", "[Esta mañana en el taller…]", "[This morning at the studio…]") }],
  },
  {
    id: "steps",
    group: "service",
    name: t3("Étapes du service", "Pasos del servicio", "Service steps"),
    hint: t3("Comment se passe votre prestation, en 3 étapes.", "Cómo es tu servicio, en 3 pasos.", "How your service works, in 3 steps."),
    photos: [0, 3],
    fields: [
      { key: "title", label: t3("Titre", "Título", "Title"), max: 70, placeholder: t3("[Comment ça se passe]", "[Cómo funciona]", "[How it works]") },
      { key: "step1", label: t3("Étape 1", "Paso 1", "Step 1"), max: 80 },
      { key: "step2", label: t3("Étape 2", "Paso 2", "Step 2"), max: 80 },
      { key: "step3", label: t3("Étape 3", "Paso 3", "Step 3"), max: 80 },
    ],
  },
  {
    id: "offer",
    group: "service",
    name: t3("Offre / Promo", "Oferta / Promo", "Offer / Promo"),
    hint: t3("Votre offre réelle : prix et conditions que vous fixez.", "Tu oferta real: precio y condiciones que tú fijas.", "Your real offer: price and terms you set."),
    photos: [1, 1],
    fields: [
      { key: "title", label: t3("Titre", "Título", "Headline"), max: 70, placeholder: t3("[Votre offre]", "[Tu oferta]", "[Your offer]") },
      { key: "price", label: t3("Prix (facultatif)", "Precio (opcional)", "Price (optional)"), max: 30 },
      { key: "terms", label: t3("Conditions", "Condiciones", "Terms"), max: 120 },
      { key: "cta", label: t3("Bouton", "Botón", "Button"), max: 40 },
    ],
  },
  {
    id: "review",
    group: "service",
    name: t3("Avis client", "Opinión de cliente", "Client review"),
    hint: t3("Un vrai avis, avec l’accord du client.", "Una opinión real, con permiso del cliente.", "A real review, with the client’s consent."),
    photos: [0, 1],
    fields: [
      { key: "quote", label: t3("Texte de l’avis", "Texto de la opinión", "Review text"), multiline: true, max: 260, placeholder: t3("[Le texte de l’avis]", "[El texto de la opinión]", "[The review text]") },
      { key: "name", label: t3("Prénom du client", "Nombre del cliente", "Client name"), max: 40, placeholder: t3("[Prénom]", "[Nombre]", "[Name]") },
      { key: "stars", label: t3("Étoiles (1 à 5)", "Estrellas (1 a 5)", "Stars (1 to 5)"), max: 1 },
    ],
    requiresConsent: true,
  },
];
export const templateById = (id) => TEMPLATES.find((t) => t.id === id) || null;

// ---------- Montages photo tendance (créatrices de contenu) ----------
// Mises en page originales, dessinées dans le navigateur (lib/trendy-draw.mjs). Les textes par défaut
// (« placeholder » sans crochets) sont utilisés tels quels : rien n'est obligatoire à saisir.
const STORY_POST = ["9:16", "4:5"];
const TRENDY = [
  {
    id: "t-film", name: t3("Pellicule", "Película", "Film strip"),
    hint: t3("3 ou 4 photos sur une bande de film.", "3 o 4 fotos en una tira de película.", "3 or 4 photos on a strip of film."),
    photos: [3, 4], formats: STORY_POST, carousel: 2, font: "caveat", bg: "#1C1A17",
    fields: [
      { key: "caption", label: t3("Légende", "Leyenda", "Caption"), max: 60, placeholder: t3("souvenirs d’octobre", "recuerdos de octubre", "october memories") },
      { key: "roll", label: t3("Inscription sur le film", "Texto en la película", "Film marking"), max: 24, placeholder: t3("ROLL 01 · 400", "ROLL 01 · 400", "ROLL 01 · 400") },
    ],
  },
  {
    id: "t-polaroid", name: t3("Polaroids", "Polaroids", "Instant photos"),
    hint: t3("2 ou 3 photos instantanées, avec un mot écrit à la main.", "2 o 3 fotos instantáneas, con una nota a mano.", "2 or 3 instant photos with a handwritten note."),
    photos: [2, 3], formats: STORY_POST, font: "caveat", bg: "#EFE7DA",
    fields: [
      { key: "caption", label: t3("Mot écrit à la main", "Nota a mano", "Handwritten note"), max: 40, placeholder: t3("le meilleur week-end", "el mejor fin de semana", "best weekend ever") },
      { key: "date", label: t3("Date (facultatif)", "Fecha (opcional)", "Date (optional)"), max: 20 },
    ],
  },
  {
    id: "t-scrap", name: t3("Carnet de bord", "Cuaderno", "Scrapbook"),
    hint: t3("Papier déchiré, ruban adhésif et petits dessins.", "Papel rasgado, cinta adhesiva y dibujitos.", "Torn paper, tape and little doodles."),
    photos: [2, 3], formats: STORY_POST, carousel: 2, font: "caveat", bg: "#F4EEE3",
    fields: [
      { key: "title", label: t3("Titre", "Título", "Title"), max: 40, placeholder: t3("petits bonheurs", "pequeñas alegrías", "little joys") },
      { key: "note", label: t3("Petite note", "Notita", "Little note"), max: 60, placeholder: t3("à garder précieusement", "para guardar siempre", "keeping this one") },
    ],
  },
  {
    id: "t-mag", name: t3("Couverture magazine", "Portada de revista", "Magazine cover"),
    hint: t3("Votre photo en couverture, avec un grand titre et des accroches.", "Tu foto en portada, con un gran título y frases.", "Your photo on the cover, with a masthead and cover lines."),
    photos: [1, 1], formats: STORY_POST, font: "playfair", bg: "#1A1A1A",
    fields: [
      { key: "masthead", label: t3("Grand titre", "Título grande", "Masthead"), max: 14, placeholder: t3("L’ÉDITION", "LA EDICIÓN", "THE ISSUE") },
      { key: "line1", label: t3("Accroche principale", "Frase principal", "Main cover line"), max: 50, placeholder: t3("Mes 5 essentiels du mois", "Mis 5 básicos del mes", "My 5 essentials this month") },
      { key: "line2", label: t3("Accroche 2", "Frase 2", "Cover line 2"), max: 40, placeholder: t3("Dans les coulisses", "Detrás de cámaras", "Behind the scenes") },
      { key: "line3", label: t3("Accroche 3", "Frase 3", "Cover line 3"), max: 40, placeholder: t3("Spécial nouvelle saison", "Especial nueva temporada", "New season special") },
      { key: "issue", label: t3("Numéro", "Número", "Issue"), max: 20, placeholder: t3("N°01", "N.º 01", "No. 01") },
    ],
  },
  {
    id: "t-dump", name: t3("Photo dump", "Photo dump", "Photo dump"),
    hint: t3("4 à 6 photos en grille, avec la date.", "De 4 a 6 fotos en cuadrícula, con la fecha.", "4 to 6 photos in a grid, with the date."),
    photos: [4, 6], formats: STORY_POST, carousel: 2, font: "spacegrotesk", bg: "#FFFFFF",
    fields: [
      { key: "title", label: t3("Titre", "Título", "Title"), max: 30, placeholder: t3("photo dump", "photo dump", "photo dump") },
      { key: "date", label: t3("Date (vide = aujourd’hui)", "Fecha (vacío = hoy)", "Date (blank = today)"), max: 20 },
    ],
  },
  {
    id: "t-mood", name: t3("Mood board", "Mood board", "Mood board"),
    hint: t3("Vos photos et les couleurs qu’elles contiennent.", "Tus fotos y los colores que contienen.", "Your photos and the colors in them."),
    photos: [3, 4], formats: STORY_POST, font: "dmserif", bg: "#F3EEE6",
    fields: [
      { key: "title", label: t3("Titre", "Título", "Title"), max: 30, placeholder: t3("Mood du mois", "Mood del mes", "Mood of the month") },
      { key: "words", label: t3("Trois mots", "Tres palabras", "Three words"), max: 50, placeholder: t3("doux · lumineux · naturel", "suave · luminoso · natural", "soft · bright · natural") },
    ],
  },
  {
    id: "t-minimal", name: t3("Cadre minimal", "Marco minimalista", "Minimal frame"),
    hint: t3("Une photo, un grand titre élégant, une petite légende.", "Una foto, un título elegante, una pequeña leyenda.", "One photo, an elegant title, a tiny caption."),
    photos: [1, 1], formats: STORY_POST, font: "dmserif", bg: "#F6F1E9",
    fields: [
      { key: "title", label: t3("Titre", "Título", "Title"), max: 40, placeholder: t3("Ici et maintenant", "Aquí y ahora", "Here and now") },
      { key: "caption", label: t3("Légende", "Leyenda", "Caption"), max: 50, placeholder: t3("notes du dimanche", "notas de domingo", "sunday notes") },
    ],
  },
  {
    id: "t-split", name: t3("Duo en diagonale", "Dúo en diagonal", "Diagonal split"),
    hint: t3("Deux photos séparées en diagonale : avant / après, jour / nuit…", "Dos fotos en diagonal: antes / después, día / noche…", "Two photos split diagonally: before / after, day / night…"),
    photos: [2, 2], formats: STORY_POST, font: "poppins", bg: "#FFFFFF",
    fields: [
      { key: "label1", label: t3("Étiquette 1", "Etiqueta 1", "Label 1"), max: 20, placeholder: t3("Avant", "Antes", "Before") },
      { key: "label2", label: t3("Étiquette 2", "Etiqueta 2", "Label 2"), max: 20, placeholder: t3("Après", "Después", "After") },
    ],
  },
  {
    id: "t-digicam", name: t3("Appareil photo rétro", "Cámara retro", "Retro digicam"),
    hint: t3("L’effet appareil des années 2000 : grain et date orange.", "El efecto cámara de los 2000: grano y fecha naranja.", "The 2000s camera look: grain and an orange date."),
    photos: [1, 1], formats: STORY_POST, font: "spacegrotesk", bg: "#111111",
    fields: [
      { key: "date", label: t3("Date (vide = aujourd’hui)", "Fecha (vacío = hoy)", "Date (blank = today)"), max: 12 },
      { key: "caption", label: t3("Légende (facultatif)", "Leyenda (opcional)", "Caption (optional)"), max: 40 },
    ],
  },
  {
    id: "t-day", name: t3("Ma journée", "Mi día", "My day"),
    hint: t3("Votre journée en photos, avec les heures.", "Tu día en fotos, con las horas.", "Your day in photos, with times."),
    photos: [3, 4], formats: STORY_POST, font: "bebas", bg: "#FBF8F3",
    fields: [
      { key: "title", label: t3("Titre", "Título", "Title"), max: 40, placeholder: t3("Une journée avec moi", "Un día conmigo", "A day with me") },
      { key: "t1", label: t3("Heure 1", "Hora 1", "Time 1"), max: 8, placeholder: t3("08:00", "08:00", "8 AM") },
      { key: "l1", label: t3("Moment 1", "Momento 1", "Moment 1"), max: 30, placeholder: t3("Café", "Café", "Coffee") },
      { key: "t2", label: t3("Heure 2", "Hora 2", "Time 2"), max: 8, placeholder: t3("12:30", "12:30", "12:30 PM") },
      { key: "l2", label: t3("Moment 2", "Momento 2", "Moment 2"), max: 30, placeholder: t3("Atelier", "Taller", "Studio") },
      { key: "t3", label: t3("Heure 3", "Hora 3", "Time 3"), max: 8, placeholder: t3("16:00", "16:00", "4 PM") },
      { key: "l3", label: t3("Moment 3", "Momento 3", "Moment 3"), max: 30, placeholder: t3("Balade", "Paseo", "Walk") },
      { key: "t4", label: t3("Heure 4", "Hora 4", "Time 4"), max: 8, placeholder: t3("20:00", "20:00", "8 PM") },
      { key: "l4", label: t3("Moment 4", "Momento 4", "Moment 4"), max: 30, placeholder: t3("Dîner", "Cena", "Dinner") },
    ],
  },
  {
    id: "t-ootd", name: t3("Tenue du jour", "Outfit del día", "Outfit of the day"),
    hint: t3("Une photo en pied, et le nom de chaque pièce.", "Una foto de cuerpo entero y el nombre de cada prenda.", "A full-length photo, with each piece named."),
    photos: [1, 1], formats: STORY_POST, font: "dmserif", bg: "#EDE7DF",
    fields: [
      { key: "title", label: t3("Titre", "Título", "Title"), max: 30, placeholder: t3("Tenue du jour", "Outfit del día", "Outfit of the day") },
      { key: "i1", label: t3("Pièce 1", "Prenda 1", "Piece 1"), max: 30, placeholder: t3("Veste en lin", "Chaqueta de lino", "Linen jacket") },
      { key: "i2", label: t3("Pièce 2", "Prenda 2", "Piece 2"), max: 30, placeholder: t3("Sac en cuir", "Bolso de piel", "Leather bag") },
      { key: "i3", label: t3("Pièce 3", "Prenda 3", "Piece 3"), max: 30, placeholder: t3("Baskets blanches", "Tenis blancos", "White sneakers") },
    ],
  },
  {
    id: "t-recipe", name: t3("Fiche recette", "Receta", "Recipe card"),
    hint: t3("Une photo du plat, les ingrédients et le temps.", "Una foto del plato, los ingredientes y el tiempo.", "A photo of the dish, ingredients and time."),
    photos: [1, 1], formats: STORY_POST, font: "lora", bg: "#F6EFE4",
    fields: [
      { key: "title", label: t3("Nom de la recette", "Nombre de la receta", "Recipe name"), max: 40, placeholder: t3("Tarte aux pommes", "Tarta de manzana", "Apple tart") },
      { key: "time", label: t3("Temps", "Tiempo", "Time"), max: 12, placeholder: t3("45 min", "45 min", "45 min") },
      { key: "serves", label: t3("Portions", "Porciones", "Serves"), max: 16, placeholder: t3("4 pers.", "4 porciones", "Serves 4") },
      { key: "ingredients", label: t3("Ingrédients (un par ligne)", "Ingredientes (uno por línea)", "Ingredients (one per line)"), multiline: true, max: 260, placeholder: t3("3 pommes\n200 g de farine\n100 g de beurre\n80 g de sucre", "3 manzanas\n200 g de harina\n100 g de mantequilla\n80 g de azúcar", "3 apples\n200 g flour\n100 g butter\n80 g sugar") },
    ],
  },
  {
    id: "t-ticket", name: t3("Billet de voyage", "Boleto de viaje", "Boarding pass"),
    hint: t3("Votre prochain voyage, façon carte d’embarquement.", "Tu próximo viaje, como un pase de abordar.", "Your next trip, styled as a boarding pass."),
    photos: [1, 2], formats: STORY_POST, font: "bebas", bg: "#E4DCCF",
    fields: [
      { key: "title", label: t3("Titre", "Título", "Title"), max: 30, placeholder: t3("Prochaine escale", "Próxima escala", "Next stop") },
      { key: "from", label: t3("Départ (code)", "Salida (código)", "From (code)"), max: 4, placeholder: t3("PAR", "MEX", "NYC") },
      { key: "fromCity", label: t3("Ville de départ", "Ciudad de salida", "From city"), max: 24, placeholder: t3("Paris", "Ciudad de México", "New York") },
      { key: "to", label: t3("Arrivée (code)", "Llegada (código)", "To (code)"), max: 4, placeholder: t3("LIS", "OAX", "LAX") },
      { key: "toCity", label: t3("Ville d’arrivée", "Ciudad de llegada", "To city"), max: 24, placeholder: t3("Lisbonne", "Oaxaca", "Los Angeles") },
      { key: "date", label: t3("Date (vide = aujourd’hui)", "Fecha (vacío = hoy)", "Date (blank = today)"), max: 16 },
    ],
  },
  {
    id: "t-blurquote", name: t3("Citation sur photo", "Cita sobre foto", "Quote on photo"),
    hint: t3("Votre photo floutée en fond, nette au centre, et une phrase.", "Tu foto difuminada de fondo, nítida al centro, y una frase.", "Your photo blurred behind, sharp in the middle, and a line."),
    photos: [1, 1], formats: STORY_POST, font: "playfair", bg: "#1A1A1A",
    fields: [
      { key: "quote", label: t3("Phrase", "Frase", "Line"), multiline: true, max: 140, placeholder: t3("Ralentir, c’est aussi avancer.", "Ir despacio también es avanzar.", "Slowing down is still moving forward.") },
      { key: "author", label: t3("Signature (facultatif)", "Firma (opcional)", "Signature (optional)"), max: 40 },
    ],
  },
  {
    id: "t-pano", name: t3("Carrousel panoramique", "Carrusel panorámico", "Panorama carousel"),
    hint: t3("1 à 3 photos qui continuent d’une diapo à l’autre.", "De 1 a 3 fotos que continúan de una diapositiva a otra.", "1 to 3 photos that flow from one slide to the next."),
    photos: [1, 3], formats: [], carousel: 3, font: "dmserif", bg: "#F6F1E9",
    fields: [
      { key: "title", label: t3("Titre", "Título", "Title"), max: 40, placeholder: t3("Glissez pour voir", "Desliza para ver", "Swipe to see") },
      { key: "caption", label: t3("Texte de la dernière diapo", "Texto de la última diapositiva", "Last slide text"), max: 80, placeholder: t3("Merci d’être passé·e par ici", "Gracias por pasar por aquí", "Thanks for stopping by") },
    ],
  },
].map((t) => ({ ...t, group: "trendy" }));
TEMPLATES.push(...TRENDY);
export const TRENDY_IDS = TRENDY.map((t) => t.id);
export const isTrendy = (id) => TRENDY_IDS.includes(id);
/** Nombre de slides d'un montage (1 hors carrousel). */
export const trendySlides = (tpl) => {
  const def = templateById(tpl?.id);
  return def?.group === "trendy" && tpl?.carousel && def.carousel ? def.carousel : 1;
};


// Secteurs « service » : l'agence peut aussi cocher « Activité de service » dans la fiche du client.
export function serviceFirst(config = {}) {
  return config.serviceBusiness === true || config.sector === "wellness";
}
/** Ordre des groupes : montages tendance d'abord pour les créatrices, services d'abord pour les activités de service. */
export function groupOrder(config = {}) {
  if (config.workspaceType === "creator") return ["trendy", "text", "service"];
  return serviceFirst(config) ? ["service", "text", "trendy"] : ["text", "service", "trendy"];
}
export function orderedTemplates(config = {}) {
  const hidden = new Set(Array.isArray(config.hiddenTemplates) ? config.hiddenTemplates : []);
  const list = TEMPLATES.filter((t) => !hidden.has(t.id));
  return groupOrder(config).flatMap((g) => list.filter((t) => t.group === g));
}

// --- Couleurs et contraste (WCAG) ---
export function hexToRgb(hex) {
  const h = String(hex || "").trim().replace(/^#/, "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}
export const validHex = (hex) => !!hexToRgb(hex);
export function luminance(hex) {
  const rgb = hexToRgb(hex) || [0, 0, 0];
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export const passesContrast = (fg, bg, min = 4.5) => contrastRatio(fg, bg) >= min;
// Texte noir doux ou blanc, selon ce qui se lit le mieux sur le fond.
export function bestTextColor(bg, dark = "#1A1A1A", light = "#FFFFFF") {
  const pick = contrastRatio(dark, bg) >= contrastRatio(light, bg) ? dark : light;
  if (contrastRatio(pick, bg) >= 4.5) return pick;
  // Fonds moyens : noir pur ou blanc pur, le plus lisible des deux.
  return contrastRatio("#000000", bg) >= contrastRatio("#FFFFFF", bg) ? "#000000" : "#FFFFFF";
}
// Couleur d'accent lisible : la couleur de marque si elle passe, sinon la couleur de texte.
export function readableAccent(accent, bg, fallback) {
  return validHex(accent) && contrastRatio(accent, bg) >= 3 ? accent : fallback || bestTextColor(bg);
}
// Palette proposée : couleurs de la marque (config.colors « #aaa, #bbb ») puis fonds neutres.
export function paletteFrom(config = {}) {
  const brand = String(config.colors || "")
    .split(/[\s,;]+/)
    .map((c) => c.trim())
    .filter(validHex)
    .map((c) => (c.length === 4 ? "#" + [...c.slice(1)].map((x) => x + x).join("") : c).toUpperCase());
  return [...new Set([...brand, ...BACKGROUND_PRESETS])].slice(0, 12);
}

// --- Texte : retour à la ligne et ajustement de la taille ---
// `measure(text)` renvoie la largeur en pixels pour la taille courante.
export function wrapText(text, maxWidth, measure) {
  const out = [];
  for (const para of String(text ?? "").split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = "";
    for (let w of words) {
      // Mot trop long pour une ligne : on le coupe.
      while (measure(w) > maxWidth && w.length > 1) {
        let cut = w.length - 1;
        while (cut > 1 && measure(w.slice(0, cut) + "-") > maxWidth) cut--;
        if (line) {
          out.push(line);
          line = "";
        }
        out.push(w.slice(0, cut) + "-");
        w = w.slice(cut);
      }
      const test = line ? line + " " + w : w;
      if (!line || measure(test) <= maxWidth) line = test;
      else {
        out.push(line);
        line = w;
      }
    }
    if (line) out.push(line);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out;
}
// Cherche la plus grande taille (entre min et max) pour que le texte tienne dans la boîte.
// `measureAt(size)` renvoie une fonction de mesure pour cette taille.
export function fitText(text, { maxWidth, maxHeight, maxSize = 120, minSize = 24, lineHeight = 1.18 }, measureAt) {
  let size = maxSize;
  while (size >= minSize) {
    const lines = wrapText(text, maxWidth, measureAt(size));
    if (lines.length * size * lineHeight <= maxHeight) return { size, lines, fits: true };
    size -= 2;
  }
  const lines = wrapText(text, maxWidth, measureAt(minSize));
  return { size: minSize, lines, fits: lines.length * minSize * lineHeight <= maxHeight };
}

// Carrousel : une slide par bloc séparé par une ligne vide (ou « --- »), 1 à 5 slides de contenu
// (+ la couverture = 2 à 6 au total). Un bloc unique est réparti par phrases.
export function splitCarousel(text, maxContent = 5) {
  const raw = String(text ?? "").replace(/\r/g, "");
  let blocks = raw
    .split(/\n\s*(?:---+)?\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length === 1) {
    const sentences = blocks[0].match(/[^.!?…]+[.!?…]*/g)?.map((s) => s.trim()).filter(Boolean) || [blocks[0]];
    if (sentences.length > 1) {
      const n = Math.min(maxContent, Math.max(2, Math.ceil(sentences.length / 2)));
      const per = Math.ceil(sentences.length / n);
      blocks = [];
      for (let i = 0; i < sentences.length; i += per) blocks.push(sentences.slice(i, i + per).join(" "));
    }
  }
  if (blocks.length > maxContent) {
    const head = blocks.slice(0, maxContent - 1);
    blocks = [...head, blocks.slice(maxContent - 1).join("\n")];
  }
  return blocks;
}

// --- Validation côté serveur du « dessin » enregistré avec le visuel ---
const clean = (s, max) =>
  String(s ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .slice(0, max);
export function sanitizeTemplate(input) {
  const t = input && typeof input === "object" ? input : {};
  // Visuel à calques (éditeur des créatrices) : validation dédiée.
  if (t.id === "layers") return sanitizeLayered(t);
  const def = templateById(t.id);
  if (!def) throw Object.assign(new Error("Modèle inconnu."), { status: 400 });
  const fields = {};
  for (const f of def.fields) fields[f.key] = clean(t.fields?.[f.key], f.max);
  if (def.id === "review") {
    const n = Number(fields.stars || 5);
    fields.stars = String(Number.isInteger(n) && n >= 1 && n <= 5 ? n : 5);
  }
  const photos = (Array.isArray(t.photos) ? t.photos : [])
    .map((p) => clean(p, 100))
    .filter((p) => /^[A-Za-z0-9_-]{6,100}$/.test(p))
    .slice(0, def.photos[1]);
  const trendy = def.group === "trendy";
  const carousel = trendy && !!def.carousel && (t.carousel === true || !def.formats.length);
  const num = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v) * 1000) / 1000)) : d);
  const out = {
    id: def.id,
    fields,
    photos,
    format: trendy
      ? carousel
        ? "4:5"
        : def.formats.includes(t.format)
          ? t.format
          : def.formats[0]
      : Object.hasOwn(FORMATS, t.format)
        ? t.format
        : "4:5",
    font: fontById(t.font).id,
    bg: validHex(t.bg) ? String(t.bg).toUpperCase() : "#F6F1E9",
    fg: validHex(t.fg) ? String(t.fg).toUpperCase() : null,
    accent: validHex(t.accent) ? String(t.accent).toUpperCase() : null,
    align: ["left", "center"].includes(t.align) ? t.align : "center",
    scale: Math.min(1.3, Math.max(0.7, Number(t.scale) || 1)),
    texture: t.texture === true,
    showHandle: t.showHandle !== false,
    handle: clean(t.handle, 40),
    layout: ["side", "diagonal", "stack"].includes(t.layout) ? t.layout : "side",
    fit: t.fit === "contain" ? "contain" : "cover",
    slide: trendy
      ? carousel && Number.isInteger(t.slide) && t.slide >= 0 && t.slide < def.carousel
        ? t.slide
        : 0
      : Number.isInteger(t.slide) && t.slide >= 0 && t.slide < 6
        ? t.slide
        : 0,
    reviewConfirmed: t.reviewConfirmed === true,
  };
  if (trendy) {
    out.carousel = carousel;
    out.filter = t.filter === "film" ? "film" : "none";
    out.crops = (Array.isArray(t.crops) ? t.crops : []).slice(0, def.photos[1]).map((c) => ({
      x: num(c?.x, -1, 1, 0),
      y: num(c?.y, -1, 1, 0),
      z: num(c?.z, 1, 3, 1),
    }));
  }
  if (def.requiresConsent && !out.reviewConfirmed)
    throw Object.assign(new Error("Confirmez qu’il s’agit d’un vrai avis, publié avec l’accord du client."), { status: 400 });
  if (photos.length < def.photos[0]) throw Object.assign(new Error("Ajoutez les photos demandées par ce modèle."), { status: 400 });
  if (JSON.stringify(out).length > 20000) throw Object.assign(new Error("Le modèle est trop long."), { status: 413 });
  return out;
}

// Réglages de l'agence pour les modèles d'un client.
export function sanitizeTemplateSettings(input = {}) {
  const ids = new Set(TEMPLATES.map((t) => t.id));
  const logo = String(input.templateLogo ?? "");
  return {
    serviceBusiness: input.serviceBusiness === true,
    templateFont: TEMPLATE_FONTS.some((f) => f.id === input.templateFont) ? input.templateFont : null,
    templateBg: validHex(input.templateBg) ? String(input.templateBg).toUpperCase() : null,
    templateAccent: validHex(input.templateAccent) ? String(input.templateAccent).toUpperCase() : null,
    templateHandle: clean(input.templateHandle, 40).trim(),
    templateLogo: /^[A-Za-z0-9_-]{6,100}$/.test(logo) ? logo : null,
    hiddenTemplates: (Array.isArray(input.hiddenTemplates) ? input.hiddenTemplates : []).filter((x) => ids.has(x)).slice(0, TEMPLATES.length),
  };
}

// Vidéo avant / après (moteur FFmpeg WebAssembly du navigateur) : la photo « après » se dévoile
// de gauche à droite derrière un trait blanc. Les deux images (étiquettes comprises) sont préparées dans le canvas.
export const BEFORE_AFTER_SECONDS = 7;
export function beforeAfterSize(format = "4:5") {
  const [w, h] = FORMATS[format] || FORMATS["4:5"];
  const width = 720;
  return { width, height: Math.round((width * h) / w / 2) * 2 };
}
export function beforeAfterArgs({ width = 720, height = 900, duration = BEFORE_AFTER_SECONDS } = {}) {
  const d = String(duration),
    reveal = "clip((T-1.5)/3,0,1)";
  return [
    "-loop", "1", "-t", d, "-i", "before.png",
    "-loop", "1", "-t", d, "-i", "after.png",
    "-f", "lavfi", "-t", d, "-i", `color=c=white:s=6x${height}:r=30`,
    "-filter_complex",
    `[0:v]scale=${width}:${height},setsar=1,fps=30,format=gbrp[a];[1:v]scale=${width}:${height},setsar=1,fps=30,format=gbrp[b];` +
      `[a][b]blend=all_expr='if(lte(X,W*${reveal}),B,A)'[m];` +
      `[m][2:v]overlay=x='W*clip((t-1.5)/3,0,1)-3':y=0:eval=frame:enable='between(t,1.4,4.6)',format=yuv420p[v]`,
    "-map", "[v]", "-r", "30", "-t", d,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
    "beforeafter.mp4",
  ];
}
