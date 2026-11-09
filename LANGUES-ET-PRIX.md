# Langues (FR · EN · ES) et prix par pays — 23 octobre 2026

## Ce que voient les clients

1. **Langue** : le site s'ouvre dans la langue du navigateur, avec un bandeau « Ce site est aussi disponible en… » (voir `ACCUEIL-ET-PARCOURS.md`). Le choix est mémorisé sur l'appareil et repris sur le formulaire, la connexion et le studio.
2. **Sélecteur FR · EN · ES** en haut de toutes les pages publiques et dans le studio client. L'espace agence reste en français.
3. **Tout le parcours client est traduit** : accueil, formulaire d'inscription, connexion, studio (création de photos, calendrier, idées vidéo, montage, produits, parrainage, abonnement, Instagram), e-mails automatiques et messages d'erreur du serveur.
4. **Un seul prix affiché sur l'accueil**, celui de la langue choisie : 89 € en français, 1 800 MXN en espagnol, 120 USD en anglais. Les prix des autres pays ne sont jamais montrés côte à côte.
5. **Pays de l'activité** dans le formulaire (France, Mexique, États-Unis), sans prix, pré-rempli selon la langue et modifiable. Il apparaît dans « Demandes en attente » avec la langue et le tarif correspondant (visible par l'agence seulement).

## Prix

| Pays | Accès au studio | Offre complète |
| --- | --- | --- |
| France | 89 € / mois | 900 USD / mois |
| Mexique | 1 800 MXN / mois | 900 USD / mois |
| États-Unis | 120 USD / mois | 1 400 USD / mois |

Abonnement annuel facultatif (2 mois offerts) : **890 € / an** (France), **18 000 MXN / an** (Mexique), **1 200 USD / an** (États-Unis). Proposé seulement quand le prix annuel du pays est créé dans Stripe (`STRIPE_PRICE_ID_FR_YEAR`, `_MX_YEAR`, `_US_YEAR`). L'accueil montre « ou 890 €/an (2 mois offerts) » dans la seule devise de la langue.

- Tous les montants sont dans **`lib/pricing.mjs`** : c'est le seul fichier à modifier pour changer un prix affiché.
- L'offre complète affichée dans « Mon abonnement » dépend du **pays du client** (réglage « Pays » de sa fiche dans l'espace agence) et s'affiche dans sa langue.
- Le budget publicitaire inclus reste à 150 USD dans les trois pays.

## À faire une fois avant d'encaisser

1. Dans Stripe, créer **trois prix mensuels** : 89 EUR, 1 800 MXN, 120 USD.
2. Coller leurs identifiants dans Vercel : `STRIPE_PRICE_ID_FR`, `STRIPE_PRICE_ID_MX`, `STRIPE_PRICE_ID_US` (voir `.env.example`). Ne plus utiliser `STRIPE_DEFAULT_PRICE_ID` (laisser vide). Le studio vérifie que chaque prix correspond au montant et à la devise du pays.
3. **Le prix facturé dépend du pays que tu règles dans la fiche du client**, jamais de ce que le client a coché. À la validation d'une demande, vérifie le pays (adresse, site, réseaux) : un client américain qui aurait coché « Mexique » doit être réglé sur « États-Unis ». Dans la fiche, le tarif Stripe proposé par défaut est celui du pays. Le panneau « Paiements & abonnements » indique quels tarifs sont configurés.
4. **E-mails** : les textes existent désormais en anglais, donc la version des textes a changé (`louvet-2026-10-26-v5`). Relire les aperçus (onglet « E-mails & rappels », bouton English) puis mettre `EMAIL_COPY_APPROVED_VERSION=louvet-2026-10-26-v5` pour réautoriser les envois.

## Limites connues

- Le « chiffre de la semaine » du rappel du lundi n'existe qu'en français et en espagnol : dans l'e-mail anglais, cette ligne est omise.
- Les notifications enregistrées par le serveur (cloche) et quelques messages construits dynamiquement restent en français.
- Les erreurs serveur sont traduites selon la langue choisie sur l'appareil ; un client qui n'a jamais choisi de langue les reçoit en français.
- Le contenu généré (légendes, idées vidéo) suit la langue réglée par l'agence dans la fiche client, pas la langue de l'interface : pensez à régler la langue du client sur « Anglais » pour un client américain.

## Fichiers principaux

- `lib/i18n.tsx` (langue de l'interface, sélecteur), `lib/pricing.mjs` (prix), `lib/server-messages.mjs` (271 messages d'erreur traduits)
- `lib/public-site-copy.mjs` (textes de l'accueil en 3 langues), `lib/studio-email-templates.mjs` (e-mails)
- Écrans : `app/public-site.tsx`, `app/login-panel.tsx`, `app/studio-ui.tsx`, `app/video-studio.tsx`, `app/publication-calendar.tsx`, `app/billing-panel.tsx`, `app/extensions.tsx`, etc.

Vérifié : `npm run build` OK, tous les fichiers de tests verts (`npm run test:source`), parcours testé dans un navigateur (accueil, formulaire, connexion, studio d'un client américain, mexicain et français, espace agence).
