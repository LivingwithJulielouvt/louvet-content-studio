// Notifications : le texte est enregistré en français (historique, tests, agence) ;
// à l'affichage on fournit les trois langues et l'écran à ouvrir quand on touche la notification.
const MONTHS = {
  fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
/** « 2026-11 » → « novembre 2026 » (ou espagnol / anglais). */
export function monthLabel(month, lang = "fr") {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  if (!m) return String(month || "");
  const name = (MONTHS[lang] || MONTHS.fr)[Number(m[2]) - 1];
  return name ? (lang === "es" ? `${name} de ${m[1]}` : `${name} ${m[1]}`) : String(month);
}
function monthFromFr(text, lang) {
  if (/^\d{4}-\d{2}$/.test(text.trim())) return monthLabel(text.trim(), lang); // anciennes notifications « 2026-10 »
  const m = /^(\S+) (\d{4})$/.exec(text.trim());
  if (!m) return text;
  const i = MONTHS.fr.indexOf(m[1].toLowerCase());
  return i < 0 ? text : lang === "es" ? `${MONTHS.es[i]} de ${m[2]}` : `${MONTHS[lang][i]} ${m[2]}`;
}

// [motif français, espagnol, anglais, écran]. $1… = parties variables reprises telles quelles.
const RULES = [
  [/^Votre création est prête pour validation\.$/, "Tu creación está lista para validar.", "Your creation is ready for review.", "creations"],
  [/^Votre création est disponible\.$/, "Tu creación está disponible.", "Your creation is ready.", "creations"],
  [/^Cette génération nécessite une intervention de l’agence\.$/, "Esta creación necesita la ayuda de la agencia.", "This creation needs help from the agency.", "creations"],
  [/^Votre correction est terminée\. La version précédente est conservée\.$/, "Tu corrección está lista. La versión anterior se conserva.", "Your correction is done. The previous version is kept.", "creations"],
  [/^Votre vidéo finale est disponible\.$/, "Tu video final está disponible.", "Your final video is ready.", "montage"],
  [/^Montage prêt pour validation par l’agence\.$/, "Edición lista para que la agencia la valide.", "Edit ready for the agency to review.", "montage"],
  [/^Une version montée est disponible pour validation\.$/, "Hay un video final listo para validar.", "A final video is ready for review.", "montage"],
  [/^Une vidéo finale est disponible pour validation\.$/, "Hay un video final listo para validar.", "A final video is ready for review.", "montage"],
  [/^Le montage nécessite une intervention\. Vos rushes et versions précédentes sont conservés\.$/, "La edición necesita ayuda. Tus clips y versiones anteriores se conservan.", "The edit needs help. Your clips and previous versions are kept.", "montage"],
  [/^Votre montage vidéo est disponible\.$/, "Tu edición de video está disponible.", "Your video edit is ready.", "montage"],
  [/^Votre montage est enregistré et prêt pour validation par l’agence\.$/, "Tu edición está guardada y lista para que la agencia la valide.", "Your edit is saved and ready for the agency to review.", "montage"],
  [/^Votre contenu a été validé par l’agence\.$/, "La agencia validó tu contenido.", "The agency approved your content.", "creations"],
  [/^Vos 30 idées vidéo pour (.+) sont disponibles\.$/, "Tus 30 ideas de video para $M1 están disponibles.", "Your 30 video ideas for $M1 are ready.", "videos"],
  [/^Vos (\d+) contenus du mois sont prêts : retrouvez-les dans « Mes (?:photos|visuels) »\.$/, "Tus $1 contenidos del mes están listos: los encontrarás en “Mis imágenes”.", "Your $1 posts for the month are ready: find them in “My visuals”.", "creations"],
  [/^Votre demande de rendez-vous a été envoyée à l’agence\.$/, "Tu solicitud de cita se envió a la agencia.", "Your appointment request was sent to the agency.", null],
  [/^Votre rendez-vous avec l’agence est planifié\. Vous recevrez l’invitation par e-mail\.$/, "Tu cita con la agencia está agendada. Recibirás la invitación por correo.", "Your appointment with the agency is scheduled. You’ll get the invitation by email.", null],
  [/^L’agence vous a répondu dans vos messages\.$/, "La agencia te respondió en tus mensajes.", "The agency replied in your messages.", "chat"],
  [/^Tous les plans de « (.+) » sont filmés : le montage automatique est prêt\.$/, "Todas las tomas de “$1” están grabadas: la edición automática está lista.", "All the shots for “$1” are filmed: the automatic edit is ready.", "montage"],
  [/^Votre demande de montage a été enregistrée et transmise à l’agence\.$/, "Tu solicitud de edición se guardó y se envió a la agencia.", "Your edit request was saved and sent to the agency.", "montage"],
  [/^L’agence a relu votre vidéo : (.+)$/s, "La agencia revisó tu video: $1", "The agency reviewed your video: $1", "montage"],
  [/^L’agence a relu votre vidéo\. Vous pouvez la publier\.$/, "La agencia revisó tu video. Ya puedes publicarlo.", "The agency reviewed your video. You can post it.", "montage"],
  [/^Votre agence a préparé votre espace\. Votre studio est ouvert\.$/, "Tu agencia preparó tu espacio. Tu estudio está abierto.", "Your agency has set up your space. Your studio is open.", "overview"],
  [/^Votre agence vous demande de préciser vos réponses : (.+)$/s, "Tu agencia te pide precisar tus respuestas: $1", "Your agency asks you to clarify your answers: $1", "overview"],
  [/^Votre offre de collaboration est validée : elle est visible par les créatrices\.$/, "Tu oferta de colaboración fue validada: las creadoras ya la ven.", "Your collaboration offer is approved: creators can now see it.", "collabs"],
  [/^Votre offre de collaboration n’a pas été validée\. Le motif est dans Mon compte › Collaborations : modifiez-la pour la renvoyer\.$/, "Tu oferta de colaboración no fue validada. El motivo está en Mi cuenta › Colaboraciones: modifícala para reenviarla.", "Your collaboration offer wasn’t approved. The reason is in My account › Collaborations: edit it to resend.", "collabs"],
  [/^Une créatrice vous propose une collaboration\. Retrouvez-la dans Mon compte › Collaborations\.$/, "Una creadora te propone una colaboración. La encontrarás en Mi cuenta › Colaboraciones.", "A creator is proposing a collaboration. Find it in My account › Collaborations.", "collabs"],
  [/^Une marque est intéressée par votre proposition de collaboration : son contact est dans Opportunités\.$/, "A una marca le interesa tu propuesta de colaboración: su contacto está en Oportunidades.", "A brand is interested in your collaboration proposal: their contact is in Opportunities.", "opportunities"],
  [/^Une marque a répondu à votre proposition de collaboration\.$/, "Una marca respondió a tu propuesta de colaboración.", "A brand replied to your collaboration proposal.", "opportunities"],
  [/^Votre Reel n’a pas pu être validé\. Le motif est indiqué dans Mon compte › Réductions\.$/, "Tu Reel no pudo validarse. El motivo está en Mi cuenta › Descuentos.", "Your Reel couldn’t be approved. The reason is in My account › Discounts.", "referral"],
  [/^Votre Reel avec @withjulielouvet est validé : la réduction sera déduite de votre prochaine facture\.$/, "Tu Reel con @withjulielouvet fue validado: el descuento se aplicará en tu próxima factura.", "Your Reel with @withjulielouvet is approved: the discount will come off your next invoice.", "referral"],
  [/^Votre sélection de marques à contacter est ouverte : retrouvez-la dans Opportunités\.$/, "Tu selección de marcas para contactar ya está abierta: encuéntrala en Oportunidades.", "Your list of brands to contact is open: find it in Opportunities.", "opportunities"],
  // Notifications internes de l'agence (affichées en français, mais avec l'écran à ouvrir).
  [/^Nouvelle offre de collaboration à valider : (.+)$/, null, null, "todo"],
];

/** Traductions et écran cible d'une notification. Inconnue : le texte d'origine dans les trois langues. */
export function noticeI18n(message) {
  const fr = String(message ?? "");
  for (const [re, es, en, target] of RULES) {
    const m = re.exec(fr);
    if (!m) continue;
    const fill = (tpl, lang) =>
      tpl == null
        ? fr
        : tpl.replace(/\$M1/g, () => monthFromFr(m[1] || "", lang)).replace(/\$(\d)/g, (_, i) => m[Number(i)] ?? "");
    const frOut = /\$M1/.test(String(es)) ? fr.replace(m[1], monthFromFr(m[1] || "", "fr")) : fr;
    return { i18n: { fr: frOut, es: fill(es, "es"), en: fill(en, "en") }, target };
  }
  return { i18n: { fr, es: fr, en: fr }, target: null };
}
