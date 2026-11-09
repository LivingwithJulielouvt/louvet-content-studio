// Client discovery is source material for agency strategy, never an approved brand rule.
export const intakeQuestions = [
  {
    key: "story",
    fr: [
      "Comment présenteriez-vous votre marque ?",
      "Son nom, son activité, son histoire et ce qui vous a donné envie de la créer.",
    ],
    es: ["¿Cómo presentarías tu marca?", "Su nombre, actividad, historia y qué te motivó a crearla."],
    en: ["How would you introduce your brand?", "Its name, activity, story and what inspired you to create it."],
  },
  {
    key: "offer",
    fr: [
      "Que vendez-vous, et que souhaitez-vous mettre en avant ?",
      "Vos produits ou services, votre gamme de prix et vos offres prioritaires.",
    ],
    es: [
      "¿Qué vendes y qué te gustaría destacar?",
      "Tus productos o servicios, rango de precios y ofertas prioritarias.",
    ],
    en: [
      "What do you sell, and what would you like to highlight?",
      "Your products or services, price range and priority offers.",
    ],
  },
  {
    key: "audience",
    fr: [
      "Qui sont vos clients aujourd’hui, et qui aimeriez-vous attirer ?",
      "Leurs besoins, leurs habitudes, leur localisation et ce qui compte pour eux.",
    ],
    es: [
      "¿Quiénes son tus clientes hoy y a quiénes te gustaría atraer?",
      "Sus necesidades, hábitos, ubicación y lo que más valoran.",
    ],
    en: [
      "Who are your customers today, and who would you like to attract?",
      "Their needs, habits, location and what matters to them.",
    ],
  },
  {
    key: "difference",
    fr: [
      "Pourquoi vous choisir plutôt qu’une autre marque ?",
      "Votre différence concrète, les compliments reçus et les faits qui la prouvent.",
    ],
    es: [
      "¿Por qué elegir tu marca en lugar de otra?",
      "Tu diferencia concreta, lo que valoran tus clientes y los hechos que la respaldan.",
    ],
    en: [
      "Why choose your brand over another?",
      "Your concrete difference, customer feedback and the facts supporting it.",
    ],
  },
  {
    key: "objectives",
    fr: [
      "Qu’aimeriez-vous obtenir grâce à votre communication ?",
      "Votre priorité pour les trois prochains mois : notoriété, demandes, réservations, ventes…",
    ],
    es: [
      "¿Qué te gustaría conseguir con tu comunicación?",
      "Tu prioridad para los próximos tres meses: reconocimiento, consultas, reservas, ventas…",
    ],
    en: [
      "What would you like your communication to achieve?",
      "Your priority for the next three months: awareness, enquiries, bookings, sales…",
    ],
  },
  {
    key: "personality",
    fr: [
      "Si votre marque était une personne, comment parlerait-elle ?",
      "Trois mots pour la décrire, ses valeurs et le ton qui vous ressemble.",
    ],
    es: [
      "Si tu marca fuera una persona, ¿cómo hablaría?",
      "Tres palabras para describirla, sus valores y el tono que te representa.",
    ],
    en: [
      "If your brand were a person, how would it speak?",
      "Three words to describe it, its values and a tone that feels right.",
    ],
  },
  {
    key: "inspirations",
    fr: [
      "Quelles marques ou quels contenus vous inspirent ?",
      "Deux ou trois exemples ou liens, et ce que vous aimez : lumière, style, message, rythme…",
    ],
    es: [
      "¿Qué marcas o contenidos te inspiran?",
      "Dos o tres ejemplos o enlaces y qué te gusta: luz, estilo, mensaje, ritmo…",
    ],
    en: [
      "Which brands or content inspire you?",
      "Two or three examples or links, and what you like: lighting, style, message, pace…",
    ],
  },
  {
    key: "boundaries",
    fr: [
      "Que faut-il absolument respecter ou éviter ?",
      "Caractéristiques produit, sujets, mots ou visuels interdits, autorisations à vérifier.",
    ],
    es: [
      "¿Qué debemos respetar o evitar siempre?",
      "Características del producto, temas, palabras o imágenes prohibidas y permisos por verificar.",
    ],
    en: [
      "What must we always respect or avoid?",
      "Product characteristics, prohibited topics, words or images and permissions to check.",
    ],
  },
  {
    key: "channels",
    fr: [
      "Où communiquez-vous et comment vos clients vous contactent-ils ?",
      "Réseaux, site, liens utiles, langues et parcours de commande ou de réservation.",
    ],
    es: [
      "¿Dónde comunicas y cómo te contactan tus clientes?",
      "Redes, sitio web, enlaces útiles, idiomas y proceso de compra o reserva.",
    ],
    en: [
      "Where do you communicate, and how do customers contact you?",
      "Social accounts, website, useful links, languages and how to buy or book.",
    ],
  },
  {
    key: "priorities",
    fr: [
      "Que devons-nous savoir pour préparer les prochains mois ?",
      "Lancements, dates importantes, difficultés actuelles et ce que vous pouvez photographier ou filmer.",
    ],
    es: [
      "¿Qué debemos saber para preparar los próximos meses?",
      "Lanzamientos, fechas importantes, retos actuales y lo que puedes fotografiar o grabar.",
    ],
    en: [
      "What should we know to prepare the coming months?",
      "Launches, key dates, current challenges and what you can photograph or film.",
    ],
  },
];
export function normalizeIntake(input, complete = false) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Réponses invalides.");
  const answers = {};
  for (const { key } of intakeQuestions) {
    if (input[key] != null && typeof input[key] !== "string") throw new Error("Les réponses doivent être du texte.");
    const value = (input[key] || "").trim();
    if (value.length > 2000) throw new Error("Chaque réponse est limitée à 2 000 caractères.");
    if (complete && value.length < 3)
      throw new Error(
        "Répondez aux dix questions avant de transmettre. Vous pouvez écrire « À définir » si vous avez besoin de l’aide de l’agence.",
      );
    if (value) answers[key] = value;
  }
  return answers;
}

export const creatorIntakeQuestions = [
  {
    key: "story",
    fr: [
      "Qui êtes-vous et qu’avez-vous envie de raconter ?",
      "Votre parcours, ce qui vous anime et la place que vous souhaitez prendre comme créatrice.",
    ],
    es: [
      "¿Quién eres y qué te gustaría contar?",
      "Tu trayectoria, lo que te mueve y el lugar que quieres ocupar como creadora.",
    ],
    en: [
      "Who are you, and what would you like to share?",
      "Your background, motivations and the space you want to occupy as a creator.",
    ],
  },
  {
    key: "offer",
    fr: [
      "De quels sujets aimez-vous parler ?",
      "Vos expertises, passions et expériences ; les thèmes que vous ne souhaitez pas traiter.",
    ],
    es: [
      "¿Sobre qué temas te gusta hablar?",
      "Tus conocimientos, pasiones y experiencias; temas que prefieres no tratar.",
    ],
    en: [
      "Which subjects do you enjoy talking about?",
      "Your skills, passions and experiences; topics you prefer not to cover.",
    ],
  },
  {
    key: "audience",
    fr: [
      "À qui voulez-vous vous adresser ?",
      "Les personnes que vous voulez toucher, leurs besoins, leurs langues et leur localisation.",
    ],
    es: ["¿A quién quieres dirigirte?", "Las personas que quieres alcanzar, sus necesidades, idiomas y ubicación."],
    en: ["Who would you like to reach?", "Your intended audience, their needs, languages and location."],
  },
  {
    key: "difference",
    fr: [
      "Qu’est-ce qui rend votre point de vue singulier ?",
      "Votre expérience vécue, votre regard et les retours réellement reçus de votre communauté.",
    ],
    es: [
      "¿Qué hace particular tu punto de vista?",
      "Tus experiencias reales, tu mirada y los comentarios recibidos de tu comunidad.",
    ],
    en: [
      "What makes your perspective distinctive?",
      "Your lived experience, perspective and real feedback from your community.",
    ],
  },
  {
    key: "objectives",
    fr: [
      "Qu’attendez-vous de vos contenus dans les trois prochains mois ?",
      "Créer une communauté, gagner en visibilité, développer une activité ou préparer des collaborations.",
    ],
    es: [
      "¿Qué esperas de tus contenidos en los próximos tres meses?",
      "Crear comunidad, ganar visibilidad, desarrollar un negocio o preparar colaboraciones.",
    ],
    en: [
      "What do you want your content to achieve in the next three months?",
      "Build community, increase visibility, grow a business or prepare for collaborations.",
    ],
  },
  {
    key: "personality",
    fr: [
      "Comment souhaitez-vous vous exprimer ?",
      "Votre personnalité, vos valeurs et le ton qui vous ressemble à l’écrit et face caméra.",
    ],
    es: [
      "¿Cómo quieres expresarte?",
      "Tu personalidad, valores y el tono que te representa por escrito y frente a cámara.",
    ],
    en: [
      "How would you like to express yourself?",
      "Your personality, values and natural voice in writing and on camera.",
    ],
  },
  {
    key: "inspirations",
    fr: [
      "Quelles créatrices ou quels contenus vous inspirent ?",
      "Des exemples ou liens, et ce que vous aimez : narration, style, cadrage, rythme…",
    ],
    es: [
      "¿Qué creadoras o contenidos te inspiran?",
      "Ejemplos o enlaces y qué te gusta: narrativa, estilo, encuadre, ritmo…",
    ],
    en: [
      "Which creators or content inspire you?",
      "Examples or links, and what you like: storytelling, style, framing, pace…",
    ],
  },
  {
    key: "boundaries",
    fr: [
      "Quelles limites souhaitez-vous poser ?",
      "Vie privée, entourage, sujets sensibles, image de votre corps ou catégories de marques à éviter.",
    ],
    es: [
      "¿Qué límites quieres establecer?",
      "Privacidad, familiares, temas sensibles, imagen corporal o categorías de marcas que quieres evitar.",
    ],
    en: [
      "Which boundaries would you like to set?",
      "Privacy, family, sensitive subjects, body image or brand categories to avoid.",
    ],
  },
  {
    key: "channels",
    fr: [
      "Sur quelles plateformes êtes-vous présente ?",
      "Comptes, liens, langues, formats préférés et ce que vous aimez déjà publier.",
    ],
    es: [
      "¿En qué plataformas estás presente?",
      "Cuentas, enlaces, idiomas, formatos preferidos y lo que ya disfrutas publicar.",
    ],
    en: [
      "Which platforms do you use?",
      "Accounts, links, languages, preferred formats and what you already enjoy posting.",
    ],
  },
  {
    key: "priorities",
    fr: [
      "Que pouvez-vous créer concrètement chaque mois ?",
      "Temps disponible, lieux, matériel, aisance face caméra, rythme souhaité et dates importantes.",
    ],
    es: [
      "¿Qué puedes crear realmente cada mes?",
      "Tiempo, lugares, equipo, comodidad frente a cámara, ritmo deseado y fechas importantes.",
    ],
    en: [
      "What can you realistically create each month?",
      "Time, locations, equipment, confidence on camera, desired pace and important dates.",
    ],
  },
];
export const questionsForWorkspace = (config) =>
  config?.workspaceType === "creator" ? creatorIntakeQuestions : intakeQuestions;
