export const qualitySections = [
  {
    title: "1. Cible et objectif",
    questions: [
      [
        "audience",
        "À qui s’adresse cette marque, précisément ?",
        "Profil, besoin concret, niveau de connaissance du produit.",
        true,
      ],
      [
        "market",
        "Sur quel marché et dans quelle zone communique-t-elle ?",
        "Ville, pays, langue et particularités culturelles.",
        false,
      ],
      [
        "objective",
        "Quel résultat les contenus doivent-ils servir ?",
        "Faire découvrir, expliquer, susciter une demande, vendre… Choisir la priorité.",
        true,
      ],
      [
        "priorityProducts",
        "Quels produits ou offres mettre en avant en priorité ?",
        "Indiquer les références déjà enregistrées dans le studio.",
        false,
      ],
      [
        "action",
        "Quelle action attend-on après avoir vu le contenu ?",
        "Une action claire : écrire, réserver, consulter une fiche…",
        true,
      ],
    ],
  },
  {
    title: "2. Positionnement et preuves",
    questions: [
      [
        "positioning",
        "Comment résumer le positionnement de la marque ?",
        "Exemple : une boulangerie artisanale de quartier, contemporaine et accessible.",
        true,
      ],
      [
        "difference",
        "Qu’est-ce qui la distingue concrètement ?",
        "Des caractéristiques vérifiables, sans superlatif non justifié.",
        false,
      ],
      [
        "proofs",
        "Quelles preuves et affirmations sont validées ?",
        "Faits approuvés avec leur source ou référence. Laisser vide si rien n’est vérifié.",
        false,
      ],
      [
        "objections",
        "Quels freins ou questions reviennent chez les clients ?",
        "Prix, utilisation, entretien, commande, disponibilité…",
        false,
      ],
      [
        "commercial",
        "Quelles informations commerciales peut-on utiliser ?",
        "Lien officiel, parcours de commande et conditions confirmées. Prix et promotions : fiche produit.",
        false,
      ],
    ],
  },
  {
    title: "3. Direction visuelle",
    questions: [
      [
        "visualWorld",
        "Quel univers visuel doit-on retrouver ?",
        "Matières, couleurs, décors et degré de mise en scène.",
        true,
      ],
      [
        "light",
        "Quelle lumière et quelle composition privilégier ?",
        "Naturelle ou studio, plan serré ou large, produit seul ou en situation.",
        false,
      ],
      [
        "references",
        "Qu’aimez-vous dans les références visuelles ajoutées ?",
        "Nommer la référence puis ce qu’il faut en retenir : lumière, cadrage, ambiance…",
        false,
      ],
      [
        "avoidVisual",
        "Quelles représentations faut-il absolument éviter ?",
        "Objets, décors, gestes ou mises en scène inadaptés.",
        true,
      ],
      [
        "people",
        "Peut-on montrer des personnes, mains ou lieux réels ?",
        "Indiquer ce qui est autorisé ; ne pas supposer une autorisation de droit à l’image.",
        false,
      ],
    ],
  },
  {
    title: "4. Écriture et calendrier",
    questions: [
      [
        "voice",
        "Comment la marque doit-elle parler ?",
        "Tutoiement/vouvoiement, humour, niveau de langage et exemple de phrase juste.",
        false,
      ],
      [
        "messages",
        "Quels messages veut-on répéter dans la durée ?",
        "Deux ou trois idées de fond cohérentes avec les faits du produit.",
        false,
      ],
      [
        "expressions",
        "Quels mots et expressions sont souhaités ou interdits ?",
        "Séparer clairement les mots à utiliser et ceux à éviter.",
        false,
      ],
      [
        "occasions",
        "Quelles occasions sont pertinentes ou à exclure ?",
        "Événements locaux, fêtes, temps forts propres à la marque.",
        false,
      ],
      [
        "captionExample",
        "Quelle légende représente bien la marque ?",
        "Un exemple approuvé et ce qui fonctionne dans sa formulation.",
        false,
      ],
    ],
  },
  {
    title: "5. Vidéos et critères de validation",
    questions: [
      [
        "videoSubjects",
        "Que peut-on réellement filmer chaque mois ?",
        "Produits, fabrication, équipe, démonstrations et lieux disponibles.",
        false,
      ],
      [
        "videoHook",
        "Quelle accroche et quelle énergie conviennent aux vidéos ?",
        "Une ouverture concrète, le rythme et l’émotion recherchée.",
        false,
      ],
      [
        "videoAudio",
        "Quelle direction sonore autorise-t-on ?",
        "Voix, son naturel, musique fournie et autorisée. Ne pas inventer de droit musical.",
        false,
      ],
      [
        "successCriteria",
        "Quels critères doivent être respectés pour valider un contenu ?",
        "Exemple : produit fidèle, message lisible, preuve exacte, appel à l’action clair.",
        true,
      ],
      [
        "internalNotes",
        "Notes internes à l’agence · jamais envoyées au moteur",
        "Points de vigilance internes. Éviter toute donnée sensible inutile.",
        false,
      ],
    ],
  },
];
export const qualityQuestions = qualitySections.flatMap((s) => s.questions);
export function normalizeQuality(input = {}) {
  const result = {};
  for (const [key] of qualityQuestions) {
    const value = String(input[key] ?? "").trim();
    if (value.length > 2000) throw new Error("Chaque réponse est limitée à 2 000 caractères.");
    if (value) result[key] = value;
  }
  return result;
}
export function qualityContext(profile = {}) {
  return qualityQuestions
    .filter(([key]) => key !== "internalNotes" && profile[key])
    .map(([key, label]) => `${label} ${profile[key]}`)
    .join("\n");
}
