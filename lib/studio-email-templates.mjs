export const MAIL_COPY_VERSION = "louvet-2026-10-26-v5";
const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export function studioEmail(
  kind,
  language,
  {
    firstName = "[Prénom]",
    studioUrl = "[Lien du studio]",
    fact = null,
    unsubscribeUrl = "[Lien de désinscription]",
    count = 6,
  } = {},
) {
  const lang = language === "es" || language === "en" ? language : "fr",
    pick = (fr, es, en) => (lang === "es" ? es : lang === "en" ? en : fr),
    es = lang === "es",
    name = firstName,
    sign = pick("L’équipe Louvet & Partners", "El equipo de Louvet & Partners", "The Louvet & Partners team"),
    hello = pick(`Bonjour ${name},`, `Hola ${name},`, `Hi ${name},`),
    soon = pick("À très vite,", "Hasta muy pronto,", "Talk soon,");
  let subject,
    paragraphs,
    cta = null;
  if (kind === "received") {
    subject = pick("Demande reçue", "Recibimos tu solicitud", "We’ve received your request");
    paragraphs = [
      hello,
      pick(
        "Votre demande est bien arrivée. Nous allons lire vos réponses et préparer votre studio avec soin.",
        "Ya recibimos tu solicitud. Vamos a leer tus respuestas y preparar tu estudio con mucho cuidado.",
        "Your request has arrived. We’ll read your answers and set up your studio with care.",
      ),
      pick("Nous vous écrivons dès qu’il est prêt.", "Te avisamos en cuanto esté listo.", "We’ll email you as soon as it’s ready."),
      soon,
      sign,
    ];
  } else if (kind === "welcome") {
    subject = pick("Bienvenue, votre compte est actif", "¡Tu cuenta ya está activa!", "Welcome, your account is active");
    paragraphs = [
      hello,
      pick(
        "Votre studio est prêt ! Nous l’avons préparé pour vous, à partir de vos réponses.",
        "¡Tu estudio está listo! Lo hemos preparado para ti, a partir de tus respuestas.",
        "Your studio is ready! We’ve set it up for you, based on your answers.",
      ),
      pick(
        "Vous pouvez maintenant entrer et créer à votre rythme. Nous avons hâte de vous accompagner.",
        "Ya puedes entrar y crear a tu ritmo. Nos encantará acompañarte.",
        "You can now log in and create at your own pace. We can’t wait to work with you.",
      ),
      soon,
      sign,
    ];
    cta = pick("Accéder à mon studio", "Entrar a mi estudio", "Open my studio");
  } else if (kind === "weekly") {
    subject = pick("Une petite idée pour votre semaine", "Una pequeña idea para tu semana", "A little idea for your week");
    // Le chiffre de la semaine n'existe parfois qu'en français et en espagnol : en anglais, on l'omet s'il manque.
    const factText = fact ? pick(fact.text_fr, fact.text_es, fact.text_en) : null,
      showFact = !fact || !!factText;
    const value = fact ? factText : pick("[CHIFFRE CLÉ VALIDÉ]", "[DATO CLAVE VALIDADO]", "[VALIDATED KEY FIGURE]");
    const source = fact
      ? `${fact.source_title} · ${fact.source_date} · ${fact.source_url}`
      : pick("[SOURCE · DATE · LIEN]", "[FUENTE · FECHA · ENLACE]", "[SOURCE · DATE · LINK]");
    paragraphs = [
      hello,
      pick(
        "Et si vous partagiez un contenu cette semaine ? Votre calendrier est là pour vous aider à choisir.",
        "¿Y si compartes un contenido esta semana? Tu calendario te ayuda a elegir qué publicar.",
        "How about sharing a post this week? Your calendar is there to help you choose.",
      ),
      ...(showFact
        ? [
            pick(`Le chiffre de la semaine : ${value}`, `El dato de la semana: ${value}`, `This week’s figure: ${value}`),
            pick(`Source : ${source}`, `Fuente: ${source}`, `Source: ${source}`),
          ]
        : []),
      pick(
        "Une photo, une idée, un petit pas. On est avec vous !",
        "Una foto, una idea, un pequeño paso. ¡Vamos contigo!",
        "One photo, one idea, one small step. We’re with you!",
      ),
      sign,
    ];
    cta = pick("Ouvrir mon studio", "Abrir mi estudio", "Open my studio");
  } else if (kind === "delivery") {
    // Nombre réellement validé par l'agence (6 en général).
    const n = Number.isInteger(Number(count)) && Number(count) > 0 ? Number(count) : 6,
      one = n === 1;
    subject = one
      ? pick("Votre contenu du mois est prêt", "Tu contenido del mes está listo", "Your post for the month is ready")
      : pick(`Vos ${n} contenus du mois sont prêts`, `Tus ${n} contenidos del mes están listos`, `Your ${n} posts for the month are ready`);
    paragraphs = [
      hello,
      pick(
        one
          ? "Votre contenu du mois vous attend dans votre studio : visuel et texte, relus par l’équipe."
          : `Vos ${n} contenus du mois vous attendent dans votre studio : visuels et textes, relus par l’équipe.`,
        one
          ? "Tu contenido del mes ya está en tu estudio: visual y texto, revisados por el equipo."
          : `Tus ${n} contenidos del mes ya están en tu estudio: visuales y textos, revisados por el equipo.`,
        one
          ? "Your post for the month is waiting in your studio: visual and caption, reviewed by the team."
          : `Your ${n} posts for the month are waiting in your studio: visuals and captions, reviewed by the team.`,
      ),
      pick(
        "Il ne vous reste plus qu’à les télécharger ou à les programmer dans votre calendrier.",
        "Solo tienes que descargarlos o programarlos en tu calendario.",
        "All you have to do is download them or schedule them in your calendar.",
      ),
      soon,
      sign,
    ];
    cta = pick("Voir mes contenus", "Ver mis contenidos", "See my posts");
  } else throw Error("Type d’e-mail inconnu.");
  const unsubscribe =
    kind === "weekly"
      ? pick(
          "Ne plus recevoir le rappel du lundi",
          "Dejar de recibir el recordatorio del lunes",
          "Stop receiving the Monday reminder",
        )
      : null;
  const closingCount = kind === "welcome" || kind === "delivery" ? 2 : kind === "weekly" ? 1 : 0,
    main = closingCount ? paragraphs.slice(0, -closingCount) : paragraphs,
    closing = closingCount ? paragraphs.slice(-closingCount) : [];
  const text =
    main.join("\n\n") +
    (cta ? `\n\n${cta} : ${studioUrl}` : "") +
    (closing.length ? "\n\n" + closing.join("\n\n") : "") +
    (unsubscribe ? `\n\n${unsubscribe} : ${unsubscribeUrl}` : "");
  const html = `<html lang="${lang}"><body style="margin:0;background:#f5f3eb;padding:32px 16px"><main style="max-width:560px;margin:auto;background:#fff;padding:32px;font-family:Arial,sans-serif;color:#172d28;line-height:1.7"><p style="font-size:12px;letter-spacing:2px">LOUVET &amp; PARTNERS</p>${main.map((p) => `<p>${escape(p)}</p>`).join("")}${cta ? `<p><a href="${escape(studioUrl)}" style="display:inline-block;background:#172d28;color:#fff;padding:12px 22px;text-decoration:none;border-radius:6px">${escape(cta)}</a></p>` : ""}${closing.map((p) => `<p>${escape(p)}</p>`).join("")}${unsubscribe ? `<p style="font-size:12px"><a href="${escape(unsubscribeUrl)}">${escape(unsubscribe)}</a></p>` : ""}</main></body></html>`;
  return { subject, text, html, cta, paragraphs, unsubscribe };
}
export function emailPreviews() {
  return ["received", "welcome", "weekly", "delivery"].flatMap((kind) =>
    ["fr", "es", "en"].map((language) => ({
      kind,
      language,
      ...studioEmail(kind, language, {
        firstName: language === "es" ? "[Nombre]" : language === "en" ? "[First name]" : "[Prénom]",
      }),
    })),
  );
}
