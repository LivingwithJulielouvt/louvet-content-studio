// Pure client display helpers. No global theme state: each render uses one client's config.
export function paletteFor(config = {}) {
  const colors = String(config.colors || "")
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map((x) => (/^#[0-9a-f]{3}$/i.test(x) ? "#" + [...x.slice(1)].map((c) => c + c).join("") : x))
    .filter((x) => /^#[0-9a-f]{6}$/i.test(x))
    .slice(0, 4);
  return colors.length ? colors : ["#19352d", "#f5f3eb"];
}
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, p) =>
  "#" +
  rgb(a)
    .map((v, i) =>
      Math.round(v * (1 - p) + rgb(b)[i] * p)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
function luminance(h) {
  return rgb(h)
    .map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function studioTheme(config = {}) {
  const [primary, secondary = "#f5f3eb"] = paletteFor(config),
    vibe = ["clean", "warm", "bold"].includes(config.studioVibe) ? config.studioVibe : "clean";
  const on = contrast(primary, "#ffffff") >= contrast(primary, "#111111") ? "#ffffff" : "#111111",
    ink = mix(primary, "#111111", 0.83),
    soft = mix(primary, "#ffffff", 0.92),
    background = mix(vibe === "warm" ? secondary : primary, "#ffffff", vibe === "bold" ? 0.94 : 0.975);
  return {
    "--brand": primary,
    "--brand-secondary": secondary,
    "--brand-on": on,
    "--brand-strong": contrast(primary, "#ffffff") >= 4.5 ? primary : mix(primary, "#111111", 0.65),
    "--ink": ink,
    "--dark": ink,
    "--cream": background,
    "--paper": "#ffffff",
    "--muted": mix(ink, "#ffffff", 0.3),
    "--line": mix(primary, "#ffffff", 0.82),
    "--mint": secondary,
    "--mint-soft": soft,
    "--warm": mix(secondary, "#ffffff", 0.7),
    "--client-radius": vibe === "warm" ? "20px" : vibe === "bold" ? "8px" : "12px",
    "--client-heading": vibe === "warm" ? "Georgia, 'Times New Roman', serif" : "'Manrope Variable', 'Manrope', Arial, sans-serif",
  };
}
// Plain language for saved legacy instructions as well as newly prepared ideas.
const terms = {
  fr: [
    [/\bplan d[’']illustration\b/gi, "petite vidéo pour montrer ce dont vous parlez"],
    [/\bplan de coupe\b/gi, "petite vidéo à ajouter entre deux passages"],
    [/\bface caméra(?=$|[\s.,;:!?…»)])/gi, "en regardant l’objectif du téléphone"],
    [/\bappel à l[’']action\b/gi, "phrase qui dit quoi faire ensuite"],
    [/\bpiliers? éditoriaux?\b/gi, "sujets habituels"],
    [/\bvoix off\b/gi, "paroles entendues pendant les images"],
    [/\bgros plan\b/gi, "vue de près : le sujet remplit presque l’image"],
    [/\bplan large\b/gi, "vue de loin : on voit le sujet entier et ce qui l’entoure"],
    [/\bplan vertical\b/gi, "vidéo avec le téléphone debout"],
    [/\bplan serré(?=$|[\s.,;:!?…»)])/gi, "vue de près"],
    [/\bcontre[- ]plongée\b/gi, "téléphone placé plus bas que le sujet, dirigé vers le haut"],
    [/\bplongée\b/gi, "téléphone placé au-dessus du sujet, dirigé vers le bas"],
    [/\btravelling\b/gi, "déplacement lent du téléphone sur le côté"],
    [/\bpanoramique\b/gi, "mouvement lent du téléphone de gauche à droite"],
    [/\bson contexte quotidien\b/gi, "l’endroit où vous l’utilisez dans une journée normale"],
    [/\bun geste réel d’utilisation\b/gi, "comment vous utilisez le produit, comme d’habitude"],
    [/À préserver\s*:/gi, "Ne changez pas ces éléments :"],
    [/\bDévelopper un exemple réel de\b/gi, "Racontez un exemple que vous connaissez sur"],
    [/\bSRT\b/g, "de sous-titres fourni par l’agence"],
    [/\brush(?:es)?\b/gi, "petites vidéos"],
    [/\bhook\b/gi, "première phrase"],
    [/\bCTA\b/g, "phrase de fin"],
    [/\bPOV\b/g, "Comme si vous étiez à la place du client"],
    [/\bb[- ]?roll\b/gi, "petite vidéo pour montrer ce dont vous parlez"],
  ],
  es: [
    [/\bplano vertical\b/gi, "video con el teléfono de pie"],
    [/\bprimer plano\b/gi, "vista de cerca: el objeto ocupa casi toda la imagen"],
    [/\bplano general\b/gi, "vista de lejos: se ve el objeto completo y lo que lo rodea"],
    [/\btoma de apoyo\b/gi, "video corto para mostrar de qué hablas"],
    [/\bllamada a la acción\b/gi, "frase que dice qué hacer después"],
    [/\bpilares editoriales\b/gi, "temas habituales"],
    [/\bvoz en off\b/gi, "palabras que se escuchan mientras aparecen las imágenes"],
    [/\bhook\b/gi, "primera frase"],
    [/\bCTA\b/g, "frase final"],
    [/\bPOV\b/g, "Como si fueras el cliente"],
    [/\brush(?:es)?\b/gi, "videos cortos"],
  ],
  en: [
    [/\bvertical establishing shot\b/gi, "video showing the whole subject, with your phone upright"],
    [/\bwide shot\b/gi, "view from far enough away to show the whole subject"],
    [/\bclose[- ]up\b/gi, "view from close enough for the subject to fill the picture"],
    [/\bsupporting shot\b/gi, "short video showing what you are talking about"],
    [/\bcall to action\b/gi, "sentence saying what to do next"],
    [/\beditorial pillars\b/gi, "usual topics"],
    [/\bvoice[- ]over\b/gi, "words heard while the images play"],
    [/\bhook\b/gi, "opening sentence"],
    [/\bCTA\b/g, "closing sentence"],
    [/\bPOV\b/g, "As if you were the customer"],
    [/\brush(?:es)?\b/gi, "short videos"],
  ],
};
export function plainText(input, language = "fr") {
  let s = String(input ?? "");
  for (const [pattern, replacement] of terms[language] || terms.fr) s = s.replace(pattern, replacement);
  return s.replace(/\bl[’']phrase/g, "la phrase");
}
export function filmingGuide(content = {}, config = {}) {
  const language = ["fr", "es", "en"].includes(content.language || config.language)
      ? content.language || config.language
      : "fr",
    creator = config.workspaceType === "creator";
  const copy = {
    fr: {
      title: "Comment filmer cette idée",
      intro:
        "Un téléphone suffit. Filmez une petite vidéo par étape. Vous pourrez recommencer autant de fois que vous voulez.",
      before: "Avant de commencer",
      setup: [
        "Nettoyez l’objectif du téléphone avec un tissu doux.",
        "Tenez le téléphone debout, comme pour lire un message.",
        "Placez-vous près d’une fenêtre. La lumière doit éclairer le sujet, pas venir de derrière.",
        "Posez le téléphone sur un support stable, ou tenez-le avec les deux mains.",
      ],
      step: "Petite vidéo",
      action: "Ce que vous faites",
      place: "Où mettre le téléphone",
      duration: "Temps à filmer",
      seconds: "secondes",
      finish:
        "Appuyez sur le bouton rouge pour filmer. À la fin, appuyez à nouveau pour arrêter. Gardez la vidéo dans votre téléphone.",
      general: "Placez le téléphone assez loin pour voir le sujet en entier. Gardez-le immobile.",
      below: "Placez le téléphone plus bas que le sujet et dirigez-le légèrement vers le haut.",
      moving:
        "Tenez le téléphone avec les deux mains. Faites le mouvement demandé très lentement, sans secouer le téléphone.",
      close:
        "Approchez doucement le téléphone pour remplir l’image avec ce détail. Arrêtez dès que l’image est nette. Ne zoomez pas avec vos doigts.",
      face: "Posez le téléphone à hauteur de vos yeux. Regardez le petit objectif, pas votre image à l’écran.",
      above: "Placez le téléphone au-dessus du sujet, dirigé vers le bas. Vérifiez que votre ombre ne le cache pas.",
      fallback: creator ? "Montrez une chose réelle dont vous voulez parler." : "Montrez le produit tel qu’il est.",
      next: "Ensuite, cliquez sur « Ajouter mes vidéos » pour les envoyer au studio.",
      help: "Besoin d’aide ? Demandez à votre agence.",
    },
    es: {
      title: "Cómo grabar esta idea",
      intro: "Solo necesitas tu teléfono. Graba un video corto por paso. Puedes repetirlo las veces que quieras.",
      before: "Antes de empezar",
      setup: [
        "Limpia la lente del teléfono con un paño suave.",
        "Sostén el teléfono de pie, como cuando lees un mensaje.",
        "Acércate a una ventana. La luz debe iluminar lo que grabas, no venir de atrás.",
        "Apoya el teléfono en algo estable o sujétalo con las dos manos.",
      ],
      step: "Video corto",
      action: "Qué hacer",
      place: "Dónde colocar el teléfono",
      duration: "Tiempo de grabación",
      seconds: "segundos",
      finish: "Pulsa el botón rojo para grabar. Al terminar, vuelve a pulsarlo. Guarda el video en tu teléfono.",
      general: "Coloca el teléfono lo bastante lejos para ver el objeto completo. No lo muevas.",
      below: "Pon el teléfono más abajo que el objeto y apunta ligeramente hacia arriba.",
      moving: "Sujeta el teléfono con las dos manos. Haz el movimiento pedido muy despacio, sin sacudirlo.",
      close:
        "Acerca despacio el teléfono para que el detalle llene la imagen. Detente cuando se vea nítido. No amplíes con los dedos.",
      face: "Coloca el teléfono a la altura de tus ojos. Mira la pequeña lente, no tu imagen en pantalla.",
      above: "Pon el teléfono encima del objeto, apuntando hacia abajo. Evita que tu sombra lo tape.",
      fallback: creator ? "Muestra algo real de lo que quieras hablar." : "Muestra el producto tal como es.",
      next: "Después, añade tus videos al estudio.",
      help: "¿Necesitas ayuda? Pregunta a tu agencia.",
    },
    en: {
      title: "How to film this idea",
      intro:
        "Your phone is all you need. Record one short video for each step. You can try again as often as you like.",
      before: "Before you start",
      setup: [
        "Clean your phone lens with a soft cloth.",
        "Hold your phone upright, as if reading a message.",
        "Stand near a window. The light should fall on your subject, not come from behind.",
        "Rest your phone on something steady, or hold it with both hands.",
      ],
      step: "Short video",
      action: "What to do",
      place: "Where to put your phone",
      duration: "How long to record",
      seconds: "seconds",
      finish: "Press the red button to record. Press it again to stop. Keep the video on your phone.",
      general: "Place your phone far enough away to show the whole subject. Keep it still.",
      below: "Place your phone below the subject and point it slightly upward.",
      moving: "Hold your phone with both hands. Make the requested movement slowly without shaking it.",
      close:
        "Move your phone closer until the detail fills the picture and looks sharp. Do not zoom with your fingers.",
      face: "Place your phone at eye level. Look at the small lens, not your picture on the screen.",
      above: "Hold your phone above the subject, pointing down. Make sure your shadow does not cover it.",
      fallback: creator ? "Show something real you want to talk about." : "Show the product as it really is.",
      next: "Then add your videos to the studio.",
      help: "Need help? Ask your agency.",
    },
  }[language];
  const scenes = Array.isArray(content.scenes) && content.scenes.length ? content.scenes.slice(0, 6) : [copy.fallback];
  const steps = scenes.map((scene, i) => {
    const original = String(scene);
    let action = plainText(original, language)
      .replace(/^\s*\d+(?:[.,]\d+)?\s*[–—-]\s*\d+(?:[.,]\d+)?\s*s(?:ec(?:ondes|onds)?)?\s*[·:.—-]?\s*/i, "")
      .trim();
    if (language === "fr") {
      action = action
        .replace(
          /^vidéo avec le téléphone debout de (.+), à la lumière d’une fenêtre\.$/,
          "Filmez $1 près d’une fenêtre.",
        )
        .replace(/^Montrer /, "Montrez ")
        .replace(/^Revenir au produit en /, "Filmez à nouveau le produit en ")
        .replace(/^Une personne le présente /, "Demandez à une personne de présenter le produit ")
        .replace(/^Plan vertical de (.+), à la lumière d’une fenêtre\.$/, "Filmez $1 près d’une fenêtre.")
        .replace(/, puis terminer par /, ", puis terminez par ");
    }
    const isFace = /face caméra|à caméra|a cámara|en cámara|on camera|eye.level|regardant l’objectif/i.test(original),
      isClose = /gros plan|plan serré|primer plano|close.up|de près|de cerca|detail|détail|detalle/i.test(original),
      isBelow = /contre[- ]plongée|desde abajo|low.angle/i.test(original),
      isAbove = /plongée|dessus|desde arriba|overhead|top.down/i.test(original),
      isMoving = /travelling|panoramique|panorámica|tracking shot|panning/i.test(original);
    const say =
      i === scenes.length - 1 && content.cta && !action.includes(content.cta)
        ? plainText(content.cta, language)
        : i === 0 && creator && content.hook && !action.includes(content.hook)
          ? plainText(content.hook, language)
          : null;
    return {
      number: i + 1,
      action: action || copy.fallback,
      say,
      position: isFace
        ? copy.face
        : isBelow
          ? copy.below
          : isAbove
            ? copy.above
            : isMoving
              ? copy.moving
              : isClose
                ? copy.close
                : copy.general,
      seconds: i === 0 ? 5 : i === 1 ? 15 : 8,
    };
  });
  return { language, ...copy, steps };
}
