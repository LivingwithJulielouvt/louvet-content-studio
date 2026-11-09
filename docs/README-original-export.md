# Louvet Content Studio — export complet des sources

Export du 16 octobre 2026 (UTC), destiné à reprendre le projet dans une autre conversation pour une migration vers Vercel. **Aucune migration, publication, activation, connexion de production ou modification DNS n’a été effectuée pour cet export.**

## 1. Quelle version contient ce ZIP ?

- Dépôt courant : commit `3268a68b1dbf507a1bcdf40a92774b86b5649ec9`, sans modification locale en attente lors de la copie.
- 230 fichiers source suivis, tous inclus, avec les composants, styles, fichiers publics, moteur vidéo, configuration, schémas, migrations et tests.
- Ce code inclut les derniers changements préparés mais non publiés : accueil FR/ES, routes de connexion, protections et formulaire de demande.
- Métadonnées du Site relues pour cet export : version hébergée **10**, audience `custom` (privée). **La version en ligne et la dernière préparation locale ne sont donc pas identiques.** Pour reproduire la dernière interface préparée, partir de ce ZIP.
- Le README racine a été rédigé pour l’export. Le README source original est conservé intégralement dans `docs/README-original-native.md`. Certaines notes historiques de ce dernier sont dépassées : notamment la promotion du premier visiteur et les anciens paramètres Resend. Les sources et le présent README font foi.
- `SOURCE-FILES.md` donne chaque chemin et l’empreinte SHA-256 de chaque fichier source original. `SHA256SUMS.txt` contrôle les fichiers effectivement inclus dans l’export.

**Ce ZIP est le projet actuel natif Sites/Vinext, pas une application déjà migrée ou prête à déployer telle quelle sur Vercel.** L’authentification Supabase et Vercel Cron ne sont pas installés. Aucun projet Supabase/Vercel n’est provisionné.

## 2. Ce qui est inclus

| Fonction | Sources principales | État dans cet export |
| --- | --- | --- |
| Accueil Louvet & Partners FR/ES, 89 USD/mois, FAQ | `app/page.tsx`, `app/public-site.tsx`, `lib/public-site-copy.mjs`, `app/public-site.css` | Interface complète préparée |
| Connexion et protection des pages | `app/chatgpt-auth.ts`, `app/connexion/`, `app/login-panel.tsx`, `app/[...protectedPath]/`, `lib/studio-navigation.mjs` | Authentification native ChatGPT, pas de véritable OTP autonome |
| Vue agence et espaces clients | `app/studio/page.tsx`, `app/studio-ui.tsx`, `lib/studio.mjs` | Rôles et isolation vérifiés sur le serveur |
| Questionnaire, brouillons, mode test agence et ouverture du compte | `app/client-intake.tsx`, `lib/client-intake.mjs`, `lib/publication.mjs`, `lib/studio.mjs` | Parcours complet, réponses de test séparées |
| Demande de souscription et reçu | `app/souscrire/page.tsx`, `lib/public-subscriptions.mjs`, `app/public-requests.tsx` | Dans le dernier code demandé ici, le formulaire exige une connexion ; il faudra le rendre public dans la migration si c’est la consigne retenue |
| 5 espaces fictifs bêta, invitations, limites et avis | `lib/beta.mjs`, `app/beta-chrome.tsx`, `drizzle/0008_smooth_bloodaxe.sql` | 20 tentatives d’image par testeur ; paiements réels bloqués quand `BETA_MODE=true` |
| Désactivation et suppression confirmée par le nom | `app/account-controls.tsx`, `lib/client-lifecycle.mjs`, migration `0009` | Suppression des lignes et objets du client, reprise sur échec et blocage des écritures tardives |
| Brevo, 3 e-mails FR/ES et désinscription | `app/studio-mail.tsx`, `lib/studio-mail.mjs`, `lib/studio-email-templates.mjs`, `app/mail/unsubscribe/route.ts` | Transport et modèles prêts, activation soumise aux drapeaux et à l’accord explicite |
| Stripe, Checkout, portail, webhook et accès selon paiement | `app/billing-panel.tsx`, `lib/billing.mjs` | Logique et contrôles présents, pas d’activation par cet export |
| Génération et quotas d’images | `lib/studio.mjs`, `app/studio-ui.tsx` | Appels OpenAI côté serveur ; clé, facturation API et modèles accessibles à configurer séparément |
| Calendrier, statuts et points | `app/publication-calendar.tsx`, `lib/publication.mjs` | Gestion agence, confirmation client et points attribués une seule fois puis retirés si annulation |
| Couleurs, ambiances et mots simples | `lib/client-experience.mjs`, `app/globals.css`, `app/filming-guide.tsx` | Personnalisation par espace, indications de tournage FR/ES/EN |
| Créatrices et créateurs | `lib/workspaces.mjs`, `lib/creator-editorial.mjs`, `app/creator-strategy.tsx` | Parcours distinct des marques, sans collaboration automatique entre clients |
| 30 idées vidéo, occasions et styles agence | `app/video-studio.tsx`, `lib/editorial.mjs`, `lib/quality-profile.mjs` | Plan éditorial déterministe, guidé par les données et réglages de l’agence |
| Export MP4 local | `lib/browser-render.ts`, `lib/video-render.mjs`, `public/media-engine/` | Véritable moteur FFmpeg WebAssembly inclus, pas une simulation de vidéo |
| Aperçu de connexion e-mail proposé | `scripts/email-login-preview.tsx`, `scripts/public-entry-preview.template.html` | Maquette sans réseau. Le code d’essai `123456` n’est jamais un mécanisme d’authentification réel |

## 3. Structure

```text
app/
  page.tsx                         # accueil, toujours l’entrée principale
  layout.tsx                       # styles globaux et métadonnées
  globals.css                      # interface du studio
  public-site.tsx / public-site.css # accueil et formulaire FR/ES
  connexion/page.tsx                # connexion native actuelle
  studio/page.tsx / studio-ui.tsx   # agence + client selon identité serveur
  souscrire/page.tsx                # formulaire, protégé dans cet instantané
  [...protectedPath]/page.tsx       # redirection des autres pages
  api/studio/[...path]/route.ts     # API métier, D1/R2 via bindings
  mail/unsubscribe/route.ts         # désinscription par jeton signé
  *.tsx                            # modules d’interface, calendrier, vidéos, etc.
lib/                               # logique métier, autorisation et fournisseurs
components/ui/                     # composants UI réutilisables
hooks/                             # hooks partagés
db/schema.ts                       # schéma Drizzle SQLite
drizzle/                           # migrations 0000 à 0011 + journal/snapshots
public/                            # SVG et moteur vidéo, police et licences
build/                             # intégration Vinext/Sites/Workers
scripts/                           # installation, compilation et aperçus
tests/                             # suites métier + référence synthétique
docs/                              # guides fonctionnels et historiques
examples/                          # exemple D1 conservé avec le projet
vendor/                            # styles et licences fournis
.openai/hosting.json                # bindings DB/BUCKET et identifiant du Site
package.json / pnpm-lock.yaml       # dépendances et verrouillage exact
.env.example                       # noms et valeurs sûres, sans secret
ENVIRONMENT-REFERENCE.md            # inventaire statique de toutes les variables
EXPORT-INFO.json / SOURCE-FILES.md  # provenance et inventaire
SHA256SUMS.txt                      # intégrité de l’export
```

L’inventaire exhaustif se trouve dans `SOURCE-FILES.md`. Aucun fichier métier ou asset suivi n’a été supprimé. Les scripts conservent leurs permissions exécutables dans le ZIP.

## 4. Dépendances et démarrage

Le manifeste complet et le lockfile sont inclus. Le projet repose sur React 19, Next 16 avec **Vinext/Vite**, TypeScript, Drizzle SQLite, Cloudflare Workers/D1/R2 et FFmpeg WebAssembly. Il ne faut pas confondre la présence de Next dans `package.json` avec une configuration Vercel déjà fonctionnelle.

- Moteur déclaré : Node `>=22.13.0` ; les dernières vérifications de ce projet ont été faites dans l’environnement Node 24 disponible.
- Gestionnaire déclaré : `pnpm@11.25.0`. Conserver le lockfile pour reproduire les versions résolues.
- Installer les dépendances avec ce gestionnaire et `pnpm install --frozen-lockfile`. L’installation nécessite un accès réseau aux registres ; `node_modules` n’est pas livré.
- Les scripts d’installation Sites sont aussi conservés. `npm run install:ci` attend Linux, `flock`, GNU `timeout`, et pnpm/Corepack ; ce n’est pas une commande portable garantie sur macOS ou Vercel.
- Commandes existantes : `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm db:generate`. Elles utilisent encore les adaptateurs et services du projet Sites/Workers.
- `.sites-runtime/` est volontairement absent. `scripts/execution-profile.mjs` utilise alors le profil `portable` ; ne pas recopier un état privé de l’environnement ChatGPT.
- La base doit exister et recevoir les migrations dans l’ordre. Dans Sites, l’application des migrations était prise en charge lors de la publication. L’export ne crée aucune base.
- Les profils de marque, couleurs, réponses, fichiers et calendriers des vrais clients sont des **données de base/stockage**, pas des fichiers source. Ils ne sont pas inclus. Les 5 espaces fictifs ont leur définition dans la migration bêta.

### Vérifications hors production

Les suites métier utilisent SQLite en mémoire et des fournisseurs simulés. Elles ne déclenchent pas d’envoi Brevo ni de paiement :

```bash
node tests/navigation.mjs
node tests/security.mjs
node tests/beta.mjs
node tests/public-subscriptions.mjs
node tests/client-lifecycle.mjs
node tests/studio-mail.mjs
node tests/billing.mjs
node tests/intake.mjs
node tests/publication.mjs
node tests/client-experience.mjs
node tests/quotas.mjs
node tests/creators.mjs
node tests/editorial.mjs
node tests/styles.mjs
node tests/quality-profile.mjs
node tests/rendering.mjs
pnpm exec tsc --noEmit
```

`tests/rendering.mjs` exécute le vrai moteur avec des médias synthétiques et dépend des outils locaux prévus par cette suite. Ces tests ne remplacent pas une recette navigateur de l’authentification et du mobile.

**Ne pas exécuter `tests/live.mjs` automatiquement** : c’est un ancien test réel OpenAI, avec un chemin privé historique à remplacer. Une exécution adaptée peut être facturée. Aucun secret à ce chemin n’est inclus.

## 5. Variables serveur et clés nécessaires

Les noms ci-dessous sont ceux que le code actuel lit. Aucune valeur secrète de production n’est exportée. `.env.example` contient uniquement des emplacements vides et des drapeaux désactivés ; sa copie seule ne configure pas les bindings D1/R2 ni les services.

### Stockage et identité actuels

| Nom | Type / nécessité | Rôle |
| --- | --- | --- |
| `DB` | Binding objet D1, nécessaire | Données SQLite via `prepare().bind()` et transactions `batch()` ; ce n’est pas une URL de base dans une variable texte |
| `BUCKET` | Binding objet R2, nécessaire | Photos, vidéos et résultats privés ; lecture/écriture/listage/suppression |
| `AGENCY_OWNER_ID` | Identifiant serveur sensible, nécessaire pour le propriétaire | Identité native **propre à ce Site** autorisée à obtenir la vue agence. Aucune promotion du premier visiteur. Ne pas réutiliser cet identifiant comme identité Supabase |
| `BETA_MODE` | Booléen texte, exemple `true` | Bêta sur invitation, 5 espaces fictifs et limite de 20 tentatives d’image. `true` bloque les paiements Stripe réels |
| `OWNER_PRIVATE_SERVICE` | Booléen texte, laisser `false` | Autorise uniquement un traitement mensuel réservé au service privé ; n’authentifie jamais un client |
| `CONNECTORS` | Binding de service facultatif | Intégration technique Sites/aperçu des connecteurs ; pas une clé client |

L’identité réelle provient actuellement des en-têtes de confiance `oai-authenticated-user-id`, `oai-authenticated-user-email` et, facultativement, du nom encodé par la plateforme. **Ce ne sont pas des variables à exposer ou des en-têtes à accepter du navigateur sur Vercel.** Il faudra remplacer cette frontière par la validation serveur de la future session.

### OpenAI

| Nom | Type | Rôle / valeur dans le code |
| --- | --- | --- |
| `OPENAI_API_KEY` | Secret serveur | Clé du projet API ; jamais dans le navigateur, le ZIP ou une variable `NEXT_PUBLIC_*` |
| `TEXT_MODEL` | Texte facultatif | Défaut du code : `gpt-5-mini` |
| `IMAGE_MODEL` | Texte facultatif | Défaut du code : `gpt-image-2` |
| `AI_STATUS` | Texte facultatif | Repli de statut si rien n’est enregistré en base ; `billing_required` bloque les créations. Une clé présente ne garantit pas la facturation API ou l’accès au modèle |

Les valeurs ci-dessus décrivent les sources exportées, pas une garantie d’accès au catalogue d’un autre compte. Les modèles et la facturation doivent être validés lors de la reprise. Aucune clé n’a été lue, copiée, créée ou modifiée pour cet export.

### Brevo et rappel hebdomadaire

| Nom | Type | Rôle |
| --- | --- | --- |
| `BREVO_API_KEY` | Secret serveur | API transactionnelle et synchronisation des contacts |
| `BREVO_SENDER_EMAIL` | Adresse | Expéditeur vérifié ; nom affiché Louvet & Partners |
| `BREVO_STUDIO_LIST_ID` | Entier positif | Liste nommée exactement **Membres studio** |
| `STUDIO_URL` | URL HTTPS | Origine du studio ; liens vers `/studio`, liens de paiement et désinscription |
| `EMAIL_COPY_APPROVED_VERSION` | Version approuvée, laisser vide | Doit correspondre explicitement à `louvet-2026-10-16-v1` avant d’autoriser ces textes |
| `EMAIL_DELIVERY_ENABLED` | Booléen texte, laisser `false` | Autorisation d’envoi. Une clé seule ne suffit pas |
| `MAIL_WEEKLY_ENABLED` | Booléen texte, laisser `false` | Autorisation distincte du rappel hebdomadaire |
| `EMAIL_UNSUBSCRIBE_SECRET` | Secret aléatoire, au moins 32 caractères | Signature des jetons personnels de désinscription |
| `EMAIL_UNSUBSCRIBE_PUBLIC_READY` | Booléen texte, laisser `false` | Déclaration de vérification d’une désinscription accessible sans connexion |
| `STUDIO_MAIL_CRON_SECRET` | Autre secret aléatoire, au moins 32 caractères | Bearer d’autorisation du traitement `/api/studio/mail-weekly` |

À préparer dans Brevo après accord : attributs `FIRSTNAME` (texte), `STUDIO_LANGUAGE` (texte), `STUDIO_WEEKLY` (booléen), expéditeur/domaine vérifiés, liste et banque de chiffres bilingues sourcés approuvés. Le rappel refuse les appels hors du lundi 9–10 h en `America/Monterrey` et dédoublonne par membre et lundi. **Aucune tâche Vercel Cron n’existe dans ce code.** L’endpoint actuel attend POST ; ne pas le raccorder à un ordonnanceur GET sans adaptation. Les e-mails préparés restent soumis aux garde-fous d’accord.

Le code actuel utilise l’API Brevo, pas Supabase SMTP. **Supabase Auth, les paramètres SMTP Brevo et l’e-mail de code de connexion restent à intégrer dans la future conversation.** Une clé SMTP Brevo est distincte d’une clé API Brevo. Les noms de variables du futur adaptateur Supabase ne sont pas présentés ici comme déjà consommés par le projet.

### Stripe

| Nom | Type | Rôle |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Secret serveur | Clé API de l’environnement choisi, avec les permissions requises ; ne jamais mélanger test et production |
| `STRIPE_WEBHOOK_SECRET` | Secret serveur | Vérification des notifications signées sur `/api/studio/stripe-webhook` |
| `STRIPE_WEBHOOK_INGRESS_READY` | Booléen texte, laisser `false` | Déclarer seulement après réception publique vérifiée de bout en bout |
| `STRIPE_DEFAULT_PRICE_ID` | Identifiant public `price_…` | Tarif mensuel existant à proposer ; ce n’est pas une clé secrète |
| `STRIPE_DEFAULT_AMOUNT` | Montant en unités mineures | Ex. `8900` pour l’affichage d’un tarif de 89 USD ; le code vérifie le tarif canonique Stripe |
| `STRIPE_DEFAULT_CURRENCY` | Devise | Ex. `usd` |
| `STRIPE_SOURCE_PAYMENT_LINK` | URL publique | Référence du lien de paiement d’origine |
| `STRIPE_SOURCE_AUTOMATIC_TAX` | Booléen texte | Indique le traitement fiscal à vérifier pour le tarif source |
| `STRIPE_TAX_REGISTRATIONS_VERIFIED` | Booléen texte, laisser `false` | Déclaration après vérification des conditions fiscales applicables dans Stripe |

Pas de clé publique Stripe requise pour le flux Checkout hébergé actuel. L’activation effective dépend aussi des réglages de facturation stockés par espace. Les paiements restent bloqués en bêta. Supprimer un compte du studio ne résilie pas automatiquement son abonnement chez Stripe.

Les mentions `RESEND_API_KEY` et `EMAIL_FROM` dans des documents historiques appartiennent à l’ancien transport ; elles ne sont **plus nécessaires** au code actuel.

### Outillage et simulations

`ENVIRONMENT-REFERENCE.md` liste aussi les variables d’exécution des scripts : `SITES_*`, chemins Wrangler/Miniflare, réglages de compilation et d’installation, `CODEX_SANDBOX`, `CLOUDFLARE_CF_FETCH_ENABLED`, etc. Elles ne sont pas des clés métier et la majorité n’a pas à être reproduite sur Vercel.

Les points `API_FETCH`, `BREVO_FETCH`, `STRIPE_FETCH`, `MAIL_NOW` et `BILLING_NOW` sont des fonctions injectées par les tests, pas des secrets texte à configurer dans un hébergeur. `DEV` est fourni par Vite. Le catalogue statique inclut également les variables standard que les scripts lisent, sans demander de remplacer les réglages du système.

## 6. Reproduire l’interface à l’identique lors de la reprise

1. Conserver `app/`, `components/`, `hooks/`, `lib/`, `public/` et `vendor/` avec leurs chemins, ainsi que le lockfile.
2. Préserver les règles de `app/globals.css` et `app/public-site.css`, les icônes Lucide, les textes bilingues et la logique de thème par client.
3. Le moteur vidéo est livré **en totalité** : quatre fragments WASM totalisant 32 232 419 octets, JavaScript, police, manifeste et licences. Ne pas omettre les fragments ni changer leurs chemins sans modifier le chargeur.
4. Les couleurs et contenus propres à un client sont calculés à partir de ses réglages en base. Reproduire un espace réel au pixel près nécessitera ses données de configuration, à exporter séparément avec autorisation. Ce ZIP contient le rendu et les données fictives du code, pas les données privées des clients.
5. Adapter séparément le serveur : imports `cloudflare:workers`, bindings D1/R2, opérations SQLite et transactions, wrappers Sites/Vinext, validation d’identité, ordonnanceur et configuration des domaines.
6. Conserver les protections serveur des quotas, rôles, fichiers, suppression, doubles récompenses, paiements et e-mails. Une simple modification du bouton de connexion ne suffit pas à migrer l’authentification.
7. Ne pas accepter les anciens en-têtes ChatGPT directement sur le nouvel hébergement. Rattacher explicitement les identités vérifiées aux comptes existants et réserver le rôle agence à Julie.
8. Relire la décision de parcours dans l’autre conversation : le **code actuel protège le formulaire de souscription** ; le rendre public devra être une modification délibérée, avec les garde-fous adaptés. L’accueil reste toujours public au niveau de l’application, une fois l’audience de l’hébergement ouverte.

## 7. Ce qui n’est pas dans le ZIP

- Valeurs de clés API, clés SMTP, tokens de session, identifiants de service privés, credentials Git/Sites et fichiers `.env` réels.
- Base D1 en production, comptes/contacts réels, réponses de clients, historiques, images/vidéos privées et objets R2.
- Historique `.git`, dépendances `node_modules`, sorties `dist/.next`, caches, état `.wrangler/.sites-runtime`, logs et résultats de travail temporaires.
- Une migration Vercel/Supabase prête à lancer, un déploiement, une configuration DNS ou une nouvelle activation d’envoi/paiement.

Ces exclusions ne retirent aucun code applicatif. L’export vise une reprise complète des **sources et de l’interface**, et non une copie des secrets ou des données de production.

## 8. Dépendances exactes déclarées

Les versions résolues transitives sont verrouillées dans `pnpm-lock.yaml`. Tables générées depuis le `package.json` inclus :

### Dépendances applicatives

| Paquet | Version déclarée |
| --- | --- |
| `@base-ui/react` | `^1.7.0` |
| `@ffmpeg/core` | `0.12.10` |
| `@ffmpeg/ffmpeg` | `0.12.15` |
| `@hookform/resolvers` | `^5.7.1` |
| `@shadcn/react` | `^0.3.0` |
| `class-variance-authority` | `0.7.1` |
| `clsx` | `2.1.1` |
| `cmdk` | `^1.1.1` |
| `date-fns` | `^4.4.0` |
| `drizzle-orm` | `0.45.2` |
| `embla-carousel-react` | `^8.6.0` |
| `input-otp` | `^1.4.2` |
| `lucide-react` | `^1.31.0` |
| `next` | `16.3.4` |
| `next-themes` | `^0.4.6` |
| `radix-ui` | `^1.6.7` |
| `react` | `19.2.6` |
| `react-day-picker` | `^10.0.1` |
| `react-dom` | `19.2.6` |
| `react-hook-form` | `^7.85.0` |
| `react-resizable-panels` | `^4.12.2` |
| `recharts` | `^3.8.0` |
| `sonner` | `^2.0.8` |
| `tailwind-merge` | `3.6.0` |
| `vaul` | `^1.1.2` |
| `zod` | `^3.25.76` |

### Dépendances de développement et de compilation

| Paquet | Version déclarée |
| --- | --- |
| `@cloudflare/vite-plugin` | `1.37.1` |
| `@cloudflare/workers-types` | `4.20260515.1` |
| `@tailwindcss/postcss` | `4.2.1` |
| `@types/node` | `22.19.19` |
| `@types/react` | `19.2.14` |
| `@types/react-dom` | `19.2.3` |
| `@vitejs/plugin-react` | `6.0.2` |
| `@vitejs/plugin-rsc` | `0.5.26` |
| `drizzle-kit` | `0.31.10` |
| `eslint` | `9.39.4` |
| `eslint-config-next` | `16.3.4` |
| `json-rpc-2.0` | `1.7.1` |
| `raw-body` | `3.0.2` |
| `react-server-dom-webpack` | `19.2.6` |
| `tailwindcss` | `4.2.1` |
| `tw-animate-css` | `^1.4.0` |
| `typescript` | `5.9.3` |
| `vinext` | `1.0.0-beta.5` |
| `vite` | `8.0.13` |
| `wrangler` | `4.92.0` |

