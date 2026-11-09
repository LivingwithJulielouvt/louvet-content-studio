# Nouveautés et corrections — 22 octobre 2026

## À faire une fois dans Supabase

Exécuter `supabase/02-nouvelles-fonctions.sql` dans le SQL Editor, après `00-schema.sql`. Le script peut être relancé sans risque.

## Corrections indispensables (le projet ne compilait pas)

| Problème | Correction |
| --- | --- |
| `npm run build` échouait : le moteur vidéo `/media-engine/index.js` était introuvable par Next.js | Import dynamique ignoré par le bundler (`lib/browser-render.ts`) |
| Erreurs TypeScript dans `proxy.ts`, `lib/supabase/server.ts`, la route API | Types ajoutés |
| Police des sous-titres vidéo manquante | `public/media-engine/DejaVuSans.ttf` restaurée (licence libre DejaVu) |
| **Base Postgres : deux demandes simultanées pouvaient dépasser le quota de crédits, la limite bêta ou attribuer deux fois des points** | Les écritures passent désormais en série, comme dans l’ancienne base D1 (`lib/vercel-db.mjs`) |
| Les totaux de points arrivaient en texte (« 25 ») depuis Postgres | Lecture numérique (`lib/vercel-db.mjs`) |
| Tests automatiques écrits pour l’ancienne connexion ChatGPT | Adaptés à la connexion Supabase et au transfert direct des fichiers |

Le code a aussi été remis en forme lisible (Prettier) pour pouvoir être modifié facilement ensuite.

## Nouvelles fonctionnalités

1. **Cloisonnement vérifié** : un nouveau test (`tests/isolation.mjs`) rejoue les 55 actions de l’API avec les identifiants d’un autre client. Aucune fuite.
2. **Photos produit (1 à 5)** : enregistrées une fois par produit, présélectionnées automatiquement à chaque création, retirables. Au-delà de 5, le studio demande d’en retirer une.
3. **Banque de plans vidéo** : un plan filmé pour une idée (ex. « bougie allumée près de la fenêtre ») est reconnu dans toutes les autres idées qui le demandent. Quand tous les plans d’une idée sont là, le montage est créé automatiquement et se lance dès que l’onglet « Mes vidéos » est ouvert.
4. **Livraison du 3** (onglet agence) : le studio prépare 6 visuels + textes à partir des photos produit (offerts, aucun crédit client), tu choisis les 6, tu valides ; le client les reçoit le 3 à 9 h (Monterrey) avec un e-mail si les envois sont activés. Avant, il ne voit rien.
5. **Publication Instagram** (onglet « Mon calendrier ») : connexion du compte Instagram professionnel du client puis bouton « Publier maintenant ». Désactivée tant que Meta n’a pas approuvé l’app (`META_PUBLISHING_ENABLED=false`).
6. **Parrainage** : chaque client a un code et un lien ; 10 € / 200 MXN / 10 USD (selon le pays, dans la devise de l’abonnement) sont déduits automatiquement de sa prochaine facture Stripe quand une marque parrainée paie son premier mois. Champ « Code de parrainage » ajouté au formulaire public (pré-rempli par le lien).
7. **Offre complète sur la page abonnement** : reprise de ta présentation (900 USD en France et au Mexique, 1 400 USD aux États-Unis, dont 150 USD de publicité), en français ou en espagnol selon la langue du client, avec un bouton « Je veux en savoir plus » qui envoie la demande dans « Demandes en attente ».

8. **Images en qualité haute** par défaut (avant : basse). Réglable avec `IMAGE_QUALITY` (`low`, `medium`, `high`).

## Vérifications faites

- `npm run build` : OK.
- Tous les fichiers de tests de `npm run test:source` passent avec SQLite et sur une **vraie base PostgreSQL 16** (`npm run test:postgres`, qui lance chaque test et affiche le bilan) en appliquant les scripts Supabase 00 + 02 + 03.
- Formulaire public : la vérification « une demande envoyée avec l’e-mail de quelqu’un d’autre n’ouvre aucun espace » tourne dans sa propre base de test. Les tests transmettent aussi l’adresse IP du visiteur comme le fait Vercel (`x-forwarded-for`), ce qui permet de vérifier les limites anti-abus.
- Parcours complet dans un navigateur (agence + cliente) contre Postgres, avec Supabase simulé : connexion, envoi de photos, livraison, parrainage, offre, Instagram (désactivé).
