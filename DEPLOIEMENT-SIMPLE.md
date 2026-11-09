# Déployer Louvet Content Studio · instructions simples

**Le but est de préparer puis montrer avant de publier.** Les étapes de création sont manuelles ; le ZIP ne contacte aucun service.

## 1. Ce qu'il faut avoir

| Service | Compte requis ? | Ce qu'il faut créer ou retrouver |
| --- | --- | --- |
| GitHub | Oui, conseillé pour Vercel | Compte + dépôt privé `louvet-content-studio` (ne pas y mettre `.env.local`) |
| Vercel | Oui | Compte + projet Next.js lié au dépôt, à créer uniquement lors de l'approbation |
| Supabase | Oui | Projet, Auth e-mail, PostgreSQL, bucket privé `studio-private` |
| Brevo | Oui | Expéditeur/domaine vérifié, identifiants SMTP, clé API transactionnelle, liste `Membres studio` |
| Stripe | Oui | Compte, produit « Louvet Content Studio », 3 prix récurrents mensuels (89 EUR, 1 800 MXN, 120 USD), endpoint webhook de test puis live |
| OpenAI Platform | Oui | Projet API, facturation et clé API secrète distincte de ChatGPT |
| Fournisseur de domaine | Compte existant | Accès DNS de `louvetpartners.com` pour ajouter `studio` quand approuvé |

## 2. Définir Supabase (sans contacter les clients)

1. Sur https://supabase.com, créer un projet, noter **Project URL**, **Publishable key** (ou `anon`) et **Service role key**. Cette dernière doit rester privée.
2. Dans **SQL Editor**, coller et exécuter le fichier `supabase/00-schema.sql` (35 tables métier + table de transferts). Ce code ne contient pas de données réelles.
3. Toujours dans **SQL Editor**, exécuter ensuite `supabase/02-nouvelles-fonctions.sql` (banque de plans vidéo, livraison du 3, parrainage, demandes d’offre, publication Instagram). Il peut être relancé sans risque. Exécuter enfin `supabase/03-protections.sql` (protections après suppression d’un espace ; peut être relancé).
4. Optionnel : exécuter `supabase/01-beta-fixtures-OPTIONNEL.sql` pour retrouver les **cinq espaces fictifs**. Les codes d'invitation en clair ne sont pas fournis et devront être régénérés.
5. Dans **Storage**, créer `studio-private`, cocher **Private**, et autoriser une taille par fichier de **50 Mo**. Ne pas activer les accès publics.
6. Dans **Database > Connect**, copier la chaîne **Connection pooling** (`postgresql://...`), avec son mot de passe. La stocker uniquement dans `DATABASE_URL`.
7. Dans **Authentication > Providers > Email**, activer l'e-mail OTP. Dans les modèles **Magic Link/OTP** ET **Confirm signup**, placer `{{ .Token }}` dans le message plutôt que `{{ .ConfirmationURL }}` pour obtenir un code à saisir.
8. Dans **Auth > SMTP**, renseigner **Brevo SMTP** (voir étape suivante). Ces identifiants sont configurés dans Supabase, **pas dans le dépôt GitHub**. Garder SMTP désactivé tant que les tests d'envoi n'ont pas été approuvés.
9. Dans **Auth > URL Configuration**, indiquer plus tard `https://studio.louvetpartners.com` comme Site URL. Pour les tests locaux, inclure `http://localhost:3000` parmi les URLs autorisées.

## 3. Définir Brevo (sans envoyer)

1. Sur https://www.brevo.com, authentifier le domaine expéditeur et configurer SPF/DKIM/DMARC.
2. Créer **un identifiant SMTP** pour les OTP Supabase et noter serveur/port/login/mot de passe SMTP (la configuration exacte est affichée dans Brevo).
3. Créer **une clé API v3** distincte de SMTP pour les e-mails transactionnels du studio.
4. Vérifier une adresse d'expédition, choisir `BREVO_SENDER_EMAIL`.
5. Créer la liste Brevo **Membres studio** et noter son identifiant numérique ; prévoir les attributs `FIRSTNAME`, `STUDIO_LANGUAGE` et `STUDIO_WEEKLY`.
6. Ne pas renseigner `EMAIL_COPY_APPROVED_VERSION` ni mettre `EMAIL_DELIVERY_ENABLED=true` avant d'avoir relu et accepté les textes.

**Important :** les e-mails OTP dépendent de l'activation SMTP dans Supabase. Le drapeau `EMAIL_DELIVERY_ENABLED` contrôle les *autres* e-mails du studio, pas les e-mails d'authentification Supabase.

## 4. Tester Stripe sans facturer

1. Créer un produit et **3 prix récurrents mensuels** (89 EUR, 1 800 MXN, 120 USD), sans tarif à l'utilisation, dans Stripe **Test mode**.
2. Copier leurs ID `price_...` dans `STRIPE_PRICE_ID_FR` / `STRIPE_PRICE_ID_MX` / `STRIPE_PRICE_ID_US` (laisser `STRIPE_DEFAULT_PRICE_ID` vide) et la clé secrète de test `sk_test_...` vers `STRIPE_SECRET_KEY`. Le studio refuse un prix dont le montant ou la devise ne correspond pas au pays.
3. Préparer l'endpoint webhook : `https://studio.louvetpartners.com/api/studio/stripe-webhook` (une URL de test peut être utilisée avant). Le webhook est public mais l'application **vérifie sa signature**.
4. Écouter les événements `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`.
5. Copier son secret `whsec_...` dans `STRIPE_WEBHOOK_SECRET`. Laisser `BETA_MODE=true` et `STRIPE_WEBHOOK_INGRESS_READY=false` pour bloquer la facturation.
6. N'utiliser les clés live que sur validation séparée du parcours test, des taxes et du montant réel.

## 5. Préparer OpenAI

1. Créer ou utiliser un **projet OpenAI API** (https://platform.openai.com), distinct de l'abonnement ChatGPT.
2. Ajouter sa facturation et créer une clé secrète ; la placer dans `OPENAI_API_KEY` **côté serveur**.
3. Vérifier les modèles `IMAGE_MODEL` et `TEXT_MODEL` effectivement accessibles au projet.
4. Garder `AI_GENERATION_ENABLED=false` et `AI_STATUS=billing_required` jusqu'à la recette et ton accord. Aucun visuel n'est généré par la préparation du ZIP.

## 6. Essayer sur un ordinateur

1. Décompresser le ZIP. Ouvrir le dossier `louvet-content-studio/` dans VS Code.
2. Installer **Node.js 22.13+**. Dans ce dossier, lancer `npm install` (nécessite Internet), puis `npm run build`.
3. Copier `.env.example` en `.env.local` ; renseigner **Supabase** et ton adresse dans `AGENCY_OWNER_EMAIL` sans activer les drapeaux d'envoi.
4. Lancer `npm run dev` ; ouvrir `http://localhost:3000`. L'accueil et `/souscrire` sont publics ; `/studio` redirige vers `/connexion`.
5. Pour tester un code OTP réel, **tu dois donner ton accord à un envoi de test** et configurer temporairement SMTP ; vérifier ensuite la vue agence et la séparation entre deux comptes clients.
6. Tester les uploads image/vidéo, les suppressions, l'absence d'envoi Brevo applicatif, et le mode bêta ; puis `npm run build` de nouveau.

## 7. Publication Vercel (ne pas faire sans accord)

1. Créer un **dépôt GitHub privé** et y placer le dossier `louvet-content-studio/`. Ne jamais inclure `.env.local`.
2. Aller sur https://vercel.com > Add New > Project > Import Git Repository. Choisir ce dépôt, Framework **Next.js**, Root Directory : `/` si le dépôt contient le contenu interne, sinon `louvet-content-studio`.
3. Dans Environment Variables, copier les valeurs de `.env.local` **sans jamais publier la clé**. Utiliser des secrets séparés entre Preview/Test et Production/Live.
4. D'abord utiliser un déploiement **Preview** pour montrer les écrans et faire la recette. Les Cron Vercel s'exécutent uniquement en production ; le code refuse de toute façon les envois tant que les drapeaux sont à `false`.
5. Après validation visuelle et fonctionnelle, lier le domaine **`studio.louvetpartners.com`** au projet via Project > Settings > Domains. Suivre **exactement la valeur DNS CNAME/TXT affichée par Vercel** dans le gestionnaire du domaine.
6. Vérifier HTTPS, la connexion, les redirections, le formulaire public, les objets privés, le webhook test Stripe et le rappel *désactivé*.
7. En dernier seulement, autoriser séparément la bascule des e-mails applicatifs, de l'API OpenAI et des paiements live, après validation des coûts et du texte de chaque e-mail.

## 8. Rappel du lundi

`vercel.json` contient `0 15 * * 1` : 15h UTC le lundi correspond à **9h à Monterrey** (UTC−6). Le serveur vérifie aussi explicitement le fuseau `America/Monterrey`, le lundi et la tranche 9–10h avant tout envoi. `CRON_SECRET` (32+ caractères) est transmis automatiquement par Vercel à la route `/api/cron/weekly`. Sans `EMAIL_DELIVERY_ENABLED=true`, `MAIL_WEEKLY_ENABLED=true`, copie validée et chiffre sourcé, aucun rappel n'est envoyé.

## 9. Livraison du 3 (tâche quotidienne)

`vercel.json` contient aussi `/api/cron/daily` à `5 15 * * *` (9 h 05 à Monterrey, chaque jour). Avec `MONTHLY_DELIVERY_ENABLED=true`, elle envoie à partir du 3 les livraisons que tu as validées dans l’onglet **Livraison du 3**. Avec `MONTHLY_DELIVERY_AUTO_PREPARE=true` (et la génération IA activée), elle prépare aussi seule les 6 contenus le 25 du mois. Sinon tu les prépares d’un clic. L’e-mail « Tes 6 contenus du mois sont prêts » suit les mêmes garde-fous Brevo que les autres : la version des textes est maintenant `louvet-2026-10-22-v2`.

## 10. Publication Instagram (quand tu veux l’activer)

1. Sur https://developers.facebook.com, créer une app **Business** et ajouter le produit **Instagram > API setup with Instagram login**.
2. Déclarer l’URL de redirection `https://studio.louvetpartners.com/api/studio/meta-callback`.
3. Copier l’identifiant et la clé secrète de l’app Instagram dans `META_APP_ID` et `META_APP_SECRET` ; générer `META_TOKEN_KEY` avec `openssl rand -base64 32`.
4. Faire la vérification d’entreprise puis la **revue d’app** pour `instagram_business_basic` et `instagram_business_content_publish` (Meta demande une vidéo du parcours : connexion du compte puis bouton « Publier maintenant » dans **Mon calendrier**).
5. Après l’approbation seulement : `META_PUBLISHING_ENABLED=true`. Chaque client connecte son compte Instagram professionnel une fois depuis **Mon calendrier**.

## 11. Si le site original contient des clients réels

Le code ZIP **ne contient pas les données privées**. Exporter séparément la base D1 et les objets R2 *depuis l'ancien hébergement* avant de fermer quoi que ce soit ; comparer identifiants, abonnements, fichiers, droits et permissions avant migration. Ne supprimer l'ancien service qu'après une migration de données réconciliée et un contrôle humain des comptes réels. Les anciennes identités ChatGPT ne sont pas des identifiants Supabase : chaque client devra vérifier son e-mail et être rattaché à son espace via un mécanisme validé par l'agence.
