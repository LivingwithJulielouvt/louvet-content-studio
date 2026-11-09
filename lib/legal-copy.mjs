// Pages légales du studio (conditions, confidentialité, mentions légales) en français, espagnol et anglais.
// ⚠️ BROUILLON : ces textes doivent être relus et validés par un professionnel du droit avant le lancement.
// ➜ Pour modifier un texte, changez simplement les phrases entre guillemets. Les éléments entre crochets
//    [COMME CECI] sont à compléter : ne jamais les remplacer par des informations inventées.
// Format d'une page : { title, intro, sections: [[titre, [paragraphe, paragraphe…]], …] }.

export const LEGAL_UPDATED = "2026-10-31";
export const LEGAL_SLUGS = ["conditions", "confidentialite", "mentions-legales"];

export const LEGAL_UI = {
  fr: {
    draft: "Brouillon à faire valider par un professionnel du droit",
    draftNote: "Ce texte est une version de travail. Les éléments entre crochets restent à compléter.",
    updated: "Dernière mise à jour",
    back: "Retour au site",
    links: { conditions: "Conditions d’utilisation", confidentialite: "Confidentialité", "mentions-legales": "Mentions légales" },
    consent: "En envoyant ce formulaire, vous acceptez nos",
    and: "et notre",
    privacyPolicy: "politique de confidentialité",
    studio: "Conditions · Confidentialité · Mentions légales",
  },
  es: {
    draft: "Borrador pendiente de validación por un profesional del derecho",
    draftNote: "Este texto es una versión de trabajo. Los elementos entre corchetes quedan por completar.",
    updated: "Última actualización",
    back: "Volver al sitio",
    links: { conditions: "Condiciones de uso", confidentialite: "Privacidad", "mentions-legales": "Aviso legal" },
    consent: "Al enviar este formulario, aceptas nuestras",
    and: "y nuestra",
    privacyPolicy: "política de privacidad",
    studio: "Condiciones · Privacidad · Aviso legal",
  },
  en: {
    draft: "Draft — to be reviewed by a legal professional",
    draftNote: "This text is a working version. Items in square brackets still need to be completed.",
    updated: "Last updated",
    back: "Back to the website",
    links: { conditions: "Terms of use", confidentialite: "Privacy", "mentions-legales": "Legal notice" },
    consent: "By sending this form, you accept our",
    and: "and our",
    privacyPolicy: "privacy policy",
    studio: "Terms · Privacy · Legal notice",
  },
};

const PROCESSORS = {
  fr: [
    "Supabase (base de données, stockage privé des fichiers, connexion par code e-mail) — région d’hébergement : [À CONFIRMER].",
    "Vercel (hébergement du site et du studio).",
    "Stripe (paiement de l’abonnement, factures, portail client). Les données de carte sont saisies chez Stripe : le studio ne les voit ni ne les conserve.",
    "Brevo (envoi des e-mails : codes de connexion, accusés de réception, rappels).",
    "OpenAI (création des images, des textes, des voix off et transcription des vidéos à partir des éléments que vous fournissez).",
    "Calendly (prise de rendez-vous, uniquement si vous cliquez sur le bouton de réservation).",
    "Meta (publication sur Instagram / Facebook, uniquement si vous connectez votre compte).",
  ],
  es: [
    "Supabase (base de datos, almacenamiento privado de archivos, acceso con código por correo) — región de alojamiento: [POR CONFIRMAR].",
    "Vercel (alojamiento del sitio y del estudio).",
    "Stripe (pago de la suscripción, facturas, portal del cliente). Los datos de la tarjeta se ingresan en Stripe: el estudio no los ve ni los conserva.",
    "Brevo (envío de correos: códigos de acceso, acuses de recibo, recordatorios).",
    "OpenAI (creación de imágenes, textos, voces en off y transcripción de videos a partir de los elementos que proporcionas).",
    "Calendly (agenda de citas, solo si haces clic en el botón de reserva).",
    "Meta (publicación en Instagram / Facebook, solo si conectas tu cuenta).",
  ],
  en: [
    "Supabase (database, private file storage, email-code sign-in) — hosting region: [TO BE CONFIRMED].",
    "Vercel (hosting of the website and the studio).",
    "Stripe (subscription payments, invoices, customer portal). Card details are entered on Stripe: the studio never sees or stores them.",
    "Brevo (sending emails: sign-in codes, confirmations, reminders).",
    "OpenAI (creating images, texts, voiceovers and transcribing videos from the material you provide).",
    "Calendly (booking calls, only if you click the booking button).",
    "Meta (posting to Instagram / Facebook, only if you connect your account).",
  ],
};

export const LEGAL_PAGES = {
  conditions: {
    fr: {
      title: "Conditions d’utilisation et de vente",
      intro:
        "Ces conditions encadrent l’utilisation de Louvet Content Studio (le « studio »), proposé par [RAISON SOCIALE] (« Louvet & Partners », « l’agence »), et l’abonnement mensuel qui y donne accès.",
      sections: [
        ["1. Le service", [
          "Le studio est un espace en ligne privé qui aide les marques et les créateurs à préparer leurs contenus : photos mises en scène, vidéos, textes de publication, calendrier, modèles visuels et échanges avec l’équipe de l’agence.",
          "L’accès est ouvert après création du compte, réponse au questionnaire de marque et préparation de l’espace par l’agence.",
        ]],
        ["2. Compte et accès", [
          "La connexion se fait par un code envoyé à votre adresse e-mail. Vous êtes responsable de l’usage de votre compte et des personnes que vous autorisez.",
          "L’agence peut suspendre un espace en cas d’impayé, d’usage contraire aux présentes conditions ou de risque pour la sécurité du service.",
        ]],
        ["3. Abonnement et prix", [
          "L’abonnement est mensuel. Prix en vigueur : 89 € par mois. Le tarif applicable est celui du pays de facturation choisi ; il est affiché dans « Mon compte » → « Abonnement » avant tout paiement. [MENTION TTC / HT ET TAXES APPLICABLES À PRÉCISER].",
          "Le paiement est prélevé chaque mois par Stripe sur le moyen de paiement enregistré. Chaque paiement donne lieu à une facture, disponible dans « Mon abonnement » → « Gérer mon abonnement » et envoyée par e-mail.",
          "En cas d’échec de paiement, un délai de régularisation peut être accordé ; à son terme, la création de nouveaux contenus est suspendue. Vos contenus existants restent consultables.",
        ]],
        ["4. Sans engagement, résiliation", [
          "L’abonnement est sans engagement : vous pouvez le résilier à tout moment depuis « Mon abonnement » → « Gérer mon abonnement ».",
          "La résiliation prend effet à la fin de la période déjà payée ; aucun nouveau prélèvement n’a lieu ensuite.",
          "Abonnement annuel (si proposé) : 890 € par an, soit 2 mois offerts, payé en une fois pour 12 mois. Les 30 visuels en plus se renouvellent chaque mois. Il est résiliable à tout moment, avec effet à l’échéance annuelle : l’accès reste ouvert jusqu’à la fin de l’année payée. [À VALIDER : absence de remboursement au prorata.]",
        ]],
        ["5. Remboursements", [
          "[POLITIQUE DE REMBOURSEMENT À DÉFINIR — par exemple : aucun remboursement au prorata d’une période commencée, sauf erreur de facturation.]",
          "[À VALIDER : application ou exclusion du droit de rétractation pour les clients consommateurs.]",
        ]],
        ["6. Intelligence artificielle", [
          "Une partie des contenus est créée avec des outils d’intelligence artificielle (notamment OpenAI) à partir de vos photos, de vos réponses et de vos consignes.",
          "Ces contenus peuvent comporter des erreurs ou des ressemblances involontaires. Relisez et vérifiez chaque contenu avant de le publier : vous restez responsable de ce que vous publiez.",
          "Le studio n’invente pas d’avis clients, de prix ou de promesses : n’utilisez pas les contenus pour présenter des informations fausses ou trompeuses.",
        ]],
        ["7. Vos contenus", [
          "Vous restez propriétaire des photos, vidéos, textes et logos que vous déposez. Vous garantissez disposer des droits nécessaires (personnes photographiées, musiques, marques de tiers).",
          "Vous accordez à l’agence une licence limitée, non exclusive et gratuite, pour héberger, traiter et transformer ces éléments uniquement afin de vous fournir le service, pendant la durée de votre abonnement.",
          "Les contenus créés pour vous dans le studio vous sont destinés et vous pouvez les utiliser librement pour votre activité, sous réserve des droits de tiers et des conditions des fournisseurs d’IA. L’agence ne les utilise pas pour sa propre promotion sans votre accord.",
        ]],
        ["8. Disponibilité et responsabilité", [
          "L’agence met en œuvre des moyens raisonnables pour assurer la disponibilité et la sécurité du studio, sans garantie d’absence d’interruption.",
          "[LIMITATION DE RESPONSABILITÉ À RÉDIGER ET VALIDER.]",
        ]],
        ["9. Données personnelles", [
          "Le traitement de vos données est décrit dans la page Confidentialité.",
        ]],
        ["10. Modifications", [
          "Ces conditions peuvent évoluer. En cas de changement important (notamment de prix), vous êtes prévenu à l’avance par e-mail ou dans le studio.",
        ]],
        ["11. Droit applicable et litiges", [
          "[DROIT APPLICABLE À PRÉCISER — par exemple droit français pour les clients en France, droit mexicain pour les clients au Mexique.]",
          "[TRIBUNAUX COMPÉTENTS ET MÉDIATION DE LA CONSOMMATION À PRÉCISER.]",
        ]],
        ["12. Réductions : parrainage et Reels avec Julie", [
          "Reels avec @withjulielouvet : chaque Reel publié sur Instagram en collaboration avec le compte @withjulielouvet (invitation de collaborateur acceptée), puis déclaré dans « Mon compte » → « Réductions », donne droit, après vérification par l’agence, à une remise de 2 € (France), 40 MXN (Mexique) ou 2 USD (États-Unis) sur la prochaine facture.",
          "Parrainage : pour chaque marque ou créatrice parrainée (code ou lien de parrainage utilisé lors de son inscription) qui paie son premier mois, le parrain reçoit une remise de 10 € (France), 200 MXN (Mexique) ou 10 USD (États-Unis), déduite de sa prochaine facture, dans la devise de son abonnement. Un espace ne peut pas se parrainer lui-même.",
          "La remise est limitée à 10 Reels validés par espace et par mois. Un même Reel ne peut être déclaré qu’une fois. Le Reel doit rester public, avec la collaboration acceptée ; l’agence peut refuser un Reel qui ne respecte pas ces conditions ou annuler une remise en cas d’abus.",
          "Les remises (Reels et parrainage) sont déduites des factures de l’abonnement au studio. Elles n’ont aucune valeur monétaire, ne sont ni remboursables ni échangeables, et sont perdues à la résiliation si elles n’ont pas pu être appliquées. [CONDITIONS À VALIDER.]",
        ]],
        ["13. Contact", ["[RAISON SOCIALE] · [ADRESSE] · [E-MAIL DE CONTACT]"]],
      ],
    },
    es: {
      title: "Condiciones de uso y de venta",
      intro:
        "Estas condiciones regulan el uso de Louvet Content Studio (el « estudio »), ofrecido por [RAZÓN SOCIAL] (« Louvet & Partners », « la agencia »), y la suscripción mensual que da acceso a él.",
      sections: [
        ["1. El servicio", [
          "El estudio es un espacio privado en línea que ayuda a marcas y creadores a preparar sus contenidos: fotos ambientadas, videos, textos de publicación, calendario, plantillas visuales y conversación con el equipo de la agencia.",
          "El acceso se abre tras crear la cuenta, responder el cuestionario de marca y la preparación del espacio por parte de la agencia.",
        ]],
        ["2. Cuenta y acceso", [
          "El acceso se hace con un código enviado a tu correo. Eres responsable del uso de tu cuenta y de las personas que autorizas.",
          "La agencia puede suspender un espacio por falta de pago, uso contrario a estas condiciones o riesgo para la seguridad del servicio.",
        ]],
        ["3. Suscripción y precio", [
          "La suscripción es mensual. Precio vigente: 1 800 MXN al mes. La tarifa aplicable es la del país de facturación elegido; se muestra en «Mi cuenta» → «Suscripción» antes de cualquier pago. [PRECISAR SI INCLUYE IVA E IMPUESTOS APLICABLES].",
          "Stripe cobra el pago cada mes en el medio de pago registrado. Cada pago genera una factura, disponible en « Mi suscripción » → « Gestionar mi suscripción » y enviada por correo.",
          "Si un pago falla, puede otorgarse un plazo para regularizarlo; al terminar, se suspende la creación de nuevos contenidos. Tus contenidos existentes siguen disponibles.",
        ]],
        ["4. Sin permanencia, cancelación", [
          "La suscripción no tiene permanencia: puedes cancelarla en cualquier momento desde « Mi suscripción » → « Gestionar mi suscripción ».",
          "La cancelación surte efecto al final del periodo ya pagado; después no se realiza ningún cobro nuevo.",
          "Suscripción anual (si se ofrece): 18 000 MXN al año, es decir 2 meses gratis, pagada de una vez por 12 meses. Las 30 imágenes extra se renuevan cada mes. Puede cancelarse en cualquier momento, con efecto al vencimiento anual: el acceso sigue abierto hasta el final del año pagado. [POR VALIDAR: sin reembolso proporcional.]",
        ]],
        ["5. Reembolsos", [
          "[POLÍTICA DE REEMBOLSO POR DEFINIR — por ejemplo: sin reembolso proporcional de un periodo iniciado, salvo error de facturación.]",
          "[POR VALIDAR: derechos aplicables a clientes consumidores.]",
        ]],
        ["6. Inteligencia artificial", [
          "Parte de los contenidos se crea con herramientas de inteligencia artificial (en particular OpenAI) a partir de tus fotos, tus respuestas y tus indicaciones.",
          "Estos contenidos pueden contener errores o parecidos involuntarios. Revisa cada contenido antes de publicarlo: sigues siendo responsable de lo que publicas.",
          "El estudio no inventa opiniones de clientes, precios ni promesas: no uses los contenidos para presentar información falsa o engañosa.",
        ]],
        ["7. Tus contenidos", [
          "Sigues siendo propietario de las fotos, videos, textos y logotipos que subes. Garantizas contar con los derechos necesarios (personas fotografiadas, música, marcas de terceros).",
          "Otorgas a la agencia una licencia limitada, no exclusiva y gratuita para alojar, procesar y transformar estos elementos únicamente para prestarte el servicio, durante tu suscripción.",
          "Los contenidos creados para ti en el estudio son tuyos para usarlos libremente en tu actividad, sujeto a derechos de terceros y a las condiciones de los proveedores de IA. La agencia no los usa para su propia promoción sin tu permiso.",
        ]],
        ["8. Disponibilidad y responsabilidad", [
          "La agencia aplica medios razonables para asegurar la disponibilidad y la seguridad del estudio, sin garantizar la ausencia de interrupciones.",
          "[LIMITACIÓN DE RESPONSABILIDAD POR REDACTAR Y VALIDAR.]",
        ]],
        ["9. Datos personales", ["El tratamiento de tus datos se describe en la página de Privacidad."]],
        ["10. Cambios", [
          "Estas condiciones pueden cambiar. Ante un cambio importante (en particular de precio), se te avisará con antelación por correo o en el estudio.",
        ]],
        ["11. Ley aplicable y controversias", [
          "[LEY APLICABLE POR PRECISAR — por ejemplo ley mexicana para clientes en México, ley francesa para clientes en Francia.]",
          "[TRIBUNALES COMPETENTES Y PROCEDIMIENTO ANTE PROFECO POR PRECISAR.]",
        ]],
        ["12. Descuentos: recomendaciones y Reels con Julie", [
          "Reels con @withjulielouvet: cada Reel publicado en Instagram en colaboración con la cuenta @withjulielouvet (invitación de colaborador aceptada) y declarado en «Mi cuenta» → «Descuentos» da derecho, tras la verificación de la agencia, a un descuento de 40 MXN (México), 2 € (Francia) o 2 USD (Estados Unidos) en la próxima factura.",
          "Recomendaciones: por cada marca o creadora recomendada (código o enlace de recomendación usado al registrarse) que paga su primer mes, quien recomienda recibe un descuento de 200 MXN (México), 10 € (Francia) o 10 USD (Estados Unidos), aplicado en su próxima factura, en la moneda de su suscripción. Un espacio no puede recomendarse a sí mismo.",
          "El descuento se limita a 10 Reels validados por espacio y por mes. Un mismo Reel solo puede declararse una vez. El Reel debe seguir público, con la colaboración aceptada; la agencia puede rechazar un Reel que no cumpla estas condiciones o anular un descuento en caso de abuso.",
          "Los descuentos (Reels y recomendaciones) se aplican a las facturas de la suscripción al estudio. No tienen valor monetario, no son reembolsables ni canjeables y se pierden al cancelar si no pudieron aplicarse. [CONDICIONES POR VALIDAR.]",
        ]],
        ["13. Contacto", ["[RAZÓN SOCIAL] · [DOMICILIO] · [RFC] · [CORREO DE CONTACTO]"]],
      ],
    },
    en: {
      title: "Terms of use and sale",
      intro:
        "These terms govern the use of Louvet Content Studio (the “studio”), provided by [COMPANY NAME] (“Louvet & Partners”, “the agency”), and the monthly subscription that gives access to it.",
      sections: [
        ["1. The service", [
          "The studio is a private online space that helps brands and creators prepare their content: styled photos, videos, captions, a posting calendar, visual templates and messages with the agency team.",
          "Access opens once you have created your account, answered the brand questionnaire and the agency has set up your space.",
        ]],
        ["2. Account and access", [
          "You sign in with a code sent to your email address. You are responsible for the use of your account and for the people you authorize.",
          "The agency may suspend a space for non-payment, use that breaches these terms, or a risk to the security of the service.",
        ]],
        ["3. Subscription and price", [
          "The subscription is monthly. Current price: USD 120 per month. The applicable price is the one for the billing country you chose; it is shown in “My account” → “Subscription” before any payment. [SPECIFY WHETHER TAXES ARE INCLUDED AND WHICH APPLY].",
          "Stripe charges the payment each month to the saved payment method. Each payment generates an invoice, available in “My subscription” → “Manage my plan” and sent by email.",
          "If a payment fails, a grace period may apply; after it ends, creating new content is paused. Your existing content stays available.",
        ]],
        ["4. No commitment, cancellation", [
          "There is no minimum term: you can cancel at any time from “My subscription” → “Manage my plan”.",
          "Cancellation takes effect at the end of the period already paid; no further charges are made after that.",
          "Yearly plan (when offered): USD 1,200 a year, i.e. 2 months free, paid once for 12 months. The 30 extra visuals renew every month. You can cancel at any time, effective at the yearly renewal: access stays open until the end of the paid year. [TO CONFIRM: no pro-rata refunds.]",
        ]],
        ["5. Refunds", [
          "[REFUND POLICY TO BE DEFINED — for example: no pro-rata refund for a started period, except billing errors.]",
          "[TO BE CONFIRMED: rights that apply to consumer customers.]",
        ]],
        ["6. Artificial intelligence", [
          "Part of the content is created with artificial intelligence tools (including OpenAI) from your photos, your answers and your instructions.",
          "This content may contain mistakes or unintended resemblances. Review every piece before posting it: you remain responsible for what you publish.",
          "The studio does not invent customer reviews, prices or claims: don’t use the content to present false or misleading information.",
        ]],
        ["7. Your content", [
          "You keep ownership of the photos, videos, texts and logos you upload. You confirm that you hold the necessary rights (people pictured, music, third-party brands).",
          "You grant the agency a limited, non-exclusive, royalty-free licence to host, process and transform this material solely to provide the service, for the duration of your subscription.",
          "Content created for you in the studio is yours to use freely for your business, subject to third-party rights and the AI providers’ terms. The agency does not use it for its own promotion without your consent.",
        ]],
        ["8. Availability and liability", [
          "The agency takes reasonable measures to keep the studio available and secure, without guaranteeing uninterrupted service.",
          "[LIMITATION OF LIABILITY TO BE DRAFTED AND REVIEWED.]",
        ]],
        ["9. Personal data", ["How your data is handled is described on the Privacy page."]],
        ["10. Changes", [
          "These terms may change. For any significant change (including price), you will be notified in advance by email or in the studio.",
        ]],
        ["11. Governing law and disputes", [
          "[GOVERNING LAW TO BE SPECIFIED — for example, the law of the customer’s state for US customers.]",
          "[COMPETENT COURTS / ARBITRATION TO BE SPECIFIED.]",
        ]],
        ["12. Discounts: referrals and Reels with Julie", [
          "Reels with @withjulielouvet: each Reel posted on Instagram in collaboration with the @withjulielouvet account (collaborator invite accepted) and submitted in “My account” → “Discounts” earns, once checked by the agency, a discount of 2 USD (United States), 2 € (France) or 40 MXN (Mexico) on the next invoice.",
          "Referrals: for each brand or creator you refer (referral code or link used when they sign up) who pays their first month, you receive a discount of 10 USD (United States), 10 € (France) or 200 MXN (Mexico) on your next invoice, in your subscription’s currency. A space cannot refer itself.",
          "The discount is capped at 10 approved Reels per space per month. The same Reel can only be submitted once. The Reel must stay public, with the collaboration accepted; the agency may refuse a Reel that doesn’t meet these conditions or cancel a discount in case of abuse.",
          "Discounts (Reels and referrals) are applied to studio subscription invoices. They have no cash value, are neither refundable nor exchangeable, and are lost on cancellation if they could not be applied. [TERMS TO BE VALIDATED.]",
        ]],
        ["13. Contact", ["[COMPANY NAME] · [ADDRESS] · [CONTACT EMAIL]"]],
      ],
    },
  },
  confidentialite: {
    fr: {
      title: "Politique de confidentialité",
      intro:
        "Cette page explique quelles données le studio utilise, pourquoi, avec qui elles sont partagées et comment exercer vos droits. Responsable du traitement : [RAISON SOCIALE], [ADRESSE], [E-MAIL DE CONTACT].",
      sections: [
        ["Données utilisées", [
          "Compte : adresse e-mail, prénom, nom de la marque, langue, pays.",
          "Contenu de votre espace : réponses au questionnaire de marque, photos, vidéos, logos, textes, contenus créés, calendrier, messages échangés avec l’agence.",
          "Abonnement : identifiants Stripe (client, abonnement), statut et dates de paiement. Aucune donnée de carte bancaire n’est conservée par le studio.",
          "Technique : journaux de sécurité et d’activité (connexions, actions importantes) nécessaires au bon fonctionnement et à la sécurité.",
        ]],
        ["Pourquoi", [
          "Fournir le studio et l’accompagnement de l’agence (exécution du contrat).",
          "Facturer l’abonnement et respecter nos obligations comptables (obligation légale).",
          "Sécuriser le service et prévenir les abus (intérêt légitime).",
          "Vous envoyer des e-mails de service ; les e-mails facultatifs (rappels hebdomadaires) seulement si vous les acceptez, avec désinscription possible à tout moment.",
        ]],
        ["Intelligence artificielle", [
          "Pour créer vos contenus, les éléments nécessaires (photos, consignes, textes) sont transmis à OpenAI. [À VÉRIFIER ET PRÉCISER : conditions d’utilisation des données par le fournisseur, notamment l’absence d’entraînement des modèles sur les données envoyées par API.]",
        ]],
        ["Sous-traitants", PROCESSORS.fr],
        ["Transferts hors de l’Union européenne", [
          "Certains prestataires sont situés aux États-Unis. [MÉCANISMES DE TRANSFERT À PRÉCISER : Data Privacy Framework, clauses contractuelles types…]",
        ]],
        ["Durées de conservation", [
          "Données de l’espace : pendant l’abonnement, puis effacement à la suppression de l’espace (y compris les fichiers et les messages). [DÉLAI APRÈS RÉSILIATION À DÉFINIR].",
          "Factures et données comptables : durée imposée par la loi [À CONFIRMER, par exemple 10 ans en France].",
          "Journaux techniques : [DURÉE À DÉFINIR].",
        ]],
        ["Vos droits", [
          "Vous pouvez demander l’accès, la rectification, l’effacement, la portabilité de vos données, la limitation ou l’opposition à un traitement, en écrivant à [E-MAIL DE CONTACT].",
          "En France, vous pouvez introduire une réclamation auprès de la CNIL (cnil.fr). Au Mexique, vous disposez des droits ARCO. [AUTORITÉS ET PROCÉDURES À VÉRIFIER].",
        ]],
        ["Collaborations et contacts de marques", [
          "Collaborations entre clients : une marque cliente peut choisir, par une case à cocher désactivée par défaut, d’apparaître auprès des créatrices du studio avec son offre (nom, univers, offre, lien public). La date de cet accord est enregistrée ; il peut être retiré à tout moment et la marque disparaît alors aussitôt de la liste. Son adresse e-mail n’est transmise à une créatrice que si la marque accepte sa proposition.",
          "Les propositions de collaboration (message, compte Instagram de la créatrice) sont visibles de la marque concernée et de l’agence, qui peut masquer un message déplacé. Elles sont effacées à la suppression de l’un des deux espaces.",
          "Carnet d’opportunités des créatrices : l’agence y recense des contacts professionnels publiés par les marques elles-mêmes (site, bio Instagram), sans adresse personnelle. Toute marque peut demander à en être retirée en écrivant à [E-MAIL DE CONTACT]. [BASE LÉGALE ET INFORMATION DES MARQUES CONCERNÉES À VALIDER.]",
        ]],
        ["Recréer un post et importer votre site", [
          "« Recréer ce post » : les captures d’écran que vous ajoutez sont rangées dans votre espace privé et lues par un service d’IA (OpenAI) pour décrire la mise en page, sans en reprendre le texte ni les images. Le lien Instagram n’est jamais ouvert par le studio. Les captures sont supprimées avec la recette, et au plus tard parmi les 30 dernières recettes gardées.",
          "« Importer mon site » : à votre demande, le studio lit les pages publiques du site indiqué (accueil et 3 pages au plus) pour vous proposer vos produits, couleurs, ton et réseaux ; le texte public peut être résumé par un service d’IA. Rien n’est appliqué sans votre accord, et seules les 10 dernières lectures sont gardées.",
        ]],
        ["Cookies et traceurs", [
          "Le studio n’utilise ni cookie publicitaire ni traceur tiers. Si la mesure d’audience est activée, elle se fait sans cookie ni donnée personnelle (nombre de pages vues, anonyme et agrégé, via Vercel Web Analytics). Les polices de caractères sont hébergées avec le site.",
          "Seuls des éléments indispensables sont déposés : les cookies de session de connexion, un cookie mémorisant la langue choisie et un stockage local (dans votre navigateur) pour ne pas réafficher le guide déjà vu. C’est pourquoi aucun bandeau de consentement n’est affiché.",
        ]],
        ["Sécurité", [
          "Fichiers stockés dans un espace privé, accessibles uniquement par des liens temporaires signés ; chaque espace client est cloisonné ; connexion sans mot de passe par code à usage unique.",
        ]],
      ],
    },
    es: {
      title: "Aviso de privacidad",
      intro:
        "Esta página explica qué datos usa el estudio, para qué, con quién se comparten y cómo ejercer tus derechos. Responsable: [RAZÓN SOCIAL], [DOMICILIO], [CORREO DE CONTACTO].",
      sections: [
        ["Datos que usamos", [
          "Cuenta: correo electrónico, nombre, nombre de la marca, idioma, país.",
          "Contenido de tu espacio: respuestas al cuestionario de marca, fotos, videos, logotipos, textos, contenidos creados, calendario, mensajes con la agencia.",
          "Suscripción: identificadores de Stripe (cliente, suscripción), estado y fechas de pago. El estudio no conserva ningún dato de tarjeta.",
          "Técnicos: registros de seguridad y actividad (accesos, acciones importantes) necesarios para el funcionamiento y la seguridad.",
        ]],
        ["Para qué", [
          "Prestar el estudio y el acompañamiento de la agencia (relación contractual).",
          "Facturar la suscripción y cumplir con obligaciones contables y fiscales.",
          "Proteger el servicio y prevenir abusos.",
          "Enviarte correos del servicio; los correos opcionales (recordatorios semanales) solo si los aceptas, con baja posible en cualquier momento.",
        ]],
        ["Inteligencia artificial", [
          "Para crear tus contenidos, los elementos necesarios (fotos, indicaciones, textos) se envían a OpenAI. [POR VERIFICAR Y PRECISAR: condiciones de uso de datos del proveedor, en particular que no entrena sus modelos con los datos enviados por API.]",
        ]],
        ["Encargados y terceros", PROCESSORS.es],
        ["Transferencias", [
          "Algunos proveedores están en Estados Unidos. [MECANISMOS DE TRANSFERENCIA POR PRECISAR.]",
        ]],
        ["Conservación", [
          "Datos del espacio: durante la suscripción y se borran al eliminar el espacio (incluidos archivos y mensajes). [PLAZO TRAS LA CANCELACIÓN POR DEFINIR].",
          "Facturas y datos contables: el plazo que exige la ley [POR CONFIRMAR].",
          "Registros técnicos: [PLAZO POR DEFINIR].",
        ]],
        ["Tus derechos (ARCO)", [
          "Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición, así como revocar tu consentimiento, escribiendo a [CORREO DE CONTACTO]. [PROCEDIMIENTO Y AUTORIDAD COMPETENTE POR VERIFICAR].",
        ]],
        ["Colaboraciones y contactos de marcas", [
          "Colaboraciones entre clientes: una marca cliente puede elegir, con una casilla desactivada por defecto, aparecer ante las creadoras del estudio con su oferta (nombre, sector, oferta, enlace público). Se registra la fecha de ese consentimiento; puede retirarse en cualquier momento y la marca desaparece de inmediato de la lista. Su correo solo se comparte con una creadora si la marca acepta su propuesta.",
          "Las propuestas de colaboración (mensaje, cuenta de Instagram de la creadora) son visibles para la marca destinataria y para la agencia, que puede ocultar un mensaje inapropiado. Se borran al eliminar cualquiera de los dos espacios.",
          "Directorio de oportunidades de las creadoras: la agencia reúne contactos profesionales publicados por las propias marcas (sitio, bio de Instagram), sin direcciones personales. Cualquier marca puede pedir que se le retire escribiendo a [CORREO DE CONTACTO]. [BASE LEGAL E INFORMACIÓN A LAS MARCAS POR VALIDAR.]",
        ]],
        ["Recrear un post e importar tu sitio", [
          "«Recrear este post»: las capturas que agregas se guardan en tu espacio privado y las lee un servicio de IA (OpenAI) para describir el diseño, sin reutilizar su texto ni sus imágenes. El estudio nunca abre el enlace de Instagram. Las capturas se borran con la receta y, a más tardar, solo se conservan las 30 últimas recetas.",
          "«Importar mi sitio»: a petición tuya, el estudio lee las páginas públicas del sitio indicado (inicio y 3 páginas como máximo) para proponerte tus productos, colores, tono y redes; el texto público puede resumirse con un servicio de IA. Nada se aplica sin tu acuerdo y solo se conservan las 10 últimas lecturas.",
        ]],
        ["Cookies y rastreadores", [
          "El estudio no usa cookies publicitarias ni rastreadores de terceros. Si la medición de audiencia está activada, se hace sin cookies ni datos personales (número de páginas vistas, anónimo y agregado, con Vercel Web Analytics). Las tipografías se alojan con el sitio.",
          "Solo se guardan elementos indispensables: las cookies de sesión, una cookie con el idioma elegido y un almacenamiento local (en tu navegador) para no volver a mostrar la guía ya vista. Por eso no se muestra ningún aviso de consentimiento.",
        ]],
        ["Seguridad", [
          "Archivos guardados en un espacio privado, accesibles solo con enlaces temporales firmados; cada espacio de cliente está aislado; acceso sin contraseña con código de un solo uso.",
        ]],
      ],
    },
    en: {
      title: "Privacy policy",
      intro:
        "This page explains what data the studio uses, why, who it is shared with and how to exercise your rights. Data controller: [COMPANY NAME], [ADDRESS], [CONTACT EMAIL].",
      sections: [
        ["Data we use", [
          "Account: email address, first name, brand name, language, country.",
          "Your space’s content: brand questionnaire answers, photos, videos, logos, texts, created content, calendar, messages with the agency.",
          "Subscription: Stripe identifiers (customer, subscription), payment status and dates. The studio never stores card details.",
          "Technical: security and activity logs (sign-ins, key actions) needed to run and secure the service.",
        ]],
        ["Why", [
          "To provide the studio and the agency’s support (performance of the contract).",
          "To bill the subscription and meet accounting and tax obligations.",
          "To secure the service and prevent abuse.",
          "To send service emails; optional emails (weekly reminders) only if you opt in, with unsubscribe available at any time.",
        ]],
        ["Artificial intelligence", [
          "To create your content, the necessary material (photos, instructions, texts) is sent to OpenAI. [TO BE VERIFIED AND DETAILED: the provider’s data-use terms, including that API data is not used to train its models.]",
        ]],
        ["Service providers", PROCESSORS.en],
        ["International transfers", ["Some providers are located in the United States. [TRANSFER SAFEGUARDS TO BE SPECIFIED.]"]],
        ["Retention", [
          "Space data: for the duration of the subscription, then erased when the space is deleted (including files and messages). [PERIOD AFTER CANCELLATION TO BE DEFINED].",
          "Invoices and accounting data: as long as the law requires [TO BE CONFIRMED].",
          "Technical logs: [PERIOD TO BE DEFINED].",
        ]],
        ["Your rights", [
          "You can request access, correction, deletion or a copy of your data, or object to its use, by writing to [CONTACT EMAIL]. [STATE-SPECIFIC RIGHTS (e.g. California) TO BE REVIEWED].",
        ]],
        ["Collaborations and brand contacts", [
          "Collaborations between clients: a client brand can choose, with a checkbox that is off by default, to appear to studio creators with its offer (name, field, offer, public link). The date of this consent is recorded; it can be withdrawn at any time and the brand then disappears from the list immediately. Its email address is only shared with a creator if the brand accepts her proposal.",
          "Collaboration proposals (message, the creator’s Instagram account) are visible to the brand concerned and to the agency, which can hide an inappropriate message. They are deleted when either space is deleted.",
          "Creators’ opportunities directory: the agency lists professional contacts published by the brands themselves (website, Instagram bio), never personal addresses. Any brand can ask to be removed by writing to [CONTACT EMAIL]. [LEGAL BASIS AND NOTICE TO THE BRANDS CONCERNED TO BE VALIDATED.]",
        ]],
        ["Recreating a post and importing your website", [
          "“Recreate this post”: the screenshots you add are stored in your private space and read by an AI service (OpenAI) to describe the layout, without reusing their text or images. The studio never opens the Instagram link. Screenshots are deleted with the recipe, and only the latest 30 recipes are kept.",
          "“Import my website”: at your request, the studio reads the public pages of the site you give (home page and at most 3 pages) to suggest your products, colors, tone and socials; the public text may be summarized by an AI service. Nothing is applied without your OK, and only the latest 10 reads are kept.",
        ]],
        ["Cookies and trackers", [
          "The studio uses no advertising cookies and no third-party trackers. If audience measurement is turned on, it works without cookies or personal data (anonymous, aggregated page views via Vercel Web Analytics). Fonts are hosted with the website.",
          "Only essential items are stored: sign-in session cookies, a cookie remembering your language, and local storage (in your browser) so the guide you’ve already seen isn’t shown again. That’s why no consent banner is displayed.",
        ]],
        ["Security", [
          "Files are kept in private storage, reachable only through temporary signed links; each client space is isolated; passwordless sign-in with a one-time code.",
        ]],
      ],
    },
  },
  "mentions-legales": {
    fr: {
      title: "Mentions légales",
      intro: "Informations sur l’éditeur et l’hébergeur du site et du studio Louvet Content Studio.",
      sections: [
        ["Éditeur", [
          "[RAISON SOCIALE] — [FORME JURIDIQUE] [au capital de … € / micro-entreprise]",
          "Siège : [ADRESSE]",
          "SIRET : [SIRET] · RCS / RNE : [IMMATRICULATION] · TVA intracommunautaire : [N° TVA OU « TVA non applicable, art. 293 B du CGI »]",
          "Responsable de la publication : [NOM]",
          "Contact : [E-MAIL DE CONTACT]",
        ]],
        ["Entité au Mexique (si applicable)", ["[RAZÓN SOCIAL] · RFC : [RFC] · Domicilio fiscal : [DOMICILIO]"]],
        ["Hébergement", [
          "Site et application : Vercel Inc. — [ADRESSE DE L’HÉBERGEUR, À VÉRIFIER SUR vercel.com].",
          "Base de données et fichiers : Supabase — [SOCIÉTÉ, ADRESSE ET RÉGION D’HÉBERGEMENT À VÉRIFIER].",
        ]],
        ["Propriété intellectuelle", [
          "La marque Louvet & Partners, le site et le studio (textes, interface, modèles) sont protégés. Les contenus déposés par les clients restent leur propriété.",
        ]],
      ],
    },
    es: {
      title: "Aviso legal",
      intro: "Información sobre el editor y el alojamiento del sitio y del estudio Louvet Content Studio.",
      sections: [
        ["Editor", [
          "[RAZÓN SOCIAL] — [FORMA JURÍDICA]",
          "Domicilio: [DOMICILIO]",
          "RFC: [RFC] (México) · SIRET: [SIRET] (Francia)",
          "Responsable de la publicación: [NOMBRE]",
          "Contacto: [CORREO DE CONTACTO]",
        ]],
        ["Alojamiento", [
          "Sitio y aplicación: Vercel Inc. — [DOMICILIO DEL PROVEEDOR, POR VERIFICAR EN vercel.com].",
          "Base de datos y archivos: Supabase — [EMPRESA, DOMICILIO Y REGIÓN POR VERIFICAR].",
        ]],
        ["Propiedad intelectual", [
          "La marca Louvet & Partners, el sitio y el estudio (textos, interfaz, plantillas) están protegidos. Los contenidos que suben los clientes siguen siendo de su propiedad.",
        ]],
      ],
    },
    en: {
      title: "Legal notice",
      intro: "Information about the publisher and host of the Louvet Content Studio website and studio.",
      sections: [
        ["Publisher", [
          "[COMPANY NAME] — [LEGAL FORM]",
          "Registered address: [ADDRESS]",
          "Registration: [SIRET] (France) · [RFC] (Mexico) · [US ENTITY / EIN IF APPLICABLE]",
          "Publication director: [NAME]",
          "Contact: [CONTACT EMAIL]",
        ]],
        ["Hosting", [
          "Website and app: Vercel Inc. — [HOST ADDRESS, TO BE CHECKED ON vercel.com].",
          "Database and files: Supabase — [COMPANY, ADDRESS AND REGION TO BE CHECKED].",
        ]],
        ["Intellectual property", [
          "The Louvet & Partners brand, the website and the studio (texts, interface, templates) are protected. Content uploaded by clients remains their property.",
        ]],
      ],
    },
  },
};
