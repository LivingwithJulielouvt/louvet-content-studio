# Comptes et clés — liste à compléter par la propriétaire

**Tous les champs secrets restent vides dans le livrable.** Renseigner uniquement dans les variables d’environnement privées Vercel ou `.env.local` sur votre machine (ce dernier est exclu par `.gitignore`). Ne jamais coller une clé secrète dans un chat, un fichier public ou un commit GitHub.

## Comptes à créer ou à réutiliser

1. **GitHub** : dépôt **privé** pour le code (conseillé pour importer sur Vercel).
2. **Vercel** : projet Next.js + sous-domaine `studio.louvetpartners.com` après accord.
3. **Supabase** : un projet PostgreSQL, Supabase Auth e-mail, bucket de stockage **privé** `studio-private`.
4. **Brevo** : domaine/expéditeur vérifiés, identifiants SMTP pour OTP, clé API v3 pour le mail transactionnel, liste nommée `Membres studio`.
5. **Stripe** : compte, produit, 3 prix récurrents mensuels (89 EUR, 1 800 MXN, 120 USD) en **test** puis, après accord, en live, endpoint webhook dédié.
6. **OpenAI Platform** : projet API avec facturation et clé secrète personnelle au studio (ce n’est pas l’abonnement ChatGPT).
7. **Registrar/DNS** : accès à la zone DNS de `louvetpartners.com`.
8. **Meta for Developers** (pour la publication Instagram, plus tard) : une app de type « Business » avec le produit *Instagram API with Instagram Login*, la vérification d’entreprise et la revue d’app (permissions `instagram_business_basic` et `instagram_business_content_publish`). URL de redirection à déclarer : `https://studio.louvetpartners.com/api/studio/meta-callback`.

## Variables Vercel par fournisseur

| Nom exact | Où l'obtenir | Secret ? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > API | Non |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase > API Keys, clé publishable ou anon | Non |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > API Keys > service role | **Oui, jamais dans le navigateur** |
| `DATABASE_URL` | Supabase > Database > Connect > Session pooler | **Oui** |
| `SUPABASE_STORAGE_BUCKET` | Nom du bucket privé, `studio-private` | Non |
| `NEXT_PUBLIC_STUDIO_BUCKET` | Même nom, `studio-private` | Non |
| `AGENCY_OWNER_EMAIL` | Votre adresse autorisée (vérifiée dans Supabase) | Non |
| `AGENCY_OWNER_UID` | Supabase Auth > Users > UID propriétaire (facultatif, plus strict) | Non |
| `STUDIO_URL` | `https://studio.louvetpartners.com` après validation du domaine | Non |
| `OPENAI_API_KEY` | OpenAI Platform > API keys | **Oui** |
| `TEXT_MODEL`, `IMAGE_MODEL` | Modèles autorisés sur votre projet API | Non |
| `BREVO_API_KEY` | Brevo > SMTP & API > API Keys | **Oui** |
| `BREVO_SENDER_EMAIL` | Adresse/domaine expéditeur approuvé | Non |
| `BREVO_STUDIO_LIST_ID` | ID numérique de la liste `Membres studio` | Non |
| `EMAIL_UNSUBSCRIBE_SECRET` | Secret aléatoire de 32+ caractères à créer | **Oui** |
| `CRON_SECRET` | Secret aléatoire de 32+ caractères à créer et ajouter à Vercel | **Oui** |
| `STRIPE_SECRET_KEY` | Stripe Developers > API keys (`sk_test_...` d’abord) | **Oui** |
| `STRIPE_WEBHOOK_SECRET` | Stripe Developers > Webhooks > Signing secret `whsec_...` | **Oui** |
| `STRIPE_PRICE_ID_FR` / `_MX` / `_US` | Stripe Products > les 3 prix mensuels (`price_...`) : 89 EUR, 1 800 MXN, 120 USD | Oui |
| `STRIPE_DEFAULT_PRICE_ID` | Ancien réglage : laisser vide | Non |
| `MONTHLY_DELIVERY_ENABLED` | `true` pour envoyer automatiquement le 3 les livraisons validées | Non |
| `MONTHLY_DELIVERY_AUTO_PREPARE` | `true` pour préparer seul les 6 contenus le 25 (facultatif) | Non |
| `META_APP_ID`, `META_APP_SECRET` | Meta App Dashboard > Instagram > API setup with Instagram login | **Oui pour le secret** |
| `META_TOKEN_KEY` | À générer : `openssl rand -base64 32` (chiffre les jetons Instagram) | **Oui** |
| `META_PUBLISHING_ENABLED` | `true` seulement après l’approbation de l’app par Meta | Non |

## Variables de verrouillage : conserver ces valeurs jusqu'à validation

```dotenv
BETA_MODE=true
AI_GENERATION_ENABLED=false
EMAIL_DELIVERY_ENABLED=false
MAIL_WEEKLY_ENABLED=false
EMAIL_COPY_APPROVED_VERSION=
EMAIL_UNSUBSCRIBE_PUBLIC_READY=false
STRIPE_WEBHOOK_INGRESS_READY=false
OWNER_PRIVATE_SERVICE=false
MONTHLY_DELIVERY_ENABLED=false
MONTHLY_DELIVERY_AUTO_PREPARE=false
META_PUBLISHING_ENABLED=false
AI_STATUS=billing_required
```

`EMAIL_COPY_APPROVED_VERSION` correspond à la constante exportée par `lib/studio-email-templates.mjs` ; ne la renseigner qu'après revue et approbation du contenu.

## Valeurs à configurer dans Supabase, pas dans GitHub

- **Brevo SMTP** : hôte/port, identifiant SMTP et mot de passe SMTP dans Supabase Authentication > SMTP Settings, une fois les envois de test autorisés.
- **Supabase Auth** : modèle de courriel « Magic Link/OTP » qui affiche `{{ .Token }}` ; idem pour confirmation d'inscription afin de garantir l'usage du code plutôt que du lien magique. Site URL et redirect URLs configurés correctement.
- **Supabase Storage** : bucket `studio-private` marqué Private, taille maximale de fichier de 50 Mo au minimum. Ne jamais écrire de policy publique sur les fichiers des clients.

Se référer à `.env.example` pour toutes les autres variables, notamment les réglages Stripe et les garde-fous Brevo.
