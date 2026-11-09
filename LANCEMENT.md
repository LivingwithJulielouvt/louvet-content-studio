# Lancement · liste de contrôle

Tout ce qu’il faut faire, dans l’ordre, pour ouvrir le studio à des clients payants. Cochez au fur et à mesure.
Les réglages techniques détaillés sont dans `DEPLOIEMENT-SIMPLE.md` et `docs/stripe-billing.md`.

> ⚠️ Les points comptables, fiscaux et juridiques ci-dessous sont des repères, pas un avis professionnel :
> faites-les valider par votre expert-comptable et un juriste avant d’encaisser.

---

## 1. Variables d’environnement (Vercel → Settings → Environment Variables)

**Site et agence**
- [ ] `STUDIO_URL` = `https://studio.louvetpartners.com` (HTTPS obligatoire)
- [ ] `AGENCY_OWNER_EMAIL` (et `AGENCY_OWNER_UID` après la première connexion)
- [ ] `BETA_MODE=false` (sinon aucun paiement n’est possible)
- [ ] `OWNER_PRIVATE_SERVICE` : laisser vide / `false` en production

**Supabase**
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (secret, jamais côté navigateur)
- [ ] `DATABASE_URL`, `DATABASE_SSL=true`
- [ ] `SUPABASE_STORAGE_BUCKET=studio-private`, `NEXT_PUBLIC_STUDIO_BUCKET=studio-private`

**OpenAI**
- [ ] `OPENAI_API_KEY`, `AI_GENERATION_ENABLED=true` et `AI_STATUS=configured` (ou bouton « Vérifier la connexion » dans l’espace agence) — seulement quand la facturation OpenAI est active. Sans `AI_STATUS=configured`, toutes les fonctions IA restent désactivées.
- [ ] `TEXT_MODEL`, `IMAGE_MODEL`, `IMAGE_QUALITY`
- [ ] `TTS_MODEL` (voix off), `TRANSCRIBE_MODEL` (sous-titres)

**Brevo (e-mails du studio)**
- [ ] `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_STUDIO_LIST_ID`
- [ ] `EMAIL_COPY_APPROVED_VERSION=louvet-2026-10-26-v5`, `EMAIL_DELIVERY_ENABLED=true` (après relecture des textes, vouvoiement en français)
- [ ] `MAIL_WEEKLY_ENABLED`, `EMAIL_UNSUBSCRIBE_SECRET`, `EMAIL_UNSUBSCRIBE_PUBLIC_READY=true`
- [ ] `CRON_SECRET` (32+ caractères)

**Stripe**
- [ ] `STRIPE_SECRET_KEY` (clé `sk_live_…` ou clé restreinte `rk_live_…`)
- [ ] `STRIPE_WEBHOOK_SECRET` (`whsec_…`) et `STRIPE_WEBHOOK_INGRESS_READY=true`
- [ ] `STRIPE_PRICE_ID_FR`, `STRIPE_PRICE_ID_MX`, `STRIPE_PRICE_ID_US` (voir §4) ; laisser `STRIPE_DEFAULT_PRICE_ID` vide. Le studio refuse un prix dont le montant ou la devise ne correspond pas au pays.
- [ ] Facultatif : `STRIPE_PORTAL_CONFIGURATION_ID` (`bpc_…`)
- [ ] `STRIPE_SOURCE_AUTOMATIC_TAX` / `STRIPE_TAX_REGISTRATIONS_VERIFIED` : `true` seulement si Stripe Tax est configuré (§10)

**Rendez-vous, livraison, Meta**
- [ ] `BOOKING_URL` (vide = le Calendly de Julie ; `none` = demande de rendez-vous dans le studio)
- [ ] `MONTHLY_DELIVERY_ENABLED`, `MONTHLY_DELIVERY_AUTO_PREPARE`
- [ ] Plus tard : `META_APP_ID`, `META_APP_SECRET`, `META_TOKEN_KEY`, `META_PUBLISHING_ENABLED`

## 2. Supabase
- [ ] Exécuter `supabase/00-schema.sql`, puis `supabase/02-nouvelles-fonctions.sql` (sans risque, peut être rejoué ; crée notamment les tables `chat_messages` (messagerie), `calendar_entries` (contenus ajoutés par les clients au calendrier), `booking_requests`, `places`, `designs`, ainsi que `opportunities` et `opportunity_status` pour l’onglet Opportunités des créatrices, `brand_collab_profiles` et `collab_requests` pour les collaborations marques ↔ créatrices, `reel_collab_claims` pour les Reels avec Julie, et `test_batches` / `test_versions` pour les Versions à tester des créatrices). Si vous l’aviez déjà exécuté, rejouez-le : les tables existantes ne sont pas touchées (il ajoute aussi à `brand_collab_profiles` les colonnes de relecture des offres par l’agence).
- [ ] Exécuter ensuite `supabase/03-protections.sql` (peut être rejoué) : la base refuse toute écriture pour un espace supprimé (notification Stripe ou tâche tardive), et les offres de collaboration déjà visibles avant la relecture par l’agence restent visibles (rattrapage unique ; les nouvelles offres attendent toujours votre validation).
- [ ] Storage : bucket `studio-private` **privé**, 50 Mo par fichier.
- [ ] **Sauvegardes** : passer au plan **Supabase Pro (25 $/mois)** dès les premières clientes payantes — sauvegarde automatique quotidienne de la base (7 jours conservés). Option « Point-in-Time Recovery » (restauration à la minute près) si vous voulez aller plus loin (payant en plus). Sur le plan gratuit, il n’y a pas de sauvegarde automatique.
- [ ] Auth → Email : OTP activé ; modèles **Magic Link/OTP** et **Confirm signup** avec `{{ .Token }}`, en **3 langues** (un seul modèle : texte FR / ES / EN l’un sous l’autre, ou modèle conditionnel selon `{{ .Data.language }}` si vous l’alimentez).
- [ ] Auth → SMTP : identifiants SMTP Brevo (sinon les codes de connexion ne partent pas en volume).
- [ ] Auth → URL Configuration : Site URL = `https://studio.louvetpartners.com`, URL de redirection autorisée identique.

## 3. Brevo
- [ ] Domaine d’envoi authentifié (SPF, DKIM, DMARC) pour `louvetpartners.com`.
- [ ] Liste « Membres studio » créée (son identifiant dans `BREVO_STUDIO_LIST_ID`).
- [ ] Textes des e-mails relus et approuvés, puis `EMAIL_DELIVERY_ENABLED=true`.

## 4. Stripe — produit et prix
- [ ] Un produit « Louvet Content Studio » avec **3 prix mensuels récurrents** :
  - France : **89 EUR / mois** → `STRIPE_PRICE_ID_FR`
  - Mexique : **1 800 MXN / mois** → `STRIPE_PRICE_ID_MX`
  - États-Unis : **120 USD / mois** → `STRIPE_PRICE_ID_US`
- [ ] Facultatif — **abonnement annuel (2 mois offerts)** : 3 prix récurrents **annuels** dans le même produit — 890 EUR / an → `STRIPE_PRICE_ID_FR_YEAR`, 18 000 MXN / an → `STRIPE_PRICE_ID_MX_YEAR`, 1 200 USD / an → `STRIPE_PRICE_ID_US_YEAR`. Dès qu’un prix annuel existe pour un pays, « Mon abonnement » propose « Mensuel / Annuel (−2 mois) » et l’accueil affiche « ou 890 €/an (2 mois offerts) ». Les 30 visuels se renouvellent chaque mois, même en annuel. Le studio refuse un prix annuel dont le montant, la devise ou le rythme ne correspondent pas.
- [ ] Décider si les prix sont **TTC** (France) / taxes incluses ou non, et l’indiquer dans les Conditions.
- [ ] Le studio choisit automatiquement le prix du **pays du client** (champ « Pays du client » dans Marque & accès). Il est rempli à l’inscription à partir du pays choisi sur le formulaire public (sinon : langue FR → France, ES → Mexique, EN → États-Unis). Un prix personnalisé saisi par l’agence est toujours conservé.

## 5. Stripe — webhook
- [ ] Endpoint : `https://studio.louvetpartners.com/api/studio/stripe-webhook`
- [ ] Événements : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`
- [ ] Copier le secret de signature dans `STRIPE_WEBHOOK_SECRET`.

## 6. Stripe — e-mails aux clients et factures
- [ ] Settings → Customer emails : activer **« Successful payments »** (reçu) et **« Send finalized invoices »** → chaque client reçoit sa facture par e-mail chaque mois.
- [ ] Activer les e-mails **« Failed payments »** et les **relances Smart Retries** (Billing → Revenue recovery).
- [ ] Settings → Invoices : préfixe de numérotation, mentions légales en pied de facture (raison sociale, adresse, SIRET, TVA ou « TVA non applicable, art. 293 B du CGI », conditions de paiement), e-mail et téléphone de contact.
- [ ] Champ **numéro de TVA / tax ID** client activé dans le Checkout (clients professionnels).

## 7. Stripe — portail client
- [ ] Settings → Billing → Customer portal : activer **historique des factures**, **mise à jour du moyen de paiement**, **résiliation à la fin de la période** (pas immédiate), désactiver le changement de formule.
- [ ] Lien des conditions et de la politique de confidentialité : `https://studio.louvetpartners.com/conditions` et `/confidentialite`.
- [ ] Dans le studio, « Mon abonnement » affiche le prix local et le bouton **« Gérer mon abonnement (factures, carte, résiliation) »** qui ouvre ce portail.

## 8. Stripe — image de marque
- [ ] Settings → Branding : logo, icône, couleur (`#19352d`), nom public « Louvet & Partners ».
- [ ] Libellé sur relevé bancaire (statement descriptor) : ex. `LOUVET STUDIO`.

## 9. Vercel et domaine
- [ ] Plan **Vercel Pro** (le plan gratuit Hobby est réservé à un usage non commercial ; Pro donne aussi des tâches planifiées à l’heure précise et des fonctions plus longues).
- [ ] Domaine `studio.louvetpartners.com` (DNS CNAME vers Vercel), HTTPS actif.
- [ ] Tâches planifiées visibles (lundi 9 h et tous les jours 9 h 05, heure de Monterrey).

## 10. Comptabilité, factures et taxes
- [ ] **France — facturation électronique** : depuis le **1er septembre 2026**, toute entreprise doit pouvoir **recevoir** des factures électroniques via une plateforme agréée (PA) ; l’**émission** devient obligatoire pour les micro-entreprises et PME au **1er septembre 2027**. Les factures PDF de Stripe ne suffiront pas pour les clients professionnels français : prévoir une PA (ou un logiciel relié à une PA) d’ici là. Les ventes aux particuliers relèvent de l’**e-reporting** (transmission des données de vente) aux mêmes échéances.
- [ ] Choisir dès maintenant la plateforme agréée de réception et l’indiquer à votre comptable.
- [ ] **Mexique — CFDI** : une facture fiscale CFDI 4.0 ne peut être émise que par une **entité mexicaine** (RFC) via un **PAC** ; Stripe ne l’émet pas. Prévoir l’entité, le PAC et la procédure (y compris la « factura global » pour les clients sans RFC).
- [ ] **États-Unis — sales tax** : selon les États, les logiciels en ligne (SaaS) sont taxables ; une obligation naît en dépassant les seuils de « nexus économique » de chaque État. Stripe Tax peut suivre les seuils et calculer la taxe : à activer avec votre comptable (`STRIPE_SOURCE_AUTOMATIC_TAX`).
- [ ] TVA France : franchise en base ou TVA collectée ? À reporter sur les factures et dans les Conditions.

## 11. Juridique
- [ ] Faire relire et compléter `/conditions`, `/confidentialite`, `/mentions-legales` (textes dans `lib/legal-copy.mjs`) : remplacer tous les `[CROCHETS]`, puis retirer le bandeau « Brouillon » (clé `draft` dans `LEGAL_UI`).
- [ ] Vérifier les contrats de sous-traitance (DPA) : Supabase, Vercel, Stripe, Brevo, OpenAI, Calendly.
- [ ] Cookies : le site n’utilise que des éléments indispensables (session, langue, guide) et les polices sont hébergées avec le site → pas de bandeau. À revérifier si vous ajoutez un outil de mesure d’audience, un pixel publicitaire ou une vidéo intégrée.

- [ ] **Opportunités (créatrices)** : n’y saisir que des contacts professionnels publiés par la marque elle-même (site, bio Instagram), jamais d’adresse personnelle. En France (RGPD) comme au Mexique (LFPDPPP), la prospection B2B vers une adresse professionnelle publiée est en général admise si le message concerne l’activité de la personne et qu’on peut refuser d’être recontacté ; retirez une fiche dès qu’une marque le demande. À faire valider par un juriste. Les créatrices écrivent elles-mêmes, à leur nom : le studio n’envoie rien.

- [ ] **Reels avec Julie** : faire valider la clause « Réductions » des Conditions (remise de 2 € / 40 MXN / 2 USD par Reel, plafond 10 par mois, validation par l’agence, Reel public avec collaboration acceptée, sans valeur monétaire). Vérifier aussi avec l’expert-comptable le traitement de ces remises sur les factures (crédit de solde Stripe déduit de la facture suivante).
- [ ] **Collaborations marques ↔ créatrices** : le consentement de la marque est explicite (case décochée par défaut) et daté ; son e-mail n’est transmis qu’après son accord. Faire valider la mention ajoutée dans la page Confidentialité (avec la ligne sur le carnet d’opportunités).

## 12. OpenAI, Calendly, Meta
- [ ] OpenAI : facturation active, limite de dépense mensuelle définie, `AI_GENERATION_ENABLED=true`, `AI_STATUS=configured`.
- [ ] Calendly : lien de Julie à jour (ou `BOOKING_URL`), notifications vers le bon agenda.
- [ ] Meta (plus tard) : application Meta validée (`instagram_content_publish`) avant `META_PUBLISHING_ENABLED=true`.

---

## 13. Test de mise en service (10 étapes, avec une vraie carte et un petit montant ou en mode test)
1. Ouvrir le site en navigation privée : accueil, prix du pays, liens **Conditions / Confidentialité / Mentions légales** en bas de page.
2. Envoyer le formulaire `/souscrire` avec le pays France : l’accusé de réception arrive (Brevo).
3. Se connecter avec le code reçu (Supabase SMTP), créer l’espace, répondre au questionnaire.
4. Côté agence : vérifier le pays du client (France), préparer et ouvrir le studio.
5. Agence → Paiements : cocher « Exiger un abonnement » (le prix France est pris tout seul), enregistrer.
6. Client → Mon abonnement : le prix affiché est **89 €** ; « S’abonner » ouvre la page Stripe en français ; payer.
7. Revenir au studio : l’accès est « À jour » dès réception du webhook (bouton « J’ai déjà payé : actualiser » sinon) ; vérifier l’e-mail de reçu/facture Stripe.
8. « Gérer mon abonnement » : la facture est visible, changer la carte, puis **résilier** → l’accès reste jusqu’à la fin de la période.
9. Messages : depuis le client, « Écrire à l’agence » avec une photo ; côté agence, onglet **Messages** → répondre ; le client voit la réponse et la pastille.
10. Supprimer l’espace de test (Marque & accès → suppression) : fichiers, messages et compte effacés ; dans Stripe, annuler l’abonnement de test et rembourser si besoin.

## 13. Sécurité (à faire une fois)

- [ ] **Supabase › Storage › bucket `studio-private`** : laisser **privé**, limite **50 Mo** par fichier, et dans « Allowed MIME types » ne garder que : `image/png, image/jpeg, image/webp, video/mp4, video/quicktime, audio/mpeg, audio/mp4`.
- [ ] **Supabase › Authentication › Attack Protection** : activer le **CAPTCHA** (Cloudflare Turnstile, gratuit) pour que des robots ne puissent pas épuiser les e-mails de code de connexion.
- [ ] **Formulaire public (facultatif mais conseillé)** : créer un widget Turnstile sur dash.cloudflare.com (domaine `studio.louvetpartners.com`), puis dans Vercel : `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (clé publique) et `TURNSTILE_SECRET_KEY` (secrète). Sans ces deux variables, le formulaire fonctionne sans vérification anti-robot.
- [ ] Vérifier après mise en ligne (securityheaders.com) que les en-têtes de sécurité sont présents : le studio ne peut pas être affiché dans un cadre d’un autre site, HTTPS strict, politique de sécurité du contenu.
- [ ] `CRON_SECRET` défini (les tâches planifiées refusent tout appel sans lui). L’ancienne action « monthly-maintenance » n’existe plus.
- Ce que le studio fait déjà : limites par heure atomiques (messages, envois, rendez-vous, calendrier, IA), envois refusés supprimés du stockage et nettoyage quotidien des envois abandonnés, fichiers servis en téléchargement, adresses des marques affichées une par une (tracées), parrainage rattaché seulement après connexion de l’adresse.

## 14. Fonctions visibles, suivi des erreurs, mesure d’audience
- [ ] **Agence › Fonctions visibles** : au lancement, « Opportunités & Marques du studio » est en **compte à rebours** (3 états : Masqué / Compte à rebours / Ouvert). La date d’ouverture est fixée à **20 jours** après la première ouverture du studio et se modifie dans ce même écran ; les créatrices voient un compte à rebours (badge « J-20 » dans leur menu) et peuvent demander « Me prévenir à l’ouverture » ; les marques voient un encart « Bientôt » dans Collaborations. À la date, Opportunités s’ouvre tout seul et les créatrices inscrites reçoivent une notification (tâche quotidienne). Remplissez la liste de marques avant cette date. « Versions à tester » est **masquée** : allumez-la après un essai sur votre iPhone. « Collaborations côté marques », « Réductions Reels », « Recréer ce post » et « Importer mon site » sont allumées par défaut.
- [ ] **Suivi des erreurs (Sentry, gratuit au début)** : créer un projet « Next.js » sur sentry.io, copier son DSN dans `SENTRY_DSN` (et `SENTRY_ENVIRONMENT=production`). Les erreurs du serveur et des navigateurs des clientes vous arrivent par e-mail, sans adresse e-mail ni secret (masqués avant l’envoi). Sans DSN, rien n’est envoyé.
- [ ] **Mesure d’audience sans cookie** : Vercel → projet → Analytics → Enable, puis `NEXT_PUBLIC_ANALYTICS=vercel` et redéployer. Seules les pages vues sont comptées, de façon anonyme ; la page Confidentialité le mentionne. Aucun bandeau cookies n’est nécessaire.
- [ ] **Test bêta** : avant d’ouvrir à tout le monde, suivre `TEST-BETA.md` (1 semaine, 3 à 5 vraies clientes sur iPhone).

## 14. Recréer ce post et Importer mon site

- [ ] Relancer `supabase/02-nouvelles-fonctions.sql` puis `03-protections.sql` (tables `inspirations` et `site_imports`, protégées à la suppression d’un espace).
- [ ] Les deux fonctions sont allumées par défaut ; elles s’éteignent dans **Agence › Fonctions visibles**.
- [ ] L’analyse des captures et le résumé du site utilisent l’IA (`AI_GENERATION_ENABLED=true`, `AI_STATUS=configured`). Sans IA, « Recréer ce post » propose les modèles selon le format choisi, et « Importer mon site » se contente de ce qu’il lit sur la page.
- [ ] Partage depuis Instagram : sur Android, le studio ajouté à l’écran d’accueil apparaît dans « Partager » ; sur iPhone, la cliente crée un Raccourci (guide dans le studio : « Envoyer depuis Instagram en un geste »).
- `OPENAI_BASE_URL` : réservé aux tests (serveur d’IA simulé). Ne pas le définir en production.
