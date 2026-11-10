# Mise en ligne · 10 novembre 2026 (v18)

## Où tout se trouve
| Quoi | Où |
| --- | --- |
| Site en ligne | https://studio.louvetpartners.com (adresse Vercel : https://louvet-content-studio.vercel.app) |
| Code | GitHub, dépôt privé `LivingwithJulielouvt/louvet-content-studio` (branche `main`) |
| Hébergement | Vercel, équipe « Louvet Content Studio », projet `louvet-content-studio` |
| Base de données, connexion, fichiers | Supabase, projet `onnksfrbnnzjulkkgwam` (organisation louvet-content-studio) |
| Domaine | Wix › Domaines › louvetpartners.com › enregistrement CNAME `studio` → valeur donnée par Vercel |
| E-mails des codes de connexion | Brevo, configuré dans Supabase › Authentication › Emails › SMTP |

Chaque envoi sur la branche `main` de GitHub remet le site à jour automatiquement sur Vercel (environ 1 minute).

## Ce qui a changé par rapport à la v17
1. **Connexion à la base** : le certificat public de Supabase est inclus (`lib/supabase-ca.mjs`). Sans lui, le studio affichait « Une erreur serveur ».
2. **Options par espace** (agence › client › *Marque & accès* › « Options ouvertes à cet espace ») : montage vidéo, opportunités, versions à tester, collaborations, Reels avec Julie, recréer un post, importer mon site. Réglables à tout moment ; contrôlées aussi côté serveur.
3. **Montage vidéo fermé par défaut** : ouvert seulement aux espaces choisis.
4. **Créer une invitation bêta** (agence › *Bêta & avis*) : nom, type (marque / créatrice, définitif), langue, options dès le départ → code `BETA-…` affiché une seule fois, valable 60 jours, 20 images.
5. Test automatique ajouté : `tests/client-access.mjs` (toute la suite `npm run test:source` passe).

## Variables Vercel (noms seulement — les valeurs sont dans votre fiche des clés)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (Transaction pooler, port 6543), `DATABASE_SSL=true`, `SUPABASE_STORAGE_BUCKET` / `NEXT_PUBLIC_STUDIO_BUCKET` = `studio-private`, `AGENCY_OWNER_EMAIL`, `STUDIO_URL`, `CRON_SECRET`, `EMAIL_UNSUBSCRIBE_SECRET`, et les verrous de la bêta (`BETA_MODE=true`, `AI_GENERATION_ENABLED=false`, `EMAIL_DELIVERY_ENABLED=false`, etc. — voir `COMPTES-ET-CLES.md`).

## Supabase › Authentication › URL Configuration
- Site URL : `https://studio.louvetpartners.com`
- Redirect URLs : `https://studio.louvetpartners.com/**` et `https://louvet-content-studio.vercel.app/**`

## Reste à faire
- Wix : mettre à jour le moyen de paiement avant le **29 novembre 2026** (renouvellement de louvetpartners.com).
- OpenAI : créditer le compte API, créer la clé, puis dans Vercel `OPENAI_API_KEY`, `AI_GENERATION_ENABLED=true` et redéployer.
- Stripe (plus tard) : vérifier le prix US (le code dit 120 USD, la fiche des clés disait 129 USD).
