# Louvet Content Studio — version de test privée

Styles de montage : une rubrique agence permet d’enregistrer rythme, durée des plans, transitions, format, sous-titres, couleurs, logo et son, puis d’autoriser les styles par client. Chaque demande conserve un instantané des réglages. Le moteur de rendu automatique reste à connecter. `node tests/styles.mjs` vérifie les autorisations et la conservation des réglages.

Application de création de contenus pour Louvet & Partners. Interface agence et parcours client, produits, recettes, photos privées, demandes persistantes, quotas et versions.

## État de livraison

- Clé OpenAI créée de manière sécurisée pour Personal / Default project et configurée comme secret côté serveur.
- Accès au catalogue de modèles vérifié.
- Test réel avec une référence de packaging synthétique : les trois demandes d’images et la demande de légendes ont été acceptées en arrière-plan, puis ont échoué avec `billing_not_active`.
- La facturation API doit donc être activée avant toute génération complète. Aucun résultat fictif n’est présenté comme généré.
- Site privé ; aucune invitation client envoyée et aucun changement d’audience.
- Authentification native avec ChatGPT, puis code d’espace client et liste des adresses autorisées. La connexion autonome avec un mot de passe propre au studio n’est pas implémentée.
- Tests automatisés sur le serveur réalisés avec SQLite et un stockage privé de test. Ils ne constituent pas une vérification du parcours de connexion hébergé dans un navigateur.
- Vérification visuelle/mobile et connexion réelle de deux comptes clients restent à réaliser avant ouverture.

## Guide agence

1. Ouvrir le site avec le compte ChatGPT propriétaire. Le premier compte reconnu sur le site privé reçoit le rôle agence. **Ne pas élargir l’audience avant cette première ouverture.**
2. Cliquer sur « Ajouter un client », ou « Explorer avec deux espaces de test » pour créer DUPAIN · test et Maison Studio · test.
3. Copier le code affiché une seule fois. Il peut être renouvelé depuis « Marque & accès ».
4. Ajouter les adresses exactes des comptes ChatGPT autorisés dans les paramètres du client.
5. Définir la marque, la langue, le ton, les règles, le mode de validation et les coûts en crédits de chaque catégorie.
6. Ajouter les produits et leurs caractéristiques à préserver ; ajouter les références visuelles et adapter les recettes.
7. Activer la facturation API sur https://platform.openai.com/settings/organization/billing, puis utiliser « Vérifier après activation ». Ce contrôle fait une petite requête textuelle à l’API.
8. Tester une génération réelle dans le studio ; contrôler fidélité, format, légendes, restauration après fermeture et téléchargement.
9. Traiter les validations et corrections depuis « À traiter ». Une règle permanente nécessite une approbation distincte.
10. N’inviter les vrais clients qu’après les vérifications d’authentification et d’isolation sur l’hébergement.

## Guide client

1. Se connecter avec le compte ChatGPT dont l’adresse a été autorisée par l’agence, puis entrer le code de son espace.
2. Choisir un produit ou en ajouter un en renseignant son nom, sa description et les caractéristiques à préserver.
3. Ajouter 1 à 3 photos JPG/PNG : minimum 512 pixels sur chaque côté, maximum 8 Mo chacune. Le studio vérifie le format et la résolution ; il ne garantit pas une détection automatique fiable du flou ou du mauvais produit.
4. Choisir une intention, ajouter éventuellement une préférence et vérifier les crédits disponibles.
5. Lancer la création. La demande et les identifiants de traitement sont enregistrés côté serveur.
6. Revenir dans « Mes créations » pour récupérer les visuels et copier les légendes.
7. Demander une correction et préciser si elle doit aussi être proposée comme règle pour les prochaines créations. Le visuel original reste conservé.

## Génération et limites

- Les photos originales sont transmises comme données d’image à OpenAI, avec les règles et la recette. Le client le fait explicitement en cliquant sur le bouton de création.
- Chaque visuel utilise une demande Responses indépendante en mode `background: true`, `store: true`. Une autre demande produit les légendes.
- Les calculs acceptés continuent chez le fournisseur quand la page est fermée. Leur récupération et leur copie dans le stockage durable du studio ont lieu au prochain suivi depuis l’application. Une ingestion automatique par webhook reste à ajouter pour enregistrer les résultats immédiatement lorsqu’aucun utilisateur n’ouvre le site.
- Un appel de soumission interrompu sans identifiant est marqué « Résultat à vérifier ». Aucune relance automatique n’est autorisée.
- Une erreur confirmée restitue les crédits client de l’étape ; cela ne signifie pas que le fournisseur restitue nécessairement ses frais API.
- Les consommations API renvoyées sont enregistrées. Aucun montant financier n’est inventé.
- Les paiements restent bloqués pendant la bêta. Les e-mails Brevo sont préparés mais désactivés jusqu’à l’accord explicite de Julie ; voir [Comptes et Brevo](docs/accounts-and-brevo.md).
- Dimensions : 1024×1280 (4:5), 1152×2048 (9:16), 1024×1024 (1:1). Les rendus n’ont pas encore été vérifiés faute de facturation API active.

## Développement et tests

- `node tests/security.mjs` : autorisations, deux clients séparés, fichiers privés, payload des images originales, quotas, idempotence, validations, corrections/version, règles permanentes et reprises partielles.
- `node tests/quotas.mjs` : surconsommation concurrente et répétitions simultanées.
- `./node_modules/.bin/tsc --noEmit` : contrôle TypeScript.
- `node tests/live.mjs` : essai réel explicitement facturé ; utilise uniquement une référence synthétique. Lit la clé depuis la destination privée confirmée. Ne jamais utiliser une photo privée non autorisée comme entrée de ce test.
- Les fichiers `.env*`, `work/`, `outputs/`, `.wrangler/` et `.sites-runtime/` sont exclus du dépôt.

Le fichier `.openai/hosting.json` déclare les stockages D1 et R2. Les migrations sont générées à partir de `db/schema.ts` et appliquées par Sites lors de la publication.

## Ajouts vidéo et marronnier

- « 30 idées vidéo » : plan mensuel durable, personnalisé avec les produits, la langue et les occasions du client. Les suggestions viennent d’une bibliothèque éditoriale et des faits enregistrés ; elles ne sont pas présentées comme une génération IA. Aucune consommation de crédits image.
- Chaque idée comporte une accroche, trois plans à tourner, une proposition de narration, un CTA, une durée et un suivi d’avancement. L’agence peut affiner le texte. Une adaptation aux produits actuels conserve les idées déjà tournées et celles modifiées par l’agence.
- Le mois courant est préparé à la première ouverture. Le traitement mensuel sans visite est décrit dans `docs/monthly-update.md` et doit être programmé et vérifié séparément.
- « Marronnier », directement dans Création : pays (Mexique, France, États-Unis), secteur, produit et dates client. L’occasion choisie est ajoutée côté serveur à la direction créative. Les dates commerciales à confirmer, comme les dates annuelles du Buen Fin, ne sont pas inventées.
- Les paramètres de marque permettent de masquer des occasions avec leurs identifiants (par exemple `blackfriday` ou `halloween`). L’agence peut ajouter ses propres dates.
- « Montages » : dépôt privé de 1 à 6 rushes MP4/MOV/WebM (40 Mo par fichier), demande à l’agence, suivi et restitution d’une vidéo montée avec versions conservées. Le studio peut désormais produire un vrai MP4 avec le moteur WebAssembly hébergé sur le même site. Le dépôt seul reste sans rendu ni paiement ; le client lance explicitement « Produire mon MP4 ».
- `node tests/editorial.mjs` vérifie la persistance des 30 idées, les différences entre pays/secteurs, les modifications agence, l’isolation des rushes et montages, les dates personnalisées et la déduplication.
- Pour l’hébergement commercial, la connexion sans ChatGPT et les paiements : voir `docs/production-roadmap.md`. Aucune facturation client n’a été activée dans le prototype.


## Rendu MP4 et direction créative agence

- Marque & accès : questionnaire de 25 questions, dont sept priorités, enregistré par l’agence seulement. Les réponses alimentent les requêtes images/légendes et la direction des fiches de tournage. Les notes internes sont exclues des prompts et des réponses client. Une sauvegarde adapte les idées du mois encore à tourner et non personnalisées ; les versions déjà créées gardent leur contexte initial. Les modifications gardent leurs anciennes réponses, auteur et date dans le journal.
- Montages : assemblage déterministe des rushes, par tours dans leur ordre d’ajout et selon les secondes par plan du style. Aucune sélection sémantique des meilleurs moments ni interprétation automatique des consignes en texte libre. La durée est un maximum : aucune matière manquante n’est inventée ou répétée.
- Sorties H.264/AAC : vertical 540×960, 4:5 600×750 ou carré 640×640. Image conservée entière avec marges ; son original ou silence, coupes franches ou fondu au noir. Le fondu enchaîné demande encore l’agence et est refusé explicitement par le rendu local.
- Logo PNG et musique fournie lorsqu’ils sont requis par le style. Les sous-titres exigent un fichier SRT déjà synchronisé avec le montage final ; aucune transcription automatique n’est connectée. Les ressources additionnelles servent à l’export courant, le MP4 terminé est conservé sur R2 ; elles ne deviennent pas automatiquement des ressources permanentes de la marque.
- Ce rendu se fait **sur l’appareil : garder l’onglet ouvert**. Le moteur est chargé uniquement au lancement (~31 Mo, servi depuis le site, réparti en fragments de moins de 8 Mo). Ne pas présenter ce mode comme un traitement serveur continu après fermeture. Les tâches avec bail expiré deviennent interrompues, une reprise exige une action explicite. Un service distant reste nécessaire pour un rendu autonome en arrière-plan.
- Jusqu’à six rushes de 40 Mo, 120 Mo de rushes au total pour ce moteur. La compatibilité et la mémoire disponibles varient selon l’appareil. Le navigateur mobile réel doit encore être testé.
- Les tentatives, échecs, résultats et anciennes versions sont persistés. Le MP4 reste téléchargeable sur l’appareil si son enregistrement échoue et peut être enregistré de nouveau sans recalcul. Le serveur valide le conteneur, le codec, les dimensions, la durée, l’appartenance au client et le rendu actif. Il ne décode pas le fichier vidéo sur Workers.
- Pas de crédit image consommé par ce moteur local ; pas de prix ni frais fournisseur inventés. Validation agence ou disponibilité directe selon les paramètres du client.
- `node tests/rendering.mjs` exécute réellement le même binaire WebAssembly livré au navigateur, avec des rushes synthétiques : export de huit secondes, formats mixtes, absence de piste son, fondus, sous-titres, logo, musique, stockage/versions, déduplication et isolation. Le test s’exécute dans Node, il ne remplace pas un essai navigateur sur l’hébergement.
- `node tests/quality-profile.mjs` vérifie l’enregistrement agence, l’historique, la confidentialité, le contexte des requêtes au moteur et l’adaptation des fiches de tournage.

## Accueil client avant toute nouvelle création

- Après connexion et rattachement par code, chaque espace client commence par dix questions de découverte de marque. Trois étapes puis une relecture ; français, espagnol ou anglais selon la langue du client. Une réponse « À définir avec l’agence » permet de signaler une incertitude sans inventer de faits.
- Le client enregistre un brouillon côté serveur et peut le reprendre après actualisation ou reconnexion. Les dix réponses sont requises pour transmettre. Les versions concurrentes sont protégées par un numéro de révision.
- Les réponses transmises sont verrouillées jusqu’à une éventuelle demande de précisions de l’agence. Le client reste sur un écran d’attente ; le studio s’ouvre après la décision explicite de l’agence. L’écran vérifie l’ouverture toutes les trente secondes pendant qu’il est visible.
- Dans « À traiter », l’agence retrouve les questionnaires transmis de tous les clients. Dans « Marque & accès », elle consulte les réponses, configure séparément la direction stratégique, les produits et les recettes, puis clique sur « Stratégie préparée · ouvrir le studio ». Elle peut demander des précisions avec un message visible par le client.
- Les réponses client ne sont **jamais promues automatiquement** en règles, preuves, paramètres de marque ou prompts. L’agence conserve sa propre fiche de direction créative. Chaque sauvegarde, transmission et décision est datée et attribuée dans l’historique ; les anciennes réponses restent dans le journal.
- Ce parcours concerne aussi les espaces déjà créés qui n’ont pas encore de questionnaire étudié. Les créations et fichiers antérieurs restent conservés. Avant ouverture, le serveur bloque les nouvelles générations, reprises, corrections, dépôts, produits, demandes de montage et lancements de rendu côté client ; les traitements déjà acceptés et leur enregistrement peuvent se terminer. L’agence peut continuer à configurer et intervenir.
- « Vue client » depuis le compte agence montre le questionnaire en aperçu sans permettre de se faire passer pour le client ni de répondre à sa place.
- `node tests/intake.mjs` couvre brouillon, persistance, obligation des dix réponses, isolation, conflits, demande de précisions, décision agence, absence d’appel payant avant ouverture et séparation des réponses déclaratives / stratégie validée.

## Parcours créatrice

Le studio distingue désormais les espaces « Marque » et « Créatrice / créateur » : questionnaire d’accueil, stratégie éditoriale validée par l’agence, sujets/références, trente idées avec trames de scripts et titres de couverture, et montage des rushes. Les règles d’accès restent propres à chaque espace ; aucune mise en relation marque/créatrice n’est encore activée. Voir `docs/creator-workspaces.md` pour le parcours, les limites et la suite prévue pour les collaborations.

`node tests/creators.mjs` couvre les deux parcours, les questions localisées, les piliers, les trames, la préparation avant ouverture, la conservation des idées personnalisées, le contexte transmis au moteur et l’isolation des données entre marque et créatrice.

## Inscription, calendrier et récompenses

Voir [le guide de configuration et de test](docs/onboarding-publication-rewards.md). Les variables serveur ajoutées sont `RESEND_API_KEY` (secret), `EMAIL_FROM` et `STUDIO_URL`. La migration `0006_high_silver_sable.sql` ajoute uniquement les nouvelles tables ; elle ne modifie ni ne supprime les données existantes.

## Couleurs et simplicité côté client

Voir [le guide couleurs et interface client](docs/client-colours-and-simplicity.md). Les réglages utilisent le JSON de configuration existant (`colors`, `studioVibe`) ; aucune migration de données et aucune nouvelle clé API ne sont nécessaires.

## Paiements Stripe

Voir [la configuration et les tests Stripe](docs/stripe-billing.md). La migration `0007_slimy_toad_men.sql` ajoute les liaisons et événements de paiement. Les espaces restent hors facturation automatique tant que l’agence ne l’active pas individuellement. `STRIPE_SECRET_KEY` doit être configurée comme secret serveur ; le Site privé vérifie l’abonnement avant les créations sans dépendre d’un webhook public.

## Comptes et e-mails Brevo

Désactivation réversible, suppression définitive confirmée par le nom, aperçus FR/ES et préparation Brevo sans activation : [documentation](docs/accounts-and-brevo.md). Aucun envoi ou ordonnanceur n’est activé par la présence d’une clé seule.
