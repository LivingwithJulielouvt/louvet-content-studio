import { creatorContext } from "./workspaces.mjs";
// Titres écrits avec la voix de la créatrice (« je »), autour de ses thèmes.
const formats = [
  ["Ce que j’ai appris sur {p}", "Lo que aprendí sobre {p}", "What I learned about {p}"],
  ["Les coulisses de {p}", "Detrás de cámaras: {p}", "Behind the scenes: {p}"],
  ["L’idée reçue sur {p} que je démonte", "El mito sobre {p} que desmonto", "The myth about {p} I bust"],
  ["Mes 3 astuces pour {p}", "Mis 3 trucos para {p}", "My 3 tips for {p}"],
  ["Je réponds à vos questions sur {p}", "Respondo tus preguntas sobre {p}", "Answering your questions about {p}"],
  ["Mon geste simple pour {p}", "Mi gesto sencillo para {p}", "My simple move for {p}"],
  ["Ce qui m’inspire dans {p}", "Lo que me inspira de {p}", "What inspires me about {p}"],
  ["Deux façons de vivre {p}", "Dos formas de vivir {p}", "Two ways I do {p}"],
  ["Mon outil préféré pour {p}", "Mi herramienta favorita para {p}", "My favorite tool for {p}"],
  ["Parlons de {p}", "Hablemos de {p}", "Let’s talk about {p}"],
];
const hooks = [
  [
    "Une chose que j’ai apprise sur ce sujet…",
    "Algo que aprendí sobre este tema…",
    "One thing I learned about this subject…",
  ],
  [
    "Voici ce que vous ne voyez pas toujours.",
    "Esto es lo que no siempre se ve.",
    "Here is what you do not always see.",
  ],
  [
    "Et si on regardait cette idée autrement ?",
    "¿Y si vemos esta idea de otra manera?",
    "What if we looked at this idea differently?",
  ],
  [
    "Mes trois astuces pour commencer, simplement.",
    "Mis tres trucos para empezar sin complicarte.",
    "My three simple tips to get started.",
  ],
  ["Quelle question aimeriez-vous me poser ?", "¿Qué pregunta te gustaría hacerme?", "What would you like to ask me?"],
  ["Un petit geste que vous pouvez essayer.", "Un pequeño gesto que puedes probar.", "One small action you can try."],
  [
    "Voilà ce qui me donne envie de créer.",
    "Esto es lo que me inspira a crear.",
    "This is what inspires me to create.",
  ],
  [
    "Deux approches, selon votre situation.",
    "Dos enfoques, según tu situación.",
    "Two approaches, depending on your situation.",
  ],
  [
    "Une ressource à explorer à votre rythme.",
    "Un recurso para explorar a tu ritmo.",
    "One resource to explore at your own pace.",
  ],
  [
    "J’aimerais connaître votre point de vue.",
    "Me gustaría conocer tu punto de vista.",
    "I would love to hear your perspective.",
  ],
];
export function buildCreatorIdeas(client, month, events = []) {
  const c = typeof client.config === "string" ? JSON.parse(client.config) : client.config,
    s = c.creatorStrategy || {},
    lang = ["fr", "es", "en"].includes(c.language) ? c.language : "fr",
    li = { fr: 0, es: 1, en: 2 }[lang],
    pillars = s.pillars?.length
      ? s.pillars
      : [lang === "es" ? "mi día a día" : lang === "en" ? "my everyday life" : "mon quotidien"];
  const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate(),
    rotation = (Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7))) % 10,
    seasonal = events.filter((e) => e.date.startsWith(month));
  return Array.from({ length: 30 }, (_, i) => {
    const n = (i + rotation) % 10,
      pillar = pillars[i % pillars.length],
      round = Math.floor(i / 10),
      angle = [
        ["Mon expérience", "Mon avis", "À tester"],
        ["Mi experiencia", "Mi opinión", "Para probar"],
        ["My experience", "My take", "To try"],
      ][li][round],
      hook = hooks[n][li],
      title =
        formats[n][li].replace("{p}", pillar) +
        [
          ["", " · mon point de vue", " · à tester"],
          ["", " · mi punto de vista", " · para probar"],
          ["", " · my take", " · to try"],
        ][li][round];
    const cta =
      s.action ||
      (lang === "es"
        ? "Cuéntame qué te gustaría ver después."
        : lang === "en"
          ? "Tell me what you would like to see next."
          : "Dites-moi ce que vous aimeriez voir ensuite.");
    const scenes =
      lang === "es"
        ? [
            `0–3 s · Presenta la idea « ${hook} » en cámara o con una toma de apoyo sobre ${pillar}.`,
            `3–20 s · Desarrolla un ejemplo real de ${pillar}, desde el ángulo « ${angle} ». Elige solo hechos y experiencias propios que puedas compartir.`,
            `20–30 s · Cierra con esta acción: ${cta}`,
          ]
        : lang === "en"
          ? [
              `0–3 s · Introduce “${hook}” on camera or with a supporting shot about ${pillar}.`,
              `3–20 s · Develop a real example about ${pillar} from the “${angle}” angle. Use only your own shareable facts and experiences.`,
              `20–30 s · Close with this action: ${cta}`,
            ]
          : [
              `0–3 s · Présenter « ${hook} » face caméra ou sur un plan d’illustration autour de ${pillar}.`,
              `3–20 s · Développer un exemple réel de ${pillar}, sous l’angle « ${angle} ». Choisir uniquement des faits et expériences que vous pouvez partager.`,
              `20–30 s · Terminer par cette action : ${cta}`,
            ];
    const outline =
      lang === "es"
        ? `${hook}\n[Completa con tu ejemplo real sobre ${pillar}. No inventes una experiencia ni una colaboración.]\n${cta}`
        : lang === "en"
          ? `${hook}\n[Add your real example about ${pillar}. Do not invent an experience or partnership.]\n${cta}`
          : `${hook}\n[Complétez avec votre exemple réel autour de ${pillar}. N’inventez pas d’expérience ni de partenariat.]\n${cta}`;
    const event = i < seasonal.length ? seasonal[i] : null;
    return {
      slot: i + 1,
      title,
      hook,
      scenes,
      narration: outline,
      script_status: "outline",
      coverTitle: formats[n][li].replace("{p}", pillar),
      cta,
      pillar,
      platform: s.platforms?.[i % Math.max(1, s.platforms.length)] || "Instagram",
      product_id: null,
      product_name: s.displayName || c.brand || client.name,
      language: lang,
      category: angle,
      duration: "15–30 s",
      format: "9:16",
      suggested_date:
        event?.date || `${month}-${String(Math.min(days, 1 + Math.floor((i * days) / 30))).padStart(2, "0")}`,
      occasion_id: event?.id || null,
      notes: [
        creatorContext(s),
        event
          ? (lang === "es" ? "Ocasión opcional: " : lang === "en" ? "Optional occasion: " : "Occasion facultative : ") +
            event.title +
            ". " +
            event.angle
          : "",
        lang === "es"
          ? "Guion orientativo por personalizar. Respeta tu privacidad; no inventes experiencias, cifras ni colaboraciones."
          : lang === "en"
            ? "Outline to personalize. Respect your privacy; never invent experiences, metrics or partnerships."
            : "Trame à personnaliser. Respectez votre vie privée ; ne jamais inventer de vécu, de chiffres ni de collaborations.",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  });
}
