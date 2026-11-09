import { isCreator } from "./workspaces.mjs";
import { buildCreatorIdeas } from "./creator-editorial.mjs";
import { qualityContext } from "./quality-profile.mjs";
// Editorial suggestions are built from saved brand facts; no paid AI calls.
export function monthInMonterrey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Monterrey", year: "numeric", month: "2-digit" })
    .format(now)
    .replace("/", "-");
}
export function dayInMonterrey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Monterrey",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"].map((k) => parts.find((x) => x.type === k).value).join("-");
}
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
function nth(y, m, weekday, n) {
  return 1 + ((weekday - new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 7) % 7) + (n - 1) * 7;
}
function lastSunday(y, m) {
  const end = new Date(Date.UTC(y, m, 0));
  return end.getUTCDate() - end.getUTCDay();
}
function easter(y) {
  const a = y % 19,
    b = Math.floor(y / 100),
    c = y % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    t = Math.floor((a + 11 * h + 22 * l) / 451),
    m = Math.floor((h + l - 7 * t + 114) / 31),
    day = ((h + l - 7 * t + 114) % 31) + 1;
  return new Date(Date.UTC(y, m - 1, day));
}
export function inferredSector(config, products = []) {
  if (config.sector && config.sector !== "auto") return config.sector;
  const words = products
    .map((x) => x.name + " " + x.description)
    .join(" ")
    .toLowerCase();
  if (/\b(pain|pan|bread|boulangerie|restaurant|comida|café|coffee|cocktail|pastel)\b/.test(words)) return "food";
  if (/\b(hotel|hôtel|hospedaje|chambre)\b/.test(words)) return "hospitality";
  if (/\b(pilates|yoga|soin|bienestar|wellness|beauté)\b/.test(words)) return "wellness";
  return "general";
}
const labels = {
  newyear: ["Nouvel An", "Año Nuevo", "New Year"],
  valentine: ["Saint-Valentin", "Día del Amor y la Amistad", "Valentine’s Day"],
  women: ["Journée internationale des droits des femmes", "Día Internacional de la Mujer", "International Women’s Day"],
  earth: ["Journée de la Terre", "Día de la Tierra", "Earth Day"],
  mother: ["Fête des mères", "Día de las Madres", "Mother’s Day"],
  father: ["Fête des pères", "Día del Padre", "Father’s Day"],
  summer: ["Ambiance estivale", "Temporada de verano", "Summer inspiration"],
  food: ["Journée mondiale de l’alimentation", "Día Mundial de la Alimentación", "World Food Day"],
  halloween: ["Halloween", "Halloween", "Halloween"],
  christmas: ["Noël", "Navidad", "Christmas"],
  yearend: ["Fin d’année", "Fin de año", "Year-end"],
  reyes: ["Jour des Rois", "Día de Reyes", "Three Kings Day"],
  candelaria: ["Chandeleur au Mexique", "Día de la Candelaria", "Candlemas in Mexico"],
  independencemx: ["Fête de l’indépendance du Mexique", "Independencia de México", "Mexican Independence Day"],
  muertos: ["Día de Muertos", "Día de Muertos", "Día de Muertos"],
  bastille: ["Fête nationale française", "Fiesta Nacional de Francia", "Bastille Day"],
  music: ["Fête de la musique", "Fiesta de la Música", "Music Day"],
  independenceus: ["Independence Day", "Independencia de Estados Unidos", "Independence Day"],
  thanksgiving: ["Thanksgiving", "Thanksgiving", "Thanksgiving"],
  blackfriday: ["Black Friday", "Black Friday", "Black Friday"],
  backtoschool: ["Préparer la rentrée", "Preparar la vuelta a clases", "Back-to-school preparation"],
};
export function calendarForClient(client, products = [], custom = [], now = new Date()) {
  const c = typeof client.config === "string" ? JSON.parse(client.config) : client.config;
  const country = c.country || "MX",
    sector = inferredSector(c, products),
    lang = ["fr", "es", "en"].includes(c.language) ? c.language : "fr",
    li = { fr: 0, es: 1, en: 2 }[lang];
  const start = dayInMonterrey(now),
    endDate = new Date(start + "T12:00:00Z");
  endDate.setUTCDate(endDate.getUTCDate() + 365);
  const end = endDate.toISOString().slice(0, 10);
  const yr = Number(start.slice(0, 4)),
    events = [];
  const add = (key, y, m, d, industries = ["all"], source = "") => {
    if (!industries.includes("all") && !industries.includes(sector)) return;
    const date = iso(y, m, d);
    if (date < start || date > end || (c.calendarHidden || []).includes(key)) return;
    const product = products[events.length % Math.max(1, products.length)];
    const item = product?.name || c.brand || client.name;
    const angle =
      lang === "es"
        ? `Mostrar ${item} con una puesta en escena vinculada a ${labels[key][li]}. Mantener sus características reales; no inventar promociones.`
        : lang === "en"
          ? `Show ${item} in a setting inspired by ${labels[key][li]}. Preserve its real characteristics; do not invent promotions.`
          : `Mettre en scène ${item} autour de ${labels[key][li]}, en préservant ses caractéristiques. Aucune promotion inventée.`;
    events.push({
      id: key + "-" + date,
      key,
      date,
      title: labels[key][li],
      angle: isCreator(c)
        ? lang === "es"
          ? `Abordar ${labels[key][li]} desde uno de tus pilares editoriales. Sin experiencia o colaboración inventada.`
          : lang === "en"
            ? `Explore ${labels[key][li]} through one of your editorial pillars. No invented experience or partnership.`
            : `Aborder ${labels[key][li]} à travers un de vos piliers éditoriaux. Aucun vécu ou partenariat inventé.`
        : angle,
      sector,
      country,
      product_id: product?.id || null,
      product_name: product?.name || c.brand || client.name,
      source,
      custom: false,
    });
  };
  for (let y = yr; y <= yr + 1; y++) {
    add("newyear", y, 1, 1);
    add("valentine", y, 2, 14);
    add("women", y, 3, 8);
    add("earth", y, 4, 22, ["general", "food", "retail", "hospitality", "wellness"]);
    add("father", y, 6, nth(y, 6, 0, 3), ["food", "retail", "hospitality", "general"]);
    add("summer", y, 6, 15, ["food", "hospitality", "retail", "wellness"], "");
    add("food", y, 10, 16, ["food", "hospitality"], "https://www.fao.org/world-food-day/");
    add("halloween", y, 10, 31, ["food", "retail", "hospitality"]);
    add("christmas", y, 12, 25, ["food", "retail", "hospitality", "general"]);
    add("yearend", y, 12, 31);
    if (country === "MX") {
      add("reyes", y, 1, 6, ["food", "retail"]);
      add("candelaria", y, 2, 2, ["food"]);
      add(
        "mother",
        y,
        5,
        10,
        ["food", "retail", "hospitality", "wellness", "general"],
        "https://www.gob.mx/conapo/articulos/dia-de-las-madres-301380",
      );
      add("independencemx", y, 9, 16);
      add("muertos", y, 11, 2, ["food", "retail", "hospitality"]);
    }
    if (country === "FR") {
      let d = lastSunday(y, 5);
      const pent = easter(y);
      pent.setUTCDate(pent.getUTCDate() + 49);
      if (pent.toISOString().slice(0, 10) === iso(y, 5, d)) {
        pent.setUTCDate(pent.getUTCDate() + 7);
        add(
          "mother",
          y,
          pent.getUTCMonth() + 1,
          pent.getUTCDate(),
          ["food", "retail", "hospitality", "wellness", "general"],
          "https://www.service-public.gouv.fr/",
        );
      } else
        add(
          "mother",
          y,
          5,
          d,
          ["food", "retail", "hospitality", "wellness", "general"],
          "https://www.service-public.gouv.fr/",
        );
      add("bastille", y, 7, 14);
      add("music", y, 6, 21, ["food", "hospitality"]);
      add("backtoschool", y, 8, 20, ["retail", "wellness", "general"], "");
    }
    if (country === "US") {
      add(
        "mother",
        y,
        5,
        nth(y, 5, 0, 2),
        ["food", "retail", "hospitality", "wellness", "general"],
        "https://www.usa.gov/holidays",
      );
      add("independenceus", y, 7, 4);
      add(
        "thanksgiving",
        y,
        11,
        nth(y, 11, 4, 4),
        ["food", "retail", "hospitality", "general"],
        "https://www.usa.gov/holidays",
      );
    }
    const th = nth(y, 11, 4, 4);
    add(
      "blackfriday",
      y,
      11,
      th + 1,
      ["retail", "general"],
      "https://www.economie.gouv.fr/particuliers/mes-droits-conso/bien-consommer/tout-savoir-sur-le-black-friday",
    );
  }
  for (const e of custom) {
    if (e.date >= start && e.date <= end && !c.calendarHidden?.includes(e.id))
      events.push({
        id: e.id,
        key: e.id,
        date: e.date,
        title: e.title,
        angle: e.angle,
        sector,
        country,
        product_id: e.product_id || null,
        source: "",
        custom: true,
      });
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}
const concepts = [
  [
    "Découverte",
    "Presentación",
    "Introduction",
    ["Le premier regard sur {p}", "La primera impresión de {p}", "A first look at {p}"],
    ["Voici le détail qui attire l’œil.", "Este detalle merece un primer plano.", "This detail deserves a close-up."],
  ],
  [
    "Détail",
    "Detalle",
    "Detail",
    ["Un détail de {p} à regarder de près", "Un detalle de {p}, de cerca", "One detail of {p}, up close"],
    ["On se rapproche pour mieux le voir.", "Acércate para verlo mejor.", "Come closer for a better look."],
  ],
  [
    "Démonstration",
    "Demostración",
    "Demonstration",
    ["{p} en action", "{p} en acción", "{p} in action"],
    ["Voilà comment nous l’utilisons.", "Así lo usamos, paso a paso.", "Here is how we use it."],
  ],
  [
    "Coulisses",
    "Detrás de cámaras",
    "Behind the scenes",
    ["Les mains derrière {p}", "Las manos detrás de {p}", "The hands behind {p}"],
    [
      "Derrière cette image, il y a un geste.",
      "Detrás de esta imagen hay un gesto.",
      "Behind this image is a real gesture.",
    ],
  ],
  [
    "Question",
    "Pregunta",
    "Question",
    ["Une question sur {p}", "Una pregunta sobre {p}", "One question about {p}"],
    ["La question que vous pouvez nous poser.", "Una pregunta que nos puedes hacer.", "A question you can ask us."],
  ],
  [
    "Texture",
    "Textura",
    "Texture",
    ["La matière de {p}", "La textura de {p}", "The texture of {p}"],
    ["La texture parle d’elle-même.", "La textura habla por sí sola.", "Let the texture do the talking."],
  ],
  [
    "Usage",
    "Uso",
    "Use",
    ["{p} dans une vraie journée", "{p} en un día real", "{p} in a real day"],
    ["Et si on vous montrait le contexte ?", "¿Y si te mostramos el contexto?", "Let us show you the setting."],
  ],
  [
    "Visage",
    "Persona",
    "People",
    ["Une personne de la marque présente {p}", "Una persona de la marca presenta {p}", "A real person introduces {p}"],
    ["Bonjour, aujourd’hui je vous présente…", "Hola, hoy te presento…", "Hi, today I am introducing…"],
  ],
  [
    "Préparation",
    "Preparación",
    "Preparation",
    ["Avant de filmer {p}", "Antes de grabar {p}", "Before filming {p}"],
    ["Ce que vous ne voyez pas encore.", "Lo que todavía no ves.", "What you do not see yet."],
  ],
  [
    "Conseil",
    "Consejo",
    "Tip",
    ["Un conseil concret autour de {p}", "Un consejo concreto sobre {p}", "One practical tip about {p}"],
    ["Un conseil simple, à garder.", "Un consejo sencillo para guardar.", "One simple tip to save."],
  ],
  [
    "POV",
    "POV",
    "POV",
    ["POV : vous découvrez {p}", "POV: descubres {p}", "POV: you discover {p}"],
    ["Vous êtes à la place du client.", "Ponte en el lugar del cliente.", "See it from the customer’s perspective."],
  ],
  [
    "Comparaison",
    "Comparación",
    "Comparison",
    ["Deux mises en scène pour {p}", "Dos escenas para {p}", "Two settings for {p}"],
    [
      "Vous préférez la première ou la seconde ?",
      "¿Prefieres la primera o la segunda?",
      "Which setting do you prefer?",
    ],
  ],
  [
    "Histoire",
    "Historia",
    "Story",
    ["Pourquoi montrer {p} ainsi ?", "¿Por qué mostrar {p} así?", "Why show {p} this way?"],
    ["Le choix derrière cette image.", "La decisión detrás de esta imagen.", "The choice behind this image."],
  ],
  [
    "Pratique",
    "Práctico",
    "Practical",
    ["Ce qu’il faut savoir sur {p}", "Lo que conviene saber sobre {p}", "What to know about {p}"],
    ["Trois informations, simplement.", "Tres datos, sin complicaciones.", "Three facts, simply explained."],
  ],
  [
    "Rituel",
    "Ritual",
    "Ritual",
    ["Un petit rituel avec {p}", "Un pequeño ritual con {p}", "A small ritual with {p}"],
    ["Un geste simple dans votre journée.", "Un gesto sencillo en tu día.", "One simple moment in your day."],
  ],
  [
    "Immersion",
    "Inmersión",
    "Immersion",
    ["Une ambiance autour de {p}", "Un ambiente alrededor de {p}", "An atmosphere around {p}"],
    [
      "Quelques secondes pour entrer dans notre univers.",
      "Unos segundos para entrar en nuestro mundo.",
      "A few seconds inside our world.",
    ],
  ],
  [
    "Réponse",
    "Respuesta",
    "Answer",
    ["Répondre en images à propos de {p}", "Responder con imágenes sobre {p}", "Answer a question about {p} visually"],
    [
      "La réponse tient en une démonstration.",
      "La respuesta está en esta demostración.",
      "The answer is in this demonstration.",
    ],
  ],
  [
    "Inspiration",
    "Inspiración",
    "Inspiration",
    ["Une autre façon de présenter {p}", "Otra forma de presentar {p}", "Another way to present {p}"],
    [
      "Même produit, autre point de vue.",
      "El mismo producto, otra perspectiva.",
      "The same product, a new perspective.",
    ],
  ],
  [
    "Équipe",
    "Equipo",
    "Team",
    ["Un regard de l’équipe sur {p}", "La mirada del equipo sobre {p}", "The team’s take on {p}"],
    [
      "Notre équipe choisit un détail à montrer.",
      "El equipo elige un detalle para mostrar.",
      "Our team picks one detail to show.",
    ],
  ],
  [
    "Son",
    "Sonido",
    "Sound",
    ["Le son réel autour de {p}", "El sonido real alrededor de {p}", "The real sounds around {p}"],
    ["Monte le son et observe.", "Sube el volumen y observa.", "Turn the sound up and watch."],
  ],
  [
    "Choix",
    "Elección",
    "Choice",
    ["Choisir comment utiliser {p}", "Elegir cómo usar {p}", "Choosing how to use {p}"],
    ["Commencez par votre besoin.", "Empieza por lo que necesitas.", "Start with what you need."],
  ],
  [
    "Valeur",
    "Valor",
    "Value",
    ["Ce que nous préservons dans {p}", "Lo que cuidamos en {p}", "What we preserve in {p}"],
    ["Ce détail compte pour nous.", "Este detalle nos importa.", "This detail matters to us."],
  ],
  [
    "Rythme",
    "Ritmo",
    "Rhythm",
    ["Trois plans pour {p}", "Tres tomas para {p}", "Three shots for {p}"],
    [
      "Une vue d’ensemble, un geste, un détail.",
      "Una vista general, un gesto, un detalle.",
      "A wide shot, a gesture, a detail.",
    ],
  ],
  [
    "Simplicité",
    "Sencillez",
    "Simplicity",
    ["{p}, sans mise en scène compliquée", "{p}, sin un montaje complicado", "{p}, without a complicated setup"],
    [
      "Une fenêtre, un téléphone, notre produit.",
      "Una ventana, un teléfono, nuestro producto.",
      "A window, a phone, our product.",
    ],
  ],
  [
    "Questions-réponses",
    "Preguntas y respuestas",
    "Q&A",
    [
      "Une réponse de la personne qui connaît {p}",
      "Una respuesta de quien conoce {p}",
      "An answer from someone who knows {p}",
    ],
    ["Posez-nous votre prochaine question.", "Haznos tu próxima pregunta.", "Ask us your next question."],
  ],
  [
    "Situation",
    "Situación",
    "Situation",
    ["Le bon contexte pour {p}", "El contexto adecuado para {p}", "The right context for {p}"],
    [
      "À quel moment vous imaginez-vous ici ?",
      "¿En qué momento te imaginas aquí?",
      "When can you picture yourself here?",
    ],
  ],
  [
    "Transmission",
    "Conocimiento",
    "Know-how",
    ["Un geste à expliquer autour de {p}", "Un gesto que explicar sobre {p}", "One gesture to explain around {p}"],
    ["Regardez ce geste, lentement.", "Mira este gesto, despacio.", "Watch this gesture, slowly."],
  ],
  [
    "Communauté",
    "Comunidad",
    "Community",
    ["Votre regard sur {p}", "Tu mirada sobre {p}", "Your take on {p}"],
    [
      "Qu’aimeriez-vous voir la prochaine fois ?",
      "¿Qué te gustaría ver la próxima vez?",
      "What would you like to see next?",
    ],
  ],
  [
    "Sélection",
    "Selección",
    "Selection",
    ["Notre sélection du mois : {p}", "Nuestra selección del mes: {p}", "Our selection of the month: {p}"],
    [
      "Un produit à redécouvrir ce mois-ci.",
      "Un producto para redescubrir este mes.",
      "A product to rediscover this month.",
    ],
  ],
  [
    "Invitation",
    "Invitación",
    "Invitation",
    ["Le prochain pas avec {p}", "El siguiente paso con {p}", "The next step with {p}"],
    ["Vous voulez en savoir plus ?", "¿Quieres saber más?", "Want to know more?"],
  ],
];
export function buildIdeas(client, products, month, events = []) {
  const c = typeof client.config === "string" ? JSON.parse(client.config) : client.config,
    lang = ["fr", "es", "en"].includes(c.language) ? c.language : "fr",
    li = { fr: 0, es: 1, en: 2 }[lang],
    rotation = (Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7))) % 30;
  if (isCreator(c)) return buildCreatorIdeas(client, month, events);
  const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const seasonal = events.filter((e) => e.date.startsWith(month));
  return Array.from({ length: 30 }, (_, i) => {
    const concept = concepts[(i + rotation) % 30],
      p = products.length ? products[(i + Number(month.slice(5, 7))) % products.length] : null,
      name = p?.name || c.brand || client.name,
      // Ce qu'on filme : le produit (jamais le nom de la marque, qu'on ne peut pas filmer).
      shotName = p?.name || ["votre produit", "tu producto", "your product"][li];
    const title = concept[3][li].replaceAll("{p}", name),
      hook = concept[4][li];
    const detail = String(p?.preserve || c.rules || "").slice(0, 220),
      fact = String(p?.description || "").slice(0, 300);
    const scenes =
      lang === "es"
        ? [
            `0–3 s · Plano vertical de ${shotName}, con luz de ventana.`,
            `3–15 s · Mostrar ${i % 3 === 0 ? "un gesto real de uso" : i % 3 === 1 ? "un detalle visible" : "su contexto cotidiano"}. Referencia a respetar: ${detail || "forma y colores reales"}.`,
            `15–25 s · ${i % 2 ? "Una persona lo presenta a cámara" : "Volver al producto en primer plano"} y cerrar con la llamada a la acción.`,
          ]
        : lang === "en"
          ? [
              `0–3 s · Vertical establishing shot of ${shotName} in window light.`,
              `3–15 s · Show ${i % 3 === 0 ? "a real gesture of use" : i % 3 === 1 ? "a visible detail" : "its everyday setting"}. Preserve: ${detail || "real form and colors"}.`,
              `15–25 s · ${i % 2 ? "A real person introduces it" : "Return to a close-up"}, then the call to action.`,
            ]
          : [
              `0–3 s · Plan vertical de ${shotName}, à la lumière d’une fenêtre.`,
              `3–15 s · Montrer ${i % 3 === 0 ? "un geste réel d’utilisation" : i % 3 === 1 ? "un détail visible" : "son contexte quotidien"}. À préserver : ${detail || "la forme et les couleurs réelles"}.`,
              `15–25 s · ${i % 2 ? "Une personne le présente face caméra" : "Revenir au produit en gros plan"}, puis terminez par l’appel à l’action.`,
            ];
    const cta =
      c.quality?.action ||
      (lang === "es"
        ? i % 3 === 0
          ? "Guarda esta idea y escríbenos para más información."
          : i % 3 === 1
            ? "Cuéntanos en comentarios qué detalle te gustaría ver."
            : "Escríbenos para conocer este producto."
        : lang === "en"
          ? i % 3 === 0
            ? "Save this and message us for more information."
            : i % 3 === 1
              ? "Tell us which detail you want to see next."
              : "Message us to find out more about this product."
          : i % 3 === 0
            ? "Enregistrez cette idée et écrivez-nous pour en savoir plus."
            : i % 3 === 1
              ? "Dites-nous quel détail vous aimeriez voir."
              : "Écrivez-nous pour découvrir ce produit.");
    const event = i < seasonal.length ? seasonal[i] : null;
    return {
      slot: i + 1,
      title: event ? `${title} · ${event.title}` : title,
      hook: event ? `${hook} ${event.title}.` : hook,
      scenes,
      narration: [hook, fact, cta].filter(Boolean).join(" "),
      cta,
      product_id: p?.id || null,
      product_name: name,
      language: lang,
      category: concept[li],
      duration: "15–30 s",
      format: "9:16",
      suggested_date:
        event?.date || `${month}-${String(Math.min(days, 1 + Math.floor((i * days) / 30))).padStart(2, "0")}`,
      occasion_id: event?.id || null,
      notes: [
        qualityContext(
          Object.fromEntries(
            Object.entries(c.quality || {}).filter(([k]) =>
              [
                "audience",
                "objective",
                "visualWorld",
                "avoidVisual",
                "videoSubjects",
                "videoHook",
                "videoAudio",
                "successCriteria",
              ].includes(k),
            ),
          ),
        ),
        lang === "es"
          ? "Usa únicamente información confirmada. No inventes testimonios, resultados ni descuentos."
          : lang === "en"
            ? "Use confirmed facts only. Do not invent testimonials, outcomes or discounts."
            : "Utiliser uniquement les informations confirmées. Ne pas inventer de témoignages, de résultats ou de remises.",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  });
}
