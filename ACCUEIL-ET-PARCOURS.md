# Nouvel accueil, formulaire court, premiers pas guidés et texte sur l'image — 23 octobre 2026

## Accueil (`app/public-site.tsx`, textes dans `lib/home-copy.mjs`, styles dans `app/home.css`)

- **Titre concret** : « Six contenus prêts à publier, chaque mois. Préparés par une agence, pas par une machine. »
- **La livraison du 3** à droite du titre : la grille des 6 visuels du mois.
- **Ce que vous recevez chaque mois** : 6 contenus, 30 idées vidéo, calendrier, studio de création, montage, équipe joignable.
- **Derrière chaque contenu, il y a une personne** : la méthode en 4 étapes (étude, planification, production et sélection, publication). L'IA y est présentée comme un outil d'atelier.
- **Comparaison** : community manager (plus de 800 € / 8 000 MXN / 1 000 USD par mois) · seul sur ChatGPT ou Canva · le studio.
- **Créés avec le studio** : 6 visuels réels (DUPAIN, Savon de Toulon, Studio MJH, Louvet & Partners).
- **Notre histoire** : le texte de Julie, les références (Cannes Lions, Garnier, Renault, AXA, Savon de Toulon, Studio MJH, DUPAIN) et un lien vers louvetpartners.com.
- **Tarif** (un seul prix selon la langue), **FAQ** mise à jour (« Est-ce que c'est de l'IA ? » remplace la question ChatGPT), dernier appel à l'action.
- **Un seul bouton principal** « Commencer » ; « Se connecter » devient un lien discret.
- **Couleurs Louvet & Partners** : rouge #B8291A, or #B08D3E, noir #1A1A1A, fond crème #F6F1E9, titres en serif.
- **Langue** : le site s'ouvre directement dans la langue du navigateur, avec un bandeau « Ce site est aussi disponible en… ». La fenêtre bloquante a été retirée.

### Changer les photos

Déposer des JPG (format portrait 4:5 conseillé, environ 880 × 1100 px) dans `public/realisations/` et mettre à jour la liste `work` en bas de `lib/home-copy.mjs` (nom du fichier, marque, secteur). Un fichier manquant affiche un emplacement neutre, sans casser la page.

## Formulaire court (`/souscrire`)

- Prénom, e-mail, marque, pays, type (marque ou créatrice), Instagram ou site, un mot (facultatif), code de parrainage, consentement. Plus aucune des 10 questions.
- Le questionnaire complet est demandé **dans le studio**, à la première connexion après validation (écran déjà existant).
- Dans « Demandes en attente », l'agence voit l'Instagram, le message, la langue et le pays.

## Premiers pas guidés (studio client, `app/client-guide.tsx`)

Une carte « Vos premiers pas » en haut de l'accueil du studio, cochée automatiquement :
1. Parler de sa marque (fait dès l'accès)
2. Ajouter un produit et ses photos
3. Créer son premier visuel
4. Découvrir les 30 idées de vidéos
5. Ouvrir son calendrier

Chaque étape a son bouton, la date de la prochaine livraison est rappelée, et le client peut masquer la carte. Les points de fidélité n'apparaissent qu'après la première publication confirmée (plus de « 0 point » au premier jour).

## Texte sur l'image

Dans « Créer des photos », la case « Écrire un texte sur l'image » permet d'indiquer un texte court (90 caractères maximum) et un style (élégant, moderne, manuscrit). Le texte est transmis tel quel au générateur d'images ; sans texte, la règle « aucun texte ni logo » reste en vigueur. Conseil : relire l'orthographe des visuels avant livraison, les modèles d'image peuvent encore faire des erreurs sur les textes longs.

Vérifié : `npm run build` OK, tous les fichiers de tests verts (`npm run test:source`) (dont le nouveau `tests/overlay.mjs`), pages contrôlées dans un navigateur en FR, EN et ES, sur ordinateur et sur mobile.

## Voix off et sous-titres

Au moment de créer la vidéo finale (onglet « Mes vidéos » › « Créer la vidéo finale »), deux nouveaux blocs apparaissent :

- **Voix off** : le texte est pré-rempli avec la narration de l'idée vidéo et reste modifiable (600 caractères maximum, environ 15 mots pour 5 secondes). Le client choisit une voix (chaleureuse, posée ou énergique), écoute le résultat, peut la régénérer et décide de l'utiliser ou non. La voix parle dans la langue du montage (français, espagnol du Mexique ou anglais américain). Le son des rushes et la musique sont automatiquement baissés sous la voix.
- **Sous-titres automatiques** : plus besoin de fichier. Les sous-titres reprennent le texte de la voix off et sont calés sur sa durée ; sans voix, le client écrit le texte à afficher et il est réparti sur toute la vidéo. Le fichier .srt reste possible (« J'ai déjà un fichier de sous-titres »).

Réglages :
- `TTS_MODEL` (par défaut `gpt-4o-mini-tts`) dans Vercel ; la voix utilise la même clé OpenAI et les mêmes verrous que les images (`AI_GENERATION_ENABLED`, facturation API, abonnement du client).
- Coût : 1 crédit par voix créée, modifiable par client avec `voiceCost` dans sa configuration. Gratuit quand l'agence crée la voix pour le client. En cas d'échec, le crédit est rendu automatiquement.

Limites :
- La voix est générée par IA : certaines plateformes demandent de le signaler dans la publication (l'interface le rappelle au client).
- Vérifiez la prononciation des noms de marque et des mots étrangers avant de publier.
- Le calage des sous-titres est proportionnel à la longueur du texte : il est bon pour une voix off régulière, approximatif si la personne parle elle-même dans les rushes.

## Montage vidéo (marques)

**Ce que vit le client (marque)** — dans « Mes vidéos », le bouton « Créer la vidéo finale » ouvre le montage guidé, en 3 écrans :

1. **« Votre vidéo est prête. »** Le studio a déjà tout fait : coupe des silences (les plans muets, type B-roll, ne sont jamais coupés), sous-titres mot à mot, hook des 3 premières secondes, style de la marque, musique atténuée quand la personne parle. Un aperçu en direct montre exactement ce que donnera la vidéo finale. La liste « Le studio a fait pour vous » affiche les vrais chiffres (silences coupés, durée avant / après).
2. **« Petites retouches »** (facultatif) : changer le hook (3 propositions + « Proposer 3 autres hooks »), changer le look (Mon style · Doux · Percutant), corriger un mot ou le colorer (jaune, rose, manuscrit), choisir ou couper la musique. Trois boutons d’intention : Plus dynamique (zooms, coupes rapides), Plus calme (fondus, musique plus douce), Plus court (30 s puis 15 s).
3. **« Télécharger ma vidéo »** : le rendu se fait sur l’appareil du client (aucun coût serveur), la vidéo est enregistrée dans « Mes vidéos » et téléchargée. Bouton « Demander à l’agence de vérifier ».

Les vidéos dont tous les plans sont filmés ouvrent ce parcours automatiquement. Les créatrices de contenu ont l’éditeur complet (voir ci-dessous). L’agence garde l’accès à l’ancien écran via « Montage avancé (agence) ».

**Côté agence**
- *Styles de montage* → bloc « Montage automatique · style de la marque » : police, animation des sous-titres, position, taille, couleurs, contour, majuscules, coupe des silences, carton de fin. C’est le look « Mon style » du client.
- Même écran → « Musiques du client » : ajoutez des MP3/M4A (15 Mo max, libres de droits pour un usage commercial). Le client choisit parmi elles.
- *À traiter* → « Vidéos à relire » : les demandes de vérification des clients, avec « Voir la vidéo », un commentaire facultatif et « Marquer comme relue » (le client reçoit une notification).

**Réglages techniques**
- `TRANSCRIBE_MODEL` (Vercel, facultatif, défaut `whisper-1`) : calage mot à mot des sous-titres. Nécessite `OPENAI_API_KEY` et `AI_GENERATION_ENABLED=true`. Sans IA, les sous-titres sont tirés du texte de la vidéo et répartis sur la durée (l’écran l’indique : « vérifiez le calage »).
- `transcribeCost` (réglage client, défaut 0) : crédits consommés par calage. Remboursés automatiquement en cas d’échec.
- Limites : analyse des 3 premières minutes de rushes, piste audio de 3 Mo max, vidéo finale de 60 s max (ou 30 / 15 s), 120 Mo de rushes au total sur l’appareil.
- Polices embarquées (licence SIL OFL, dans `public/media-engine/fonts/`) : Inter, Montserrat, DM Serif Display, Caveat, Anton, Courier Prime.

## Éditeur complet (créatrices)

**Ce que vit la créatrice** — dans « Mes vidéos », « Créer la vidéo finale » (ou « Créer une nouvelle version ») ouvre l’éditeur plein écran : aperçu en direct à gauche (lecture, barre de temps, blocs de sous-titres et stickers sur la frise), outils à droite en 5 onglets. Le studio prépare d’abord tout seul la vidéo (comme pour les marques), puis chaque modification est **enregistrée automatiquement** (environ 1 seconde après le dernier changement). Bouton « Annuler » pour revenir en arrière.

- **Barre du haut** : Appliquer « Mon style », Enregistrer comme mon style (seulement si l’agence l’autorise), Importer une vidéo (ajoutée au montage, 6 vidéos max, 50 Mo chacune), Exporter la vidéo.
- **Sous-titres** : 8 animations, 6 polices, couleur du mot prononcé, contour noir, majuscules, position Haut / Milieu / Bas + réglage fin de la hauteur, taille (70 à 150 %), décalage global (±1 s). Texte calé sur la voix : toucher un mot = 1 fois jaune, 2 fois rose, 3 fois manuscrit, 4 fois normal ; « Corriger le mot » change le texte sans toucher au calage. **« Caler au tap »** : la vidéo se lance, on appuie sur la barre d’espace (ou le bouton « Tap ») au début de chaque bloc ; les blocs trop longs sont resserrés automatiquement.
- **Emojis et stickers** : 16 emojis (posés à l’instant de lecture, 2 s), stickers personnels en PNG détouré (3 Mo max, privés à l’espace), réglage De / à, position (grille 3×3), taille, bruitage à l’apparition. Gros titre posé sur l’image (40 caractères, De / à, Haut / Milieu / Bas, bruitage).
- **Hook et fin** : texte du hook, « Proposer 3 hooks », police du hook, et mots du hook en manuscrit ou en gras (polices mélangées). Texte de fin et logo.
- **Rythme** : couper les silences (nombre détecté et secondes gagnées affichés), zooms, coupes rapides, durée cible 15 / 30 / 60 s ou libre.
- **Son** : musiques de l’agence ou ajoutées par la créatrice (libres de droits), volume, musique qui baisse quand on parle, bruitages synthétisés (clic, pop, swoosh, appareil photo) avec volume, voix off IA (chaleureuse / posée / énergique — les sous-titres se recalent dessus).
- **Assistant** : Plus percutant · Plus calme · Plus court.
- Rendu sur l’appareil comme pour les marques : les emojis sont dessinés en PNG puis posés par FFmpeg, les titres passent par les sous-titres ASS (polices embarquées), les bruitages sont générés par FFmpeg (aucun fichier tiers).

**Côté agence** — *Styles de montage* (aussi pour les créatrices désormais) :
- « Ouvrir l’éditeur visuel du style » : le même éditeur, en mode agence, sur la dernière vidéo du client (ou une image d’exemple si aucune vidéo n’est encore montée). « Enregistrer comme style du client » enregistre seulement le look (jamais le hook, les stickers, les titres ou les mots d’une vidéo).
- Créatrice : case « La créatrice peut modifier son style » (désactivée par défaut) → elle voit « Enregistrer comme mon style ».
- Marque : case « Réglages avancés pour la marque » (désactivée par défaut) → un lien discret « Réglages avancés » apparaît sur l’écran « Votre vidéo est prête » et ouvre l’éditeur complet. Sinon, la marque garde le parcours simple.

Limites connues : l’aperçu reproduit fidèlement couleurs, polices, positions et timing, mais la taille exacte des textes peut légèrement différer du fichier final (le rendu final fait foi). Les stickers PNG de plus de 4000 px sont refusés. 12 stickers et 6 titres maximum par vidéo, 24 bruitages maximum.

## Versions à tester (créatrices)

**Ce que vit la créatrice** — « Mes vidéos » › onglet « Versions à tester » (visible seulement dans un espace créatrice). En 3 étapes : choisir une vidéo de « Mes vidéos », choisir **3, 5 ou 10 versions**, cocher ce qui change d’une version à l’autre :
- **l’accroche** des 3 premières secondes (écrite par l’IA si elle est activée, sinon une banque d’accroches en FR / ES / EN adaptée au titre de la vidéo ou à son premier pilier) ;
- **le style des sous-titres** (jaunes, étiquette, élégants, karaoké rose, machine à écrire) ;
- **la musique** (ses musiques ou « voix seule », si au moins une musique existe dans l’espace) ;
- **la durée** (complète ou courte, environ 70 %) ;
- **le premier plan** (début normal, ou 1,4 s d’un moment fort / de la fin placé en ouverture) ;
- **le titre de couverture** (en gras ou élégant, la première seconde).

Un aperçu liste les versions A, B, C… avec leur description (« Accroche « … » · sous-titres jaunes · version courte »). La version A garde les réglages de base ; les autres combinent les réglages pour être toutes différentes (calcul identique côté navigateur et serveur). Le rendu se fait **sur l’appareil, une version à la fois** (« Version 2 sur 5… », bouton Arrêter ; les versions déjà prêtes sont gardées). Comptez environ une minute par version sur ordinateur (la vidéo n’est analysée qu’une fois).

Ensuite : chaque version a son aperçu, « Télécharger », « Ajouter à mon calendrier » et « Tout télécharger ». Après publication en **Reels d’essai** Instagram, la créatrice note les vues (obligatoires) et, si elle veut, j’aime / enregistrements / partages. Score = vues + j’aime + 2 × partages + 3 × enregistrements (la meilleure = 100). Dès deux versions notées, le studio indique la gagnante (en cas d’égalité, celle qui a le plus de vues) ; « Garder la gagnante » la marque, propose de l’ajouter au calendrier et de « Créer 5 nouvelles versions à partir de la gagnante » (la gagnante devient la version A, l’accroche gagnante reste, un seul autre réglage change à chaque version).

Limites : 5 séries par jour et 60 séries enregistrées par espace ; les statistiques se saisissent à la main (« Bientôt : récupération automatique des statistiques quand Instagram sera connecté. ») ; une voix off IA n’est pas reprise dans les versions (le son des rushes est gardé). Une série dont une version est prévue au calendrier ne peut pas être supprimée.

## Rendez-vous avec Julie (aide)

Un bouton « Réserver un rendez-vous avec Julie » (ES « Reservar una cita con Julie », EN « Book a call with Julie ») est visible pour tous les clients, marques et créatrices :
- dans la barre de gauche, au-dessus de « Espace privé » (« Besoin d’aide ? ») ;
- en bas de la carte « Vos premiers pas » ;
- sur l’écran final du montage, à côté de « Demander à l’agence de vérifier ».

Fonctionnement :
- Par défaut, il ouvre dans un nouvel onglet le Calendly de Julie : `https://calendly.com/julie-louvetpartners/studio-louvet`, prérempli avec l’e-mail et le nom du client. Ces deux informations ne sont ajoutées que pour un lien calendly.com ; aucune autre donnée personnelle n’est mise dans l’adresse.
- Variable Vercel `BOOKING_URL` : vide ou absente = le Calendly ci-dessus ; un autre lien (par exemple une page de réservation Google Agenda) = ce lien ; `none` = pas de lien externe.
- Avec `BOOKING_URL=none`, le bouton ouvre un petit formulaire dans le studio : sujet (Créer mes photos / Mes vidéos / Mon calendrier / Mon abonnement / Autre), jusqu’à 3 créneaux, message facultatif, fuseau horaire détecté automatiquement. La demande apparaît pour l’agence dans *À traiter* → « Demandes de rendez-vous », avec « Marquer comme planifié » (le client reçoit une notification). Limites : 3 demandes en attente par client, 5 demandes par jour et par compte.

## Lieux (décors de référence)

Julie fournit les photos d’un lieu réel du client (salle de restaurant, terrasse, comptoir, boutique, vitrine, bureau, chambre…). Le client n’a ensuite qu’à choisir le mot-clé : ses visuels sont créés dans ce décor.

Ajouter un lieu (agence) :
- Choisir l’espace du client → onglet *Produits* (ou *Sujets & références* pour une créatrice) → bloc « Lieux » en bas → « Ajouter un lieu ».
- Ajouter 1 à 5 photos (JPG ou PNG), saisir le mot-clé en français (40 caractères max.), et si besoin sa traduction anglaise et espagnole (sinon le mot-clé français est affiché), puis une courte description pour l’IA (facultatif, ex. « tables en bois clair, plantes vertes »).
- Cocher « Proposé au client » (possible seulement avec au moins une photo) puis « Enregistrer ». Les flèches changent l’ordre d’affichage. 12 lieux maximum par client. Un lieu décoché reste enregistré mais n’est plus proposé.

Conseils photo :
- Une photo large qui montre l’ensemble du lieu, plus 1 ou 2 photos de détail (une table, le comptoir, un mur caractéristique).
- Lumière naturelle, de jour, lieu rangé.
- Pas de personnes ni de visages.
- Éviter les textes visibles non souhaités (affiches, écrans, menus) : l’IA pourrait les recopier de travers.

Côté client (marques et créatrices) :
- Dans *Créer des photos*, une étape « Où ? / ¿Dónde? / Where? » apparaît avec une vignette par lieu actif et « Sans lieu précis » (choix par défaut). Elle est masquée si le client n’a aucun lieu.
- Le lieu choisi est mémorisé avec la création : les variantes et corrections gardent le même décor. Les livraisons mensuelles automatiques répartissent les lieux actifs entre les visuels.

Fonctionnement et limites :
- À la génération, jusqu’à 3 photos du lieu sont envoyées à l’IA avec la consigne de recréer la scène dans ce lieu (architecture, mobilier, matières, lumière), sans inventer d’enseigne, de texte ni de personnes. Le respect du produit ou du visage reste prioritaire.
- L’IA recrée le lieu, ce n’est pas un photomontage : le résultat est très proche mais pas identique au pixel près (un détail peut bouger, un objet manquer).
- Les photos de lieux sont privées, visibles seulement par l’agence et le client concerné, et supprimées avec le lieu.
- Mise en ligne : la table `places` est créée par `supabase/02-nouvelles-fonctions.sql` ; il faut ré-exécuter ce fichier dans Supabase (il peut être relancé sans risque).

## Modèles (créations sans IA)

Nouvel onglet **Modèles** dans l’espace client (et raccourci sur l’accueil, à côté de « Créer des photos » et « Filmer une vidéo ») ; aussi dans le menu de l’agence. Tout est composé **dans le navigateur** : le texte est écrit exactement comme il est tapé (aucune faute d’IA) et les photos du client ne sont **jamais retouchées** (seulement placées, recadrées ou montrées entières). Aucun crédit utilisé.

- **Sans photo** (texte sur fond uni) : Citation, Annonce, Astuce, 3 conseils, Question, Chiffre clé (le chiffre vient toujours du client), Carrousel texte (2 à 6 slides, une slide par paragraphe, exportées en plusieurs PNG).
- **Avec les photos du client** (services : photographe, ménage, coiffure…) : Avant / Après (côte à côte, haut / bas ou diagonale, + vidéo de 7 s avec dévoilement), Galerie / Portfolio (photo entière, passe-partout, crédit photo), Collage (2 à 4 photos), Coulisses (note manuscrite), Étapes du service, Offre / Promo (prix et conditions saisis par le client), Avis client (case obligatoire « Ceci est un vrai avis d’un client, publié avec son accord », vérifiée aussi par le serveur ; aucun avis pré-rempli).
- **Montages photo tendance** (31 octobre 2026, `lib/trendy-draw.mjs`) : 15 mises en page originales, affichées **en premier pour les créatrices** (à la fin pour les marques) : Pellicule, Polaroids, Carnet de bord (papier déchiré, ruban, petits dessins), Couverture magazine, Photo dump, Mood board (pastilles des couleurs tirées des photos), Cadre minimal, Duo en diagonale, Appareil photo rétro (date orange, grain), Ma journée (heures), Tenue du jour (étiquettes et traits), Fiche recette, Billet de voyage, Citation sur photo (fond flouté), Carrousel panoramique. Formats : **Story 1080×1920**, **Publication 1080×1350**, et **carrousel** (2 ou 3 slides qui se raccordent, une photo pouvant passer d’une slide à l’autre ; un PNG par slide, numérotés). Les textes ont des valeurs par défaut dans la langue du client : rien n’est obligatoire à taper. La cliente touche un emplacement puis une photo (Mes photos, photos produit, Mes visuels ou nouvel envoi), touche la photo dans l’aperçu pour la **recadrer** (glisser, pincer ou curseur de zoom), peut **Mélanger** l’ordre et activer l’**Effet pellicule**. Le serveur vérifie que chaque photo appartient à l’espace. Testé dans un vrai Chromium : `tests/trendy-render.mjs`.
- **Réglages** : format 4:5 (défaut), 1:1 ou 9:16 ; fond (couleurs de la marque + teintes proposées, texture papier en option) ; couleur du texte automatique avec alerte si le contraste est inférieur à 4,5:1 ; 11 polices gratuites (licence SIL OFL, fichiers et licences dans `public/media-engine/fonts/`) ; taille, alignement ; logo ou @compte.
- **Écris-moi le texte** : propose un texte dans la langue du client (gratuit par défaut, coût réglable par l’agence). Il n’écrit jamais de chiffres, de prix, de noms ni d’avis. Si l’IA est coupée, le client tape son texte.
- **Enregistrement** : « Enregistrer dans Mes visuels » range le PNG en pleine résolution dans l’espace privé du client (visible dans Modèles et dans Mes photos, et sélectionnable par l’agence dans le calendrier). Le modèle est gardé avec le fichier : bouton **Modifier ce visuel** pour le rouvrir. « Télécharger » enregistre directement sur l’appareil. La vidéo avant / après est rangée dans Mes vidéos. Un visuel prévu au calendrier ne peut pas être supprimé.
- **Agence** (Marque & accès → « Modèles ») : case **Activité de service** (les modèles avec photos passent en premier), police, fond et accent par défaut, @compte, logo (PNG de la marque), coût de « Écris-moi le texte », modèles masqués pour ce client.
- **Créatrices : choix facile et éditeur à calques** (en haut de Créer › Modèles, espaces créatrices uniquement). 31 modèles originaux (titres éditoriaux, annotations manuscrites et flèches, fausses interfaces de téléphone génériques, bulles de message, photos encadrées, texte en cercle, liste à cocher, dossier souvenirs, « ces derniers temps »…), dont 6 **carrousels continus** (une seule grande toile découpée en 2 à 10 diapos, raccord au pixel près).
  - Choisir : format en haut (Story / Couverture de Reel / Publication / Carrousel), puis une intention (Conseils, Ma journée, Ma tenue, Recette, Citation, Liste, Voyage, Avant / après, Photo dump, Coulisses ou Tout voir). La rangée **Pour vous** classe les modèles : favoris (cœur, gardés dans l’espace), puis récemment utilisés, puis ceux de sa niche (piliers de contenu). Ensuite : Minimal, Éditorial, Fun, Luxe ; bouton **Mélanger**. Chaque aperçu est dessiné avec ses propres photos et son nom.
  - **Partir de mes photos** : elle choisit (ou envoie) ses photos, numérotées dans l’ordre ; seuls les modèles qui vont avec ce nombre de photos s’affichent, déjà remplis. Sinon, le modèle demande exactement le bon nombre de photos d’un coup.
  - **Éditeur** : toucher un élément pour le sélectionner (poignées pour agrandir et tourner, deux doigts pour tout faire, appui long pour plus d’options) ; mini barre verrouiller / dupliquer / supprimer ; barre du bas selon l’élément (Texte, Police, Couleur, Fond, Réglages, Recadrer, Cadre…) ou générale (Photos, Calques, « + », Fond, Diapos) ; annuler / rétablir ; aimantation au centre et aux séparations de diapos ; « + » rond sur les emplacements photo vides ; brouillon gardé sur l’appareil. Export : Mes visuels (une image par diapo, numérotée) ou téléchargement, puis « Ajouter à mon calendrier ».
  - Limite à connaître : le studio accepte 30 envois par heure et par personne ; un carrousel de 10 diapos en utilise 10.
- **Base de données** : nouvelle table `designs` dans `supabase/02-nouvelles-fonctions.sql` (à exécuter à nouveau, sans risque).

## Opportunités (créatrices)

Un onglet « Opportunités » (ES « Oportunidades », EN « Opportunities ») apparaît dans le menu des **créatrices uniquement** ; les marques ne le voient pas.

- **Au lancement : compte à rebours.** Tant que la date d’ouverture (réglée dans Agence › Fonctions visibles, 20 jours par défaut) n’est pas passée, l’onglet montre un compte à rebours (jours · heures · minutes), trois bénéfices et « Me prévenir à l’ouverture ». Aucune donnée de marque n’est envoyée avant l’ouverture. Les marques voient dans Collaborations l’encart « Bientôt : des créatrices du studio pourront vous proposer des collaborations ».

- **Côté créatrice** : les marques à contacter, triées par niche (puces avec le nombre de marques), filtre par pays et par suivi, recherche. Chaque fiche montre le compte Instagram (s’ouvre dans un nouvel onglet), l’e-mail professionnel avec « Copier l’adresse », le site et la raison de les contacter. La créatrice choisit son suivi (À contacter, Contactée, Réponse reçue, Partenariat, Pas intéressée) et peut ajouter une note privée : personne d’autre ne la voit. Un « Modèle de premier message » est déjà rempli avec son nom et son thème, à copier ; le studio n’envoie rien.
- **Tant que la liste est vide** : « Julie prépare votre sélection de marques à contacter. Elle arrive bientôt ici. » avec le bouton « Écrire à l’agence ».
- **Côté agence** : onglet « Opportunités créatrices ». Ajouter, modifier, masquer (case « Visible ») ou supprimer une marque. Import CSV avec aperçu ligne par ligne (colonnes `niche,marque,instagram,email,site,pays,langues,note`, séparateur virgule ou point-virgule) : les lignes en erreur sont signalées et ignorées, une marque déjà présente (même compte Instagram) est mise à jour plutôt que dupliquée.
- **Règle** : uniquement des contacts professionnels publiés par la marque elle-même (site, bio Instagram). Pas d’adresse personnelle.

## Collaborations marques ↔ créatrices

- **Côté marque** (Mon compte › Collaborations) : une case, décochée par défaut, « Les créatrices du studio peuvent me proposer une collaboration ». Pour l’activer, la marque indique ce qu’elle propose (produit offert, rémunération, code promo / affiliation, échange de visibilité, autre), son offre en une ou deux phrases (280 caractères), son univers (mêmes 11 niches que les Opportunités), les pays acceptés, ce qu’elle recherche (facultatif) et un lien public (compte Instagram ou site, facultatif). La date d’activation est enregistrée. Décocher met en pause immédiatement : la marque disparaît de la liste des créatrices.
- **Côté créatrice** (Opportunités › Marques du studio, en haut de la page) : les marques ouvertes aux collaborations, avec leur offre. L’adresse e-mail de la marque n’est jamais affichée. Bouton « Proposer une collaboration » → message (600 caractères), compte Instagram, portfolio facultatif. Une seule proposition en attente par marque ; 10 propositions par jour au maximum ; après un « Pas pour le moment », nouvelle proposition possible au bout de 30 jours.
- **Réponse de la marque** : « Intéressée » (elle choisit l’adresse e-mail à transmettre, préremplie avec celle de son compte, et peut ajouter un mot) ou « Pas pour le moment ». La créatrice voit alors la réponse et, si la marque est intéressée, son contact avec un bouton « Copier l’adresse ». Chacune est prévenue par une notification dans le studio.
- **Validation des offres par l’agence** : quand une marque active les collaborations ou modifie son offre, l’offre part en relecture. L’agence reçoit une notification (cloche de l’espace agence, pastille rouge sur l’onglet « Reels & collaborations », et un e-mail à `AGENCY_OWNER_EMAIL` si `EMAIL_DELIVERY_ENABLED=true` et Brevo configuré). Section « Offres à valider » en haut de l’onglet : la version envoyée, ce qui change par rapport à la version déjà en ligne, et « Approuver » / « Refuser » (motif facultatif, 200 caractères). Une nouvelle offre reste invisible pour les créatrices tant qu’elle n’est pas approuvée ; pendant la relecture d’une modification, l’ancienne version validée reste en ligne. La marque voit l’état sous son formulaire (« En attente de validation par l’agence », « Visible par les créatrices », « Refusée : motif — modifiez votre offre pour la renvoyer ») et reçoit une notification à chaque décision. Mettre en pause reste immédiat, sans relecture ; réactiver une offre déjà validée et inchangée ne demande pas de nouvelle relecture.
- **Côté agence** (onglet « Reels & collaborations ») : toutes les propositions, avec la possibilité d’en masquer une (la marque ne la voit plus).

## Reels avec Julie (réduction)

- **Pour tous les clients** (marques et créatrices), dans Mon compte › Réductions (l’ancien onglet Parrainage, qui regroupe désormais les deux réductions) : « Un Reel avec Julie · 2 € de réduction ». Montant selon le pays de l’espace : 2 € (France), 40 MXN (Mexique), 2 USD (États-Unis) ; plafond 10 Reels validés par mois. Les montants et le plafond se changent dans `lib/pricing.mjs` (`reelCollab`, `reelCollabMaxPerMonth`).
- **Parcours client** : publier le Reel en invitant @withjulielouvet comme collaborateur (« Taguer des personnes » → « Inviter un collaborateur »), puis coller le lien du Reel. Liens acceptés : instagram.com/reel/…, /reels/…, /p/… et /compte/reel/… ; un même Reel ne peut être déclaré qu’une fois, tous clients confondus. Statuts : « En attente de vérification », « Validé · 2 € seront déduits de votre prochaine facture », « Refusé » (avec le motif ; le client peut redéclarer le Reel une fois corrigé).
- **Validation par l’agence** (onglet « Reels & collaborations ») : vérifier sur Instagram que le Reel est public et que la collaboration est acceptée, puis « Valider » ou « Refuser » (motif facultatif). Une fois validé, la remise est créditée sur le solde Stripe du client, dans la devise de son abonnement, et déduite de sa prochaine facture. S’il n’a pas encore d’abonnement Stripe, la remise attend : elle est créditée au premier paiement et déduite de la facture suivante. Si Stripe refuse le crédit, la remise reste due et l’erreur s’affiche dans la file de l’agence.
- Sur l’accueil, une fois le guide « premiers pas » terminé, une ligne rappelle l’offre et mène à l’onglet Réductions.


## Recréer ce post (toutes les clientes)

- Où : **Créer › Recréer un post**, une carte en haut des Modèles et un raccourci sur l’Accueil.
- La cliente colle le lien du post ou du Reel Instagram (facultatif) et ajoute 1 à 6 captures d’écran, ou l’enregistrement d’écran du Reel : le studio en extrait 5 images dans le navigateur. Les captures restent privées et n’apparaissent jamais dans Mes visuels.
- Le studio n’ouvre jamais le lien (Instagram l’interdit). Avec l’IA, il lit les captures et affiche « Voici la recette de ce post » : format, mise en page, accroche, couleurs, et des textes réécrits pour la marque, dans sa langue. Sans IA, la cliente choisit le format et l’envie, et voit les modèles qui vont avec (« L’analyse automatique arrive bientôt »).
- 3 modèles du studio sont proposés, déjà remplis avec ses photos ; un toucher ouvre l’éditeur. Pour un Reel : un plan de tournage (plans numérotés, durée, cadrage), « Copier le plan », puis « Ajouter mes vidéos et monter » ouvre Mes vidéos.
- Rappel affiché : on reprend l’idée et la mise en page, jamais les images, la musique ou le texte d’un autre compte.
- Envoi en un geste : raccourci iPhone (guide dans l’écran) ou partage Android (studio installé). Le lien arrive en `?recreate=…`, gardé même si la cliente doit se connecter.
- Limites : 10 analyses par heure, 30 dernières recettes gardées.

## Importer mon site (marques ; créatrices : site ou lien en bio)

- Où : en haut de **Créer › Mes produits** (ou Mes sujets).
- La cliente donne l’adresse ; le studio lit la page publique et jusqu’à 3 pages du même site (à propos, boutique) : nom, phrase d’accroche, couleurs, polices, produits (données produit du site), réseaux sociaux, image principale. Avec l’IA : ton, 3 thèmes et produits nommés dans le texte.
- Écran « Voici ce que nous avons trouvé » : elle coche. Les produits cochés sont créés tout de suite (sans photo, sauf si elle coche « Utiliser cette image »). Le ton, les couleurs, les thèmes, les polices et les réseaux partent à l’agence (notification), qui les applique en un clic dans **Marque & accès**.
- Sécurité : https seulement, adresses privées et redirections vers des adresses privées refusées, 5 s et 1,5 Mo maximum, pas de cookies ; 5 lectures par jour et par espace.
