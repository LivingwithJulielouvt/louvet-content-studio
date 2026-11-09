# Louvet Content Studio · migration de la source originale sur Vercel

**Base : fusion intégrale des cinq ZIP de code source fournis le 16/10/2026.** Les composants et CSS métier existants sont conservés ; la connexion e-mail remplace l'ancienne connexion ChatGPT. Il s'agit d'un projet **à configurer, tester et faire approuver**, pas d'une mise en production effectuée.

## Démarrage rapide

> **Pour ouvrir le studio à des clients payants : suivre `LANCEMENT.md`** (variables, Supabase, Stripe 89 € / 1 800 MXN / 120 USD, factures, comptabilité, juridique, test en 10 étapes). Pages légales (brouillons à faire valider) : `/conditions`, `/confidentialite`, `/mentions-legales`, textes dans `lib/legal-copy.mjs`. Messages client ↔ agence : bouton « Écrire à l’agence » (client) et onglet « Messages » (agence).

1. Lire `DEPLOIEMENT-SIMPLE.md`, `COMPTES-ET-CLES.md` et `SECURITE-ET-LIMITES.md`.
2. Créer un projet Supabase et un bucket **privé** `studio-private` (50 Mo maximum par objet ou plus, selon vidéo).
3. Exécuter `supabase/00-schema.sql` dans le SQL Editor Supabase. Facultatif : `supabase/01-beta-fixtures-OPTIONNEL.sql` pour les cinq espaces fictifs.
4. Copier `.env.example` en `.env.local` et renseigner Supabase et `AGENCY_OWNER_EMAIL`.
5. Sur un ordinateur avec Node 22.13+ et un accès Internet : `npm install` puis `npm run build` et `npm run dev`.
6. Valider hors production les rôles, les invitations, l'upload d'images/vidéos, la suppression, les codes e-mail, les quotas et les webhooks de **test**.
7. Seulement après ton accord : connecter le dépôt GitHub à Vercel, ajouter le DNS et les variables de production.

## Fonctionnalités reprises de l'original

- Accueil FR/EN/ES avec choix de la langue à l’arrivée, prix par pays (89 € · 1 800 MXN · 120 USD, voir `LANGUES-ET-PRIX.md`), FAQ et formulaire `/souscrire` public **sans compte**.
- OTP Supabase par e-mail; un compte ChatGPT n'est plus nécessaire. Brevo SMTP se paramètre dans **Supabase Auth**, pas dans le code.
- Espace agence par identité vérifiée et clients limités à leur espace par autorisation serveur.
- Questionnaire 10 questions, espaces bêta fictifs, 20 essais image bêta, quotas, avis et suppression avec effacement du compte Auth.
- Contenus, calendrier, publications, idées vidéo, moteur FFmpeg/WASM originaux conservés.
- OpenAI API côté serveur et désactivée par défaut (`AI_GENERATION_ENABLED=false`).
- Brevo transactionnel « demande reçue », « bienvenue », rappel lundi 9h Monterrey : **envois désactivés**.
- Stripe Checkout/portail/webhook **non activés** tant que le mode bêta et les indicateurs de sécurité sont en place.
- Les médias passent directement du navigateur au stockage privé Supabase (URLs temporaires) pour éviter la limite de 4,5 Mo des fonctions Vercel.

## Points non automatiquement résolus

- Les cinq archives contiennent **le code**, pas l'export de la base D1 originale ni les fichiers R2 privés ; aucun compte client réel ni média privé de production n'a été migré. Il faut obtenir ces exports séparément si des clients sont déjà présents sur l'ancien site.
- Impossible de garantir le déploiement en conditions réelles sans un projet Supabase, clés de test, accès npm et recette navigateur. L'installation et la compilation complètes n'ont pas pu être exécutées dans l'environnement de préparation, dont l'accès au registre npm est indisponible.
- La police binaire de sous-titres vidéo n’est pas redistribuée ; la restaurer depuis votre ZIP original 03 si vous activez les sous-titres (voir `SECURITE-ET-LIMITES.md`).
- Le formulaire public enregistre une **demande de souscription** et peut mettre l'e-mail « demande reçue » en attente ; il ne prélève pas immédiatement l’abonnement (89 € / 1 800 MXN / 120 USD) sur un visiteur anonyme. Le paiement passe par la création/liaison d'un espace client et l'activation du Checkout d'origine.
- Les archives initiales restent le point de comparaison visuel ; seuls le composant de connexion et les méthodes de transfert des fichiers changent de comportement UI.

Consulter aussi `CHANGEMENTS-MIGRATION.md` pour les fichiers adaptés et `supabase/` pour les tables.
