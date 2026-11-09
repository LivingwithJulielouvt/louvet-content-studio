# Paiements Stripe et accès au studio

## Fonctions installées

- Onglet agence **Paiements & abonnements**, avec réglages par espace, suivi et liaison d’un abonnement Stripe existant.
- Onglet client **Mon abonnement** : page de paiement Stripe Checkout, portail pour régulariser/changer la carte/consulter les factures, et bouton pour revérifier l’accès après paiement.
- Chaque client du studio est relié à un seul client Stripe et un seul abonnement ; des index uniques empêchent le partage d’une même liaison entre deux espaces.
- Paiement désactivé par défaut sur les espaces existants et nouveaux. L’agence doit définir le tarif et activer le paiement obligatoire pour chaque espace concerné. Aucun client existant n’est suspendu par cette installation.
- Double condition pour créer : questionnaire étudié et studio ouvert par l’agence, puis paiement confirmé si la facturation est activée pour cet espace.
- Premier paiement impayé : nouvelles créations bloquées. Paiement mensuel confirmé : accès ouvert et crédits photo remis au forfait de cette période, une seule fois.
- Renouvellement impayé : délai de 3 jours par défaut, réglable de 0 à 30 jours. Le délai démarre à l’échéance de la facture, pas à la prochaine connexion. Aucun délai de premier paiement gratuit n’est accordé.
- Après le délai : création d’images, nouvelles corrections, nouveaux envois de photos/vidéos et nouveaux montages bloqués côté serveur. Les contenus enregistrés, téléchargements, calendrier, points et paiement restent accessibles. Un rendu déjà lancé peut terminer l’enregistrement de son résultat.
- L’agence peut accorder une exception datée avec motif, par exemple pour un virement reçu. Elle expire automatiquement ; elle ne remet pas les crédits à zéro et ne contourne pas la préparation du studio.
- Les paiements réactivent les créations si l’abonnement est en règle. Un abonnement résilié, impayé définitif ou mis en pause bloque la création ; les essais sans paiement ne donnent pas automatiquement de crédits.

## Configuration nécessaire avant les paiements réels

1. **Historique — ne pas utiliser.** Les tarifs actuels sont un prix par pays (`STRIPE_PRICE_ID_FR` 89 EUR, `_MX` 1 800 MXN, `_US` 120 USD), et `STRIPE_DEFAULT_PRICE_ID` doit rester vide. Ancienne note : le lien fourni avait été vérifié : **89 USD par mois**, tarif `price_1UQyAhJIzMbFPcEaTIkQelWo`, lien `https://buy.stripe.com/9B68wQ8M9aO42tV6aD08g0q`. Ce tarif est prérempli dans le studio. Le studio crée une page Checkout liée à chaque espace avec ce tarif existant ; aucun nouveau tarif ou abonnement réel n’a été créé pendant l’installation.
2. Ajouter dans les secrets serveur du Site `STRIPE_SECRET_KEY` : privilégier une **clé restreinte** (`rk_…`), avec les permissions nécessaires sur clients, prix, abonnements, factures, Checkout et portail de facturation. Commencer dans un sandbox Stripe séparé avec son propre tarif et espace de test ; utiliser ensuite une clé de production pour les vrais paiements. Ne pas coller cette clé dans une conversation, le code source ou les champs de l’espace client.
3. `STUDIO_URL` est déjà configurée à `https://louvet-content-studio.louvet-partners.chatgpt.site/`. Republier après les changements de secrets pour qu’ils s’appliquent.
4. Activer/configurer le portail client Stripe : mise à jour de la carte et historique/paiement des factures. Une session du portail est créée à la demande ; aucune URL de portail permanente n’est enregistrée dans le navigateur.
5. Dans **Paiements & abonnements**, enregistrer l’identifiant `price_…`, les crédits photo par période payée et le délai. Activer « Exiger un abonnement Stripe… » seulement pour les clients concernés. Cette activation nécessite une connexion Stripe valide. En production, elle est également refusée tant que les notifications signées accessibles à Stripe ne sont pas déclarées prêtes.
6. Pour les abonnements existants, indiquer `cus_…` et `sub_…` après avoir enregistré le tarif. Les identifiants et le forfait sont vérifiés côté serveur. Aucun nouvel abonnement n’est créé par cette liaison.
7. Pour un nouvel abonnement, le client clique « Voir mon forfait et payer ». Le montant et l’autorisation de paiement récurrent sont présentés sur Stripe Checkout avant la confirmation par le client.

Le plugin Stripe dans ChatGPT et la clé serveur du site sont deux connexions distinctes. Installer le plugin ne donne pas automatiquement une clé secrète au site. Une clé publique Stripe n’est pas nécessaire à ce flux hébergé Checkout.

## Site privé et vérification automatique

Le Site reste privé avec son audience existante. Stripe ne peut pas atteindre directement une URL de webhook protégée par la connexion ChatGPT. L’installation n’élargit pas l’audience.

Pour fonctionner dans cette configuration, le serveur interroge Stripe à l’ouverture du studio et **avant chaque nouvelle action payante d’un client**. La page ouverte actualise l’état toutes les 60 secondes, sauf pendant un rendu vidéo. Fermer le studio ne donne aucun accès supplémentaire : la vérification reprend avant de consommer des ressources. En cas d’échec de vérification Stripe, de changement d’environnement test/production ou de forfait incohérent, les nouvelles créations sont refusées ; les contenus existants restent consultables. Une exception agence valide peut temporairement autoriser l’accès, y compris pendant une panne Stripe.

Aucun contrôle continu n’est exécuté lorsque le site est fermé. La suspension est appliquée à la prochaine demande serveur, sans nécessiter qu’un administrateur se connecte. Les relances et nouvelles tentatives de carte se configurent dans Stripe. Aucun email de relance spécifique n’est envoyé par le studio dans cette version.

## Notifications Stripe obligatoires avant activation réelle

Le code expose `/api/studio/stripe-webhook`. Configurer une adresse de réception accessible à Stripe, avec un relais autorisé vers cet endpoint privé, ou décider explicitement d’une audience compatible. La vérification à chaque action complète les notifications ; elle ne les remplace pas pour l’activation en production. Une signature valide ne contourne pas la protection d’accès Sites : ne pas déclarer ce webhook opérationnel tant que cette partie n’est pas résolue.

Ajouter `STRIPE_WEBHOOK_SECRET` comme secret, tester la réception signée de bout en bout, puis définir `STRIPE_WEBHOOK_INGRESS_READY=true`. Ce drapeau seul ne crée aucun relais. L’installation laisse ces réglages non configurés. Enregistrer l’adresse réelle accessible avec les événements :
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.payment_action_required`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`

L’endpoint vérifie la signature HMAC du corps brut, une tolérance de cinq minutes et l’environnement Stripe. Les identifiants d’événements sont dédupliqués et les données actuelles de l’abonnement sont relues via l’API : un ancien événement « payé » ne réactive pas un abonnement actuellement impayé. Une redirection de succès après Checkout ne constitue jamais une preuve de paiement.

## Taxes du lien fourni

Le lien d’origine utilise Stripe Tax, mais la vérification du compte n’a trouvé **aucune immatriculation fiscale active**. Aucun réglage fiscal Stripe n’a été modifié. Vérifier avec votre comptable les obligations et les immatriculations adaptées ; une fois les immatriculations actives vérifiées, définir `STRIPE_TAX_REGISTRATIONS_VERIFIED=true`. Pour le tarif issu du lien, l’activation réelle et Checkout sont bloqués avant cette vérification ; ensuite Checkout reprend `automatic_tax[enabled]=true`. Le prix affiché dans le studio est le montant de base du tarif, les taxes éventuelles sont présentées par Stripe.

## Périmètre et protections

- Version d’API épinglée : `2026-08-26.dahlia` ; appels HTTP côté serveur, aucune donnée carte stockée.
- Prix mensuel unique par abonnement, quantité 1 ; les forfaits annuels, tarifs à l’usage et abonnements multi-produits ne sont pas acceptés.
- Le renouvellement des crédits se base sur une facture mensuelle de création/renouvellement payée, avec une ligne du bon tarif et de la période actuelle. Les proratas ne remettent pas le quota à zéro. Des appels simultanés ne peuvent pas appliquer deux renouvellements ; les échecs de tâches d’une ancienne période ne remboursent pas de crédits dans la nouvelle.
- L’exception temporaire ne constitue pas une confirmation de paiement dans Stripe. Pour un virement, enregistrer/rapprocher aussi le paiement dans l’outil de facturation approprié.
- Aucun seuil de 15 vidéos par mois n’est ajouté par cette intégration : elle contrôle l’accès aux montages et le renouvellement du forfait de crédits photo existant.
- La facture Stripe ne constitue pas une intégration de facturation fiscale mexicaine CFDI dans cette version.
- Les modifications du prix d’un abonnement déjà lié et la migration d’un client test vers la production nécessitent une intervention explicite. Utiliser un espace de test distinct pour éviter de confondre les environnements.

## Tests

`node tests/billing.mjs` utilise exclusivement une API Stripe simulée : première facture impayée, Checkout/portail, paiement confirmé, échéance dépassée, délai et expiration, panne Stripe, exception temporaire, réactivation, résiliation, signatures invalides/expirées, événements répétés ou en retard, liaison entre clients, test/production, préparation agence et renouvellement de crédits.

Avant les premiers vrais clients, effectuer aussi une recette de bout en bout avec un espace et un tarif Stripe de test : paiement réussi, carte refusée, consultation du portail, régularisation et confirmation des droits côté studio. Ne pas utiliser de carte réelle en mode test. Le test réel du fournisseur reste à faire tant que la clé serveur, le tarif de sandbox et la réception des notifications ne sont pas configurés. La recette visuelle n’a pas été exécutée dans un navigateur.

Références :
- https://docs.stripe.com/billing/subscriptions/webhooks
- https://docs.stripe.com/api/checkout/sessions/create
- https://docs.stripe.com/customer-management
- https://docs.stripe.com/webhooks
