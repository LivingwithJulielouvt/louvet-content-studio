# Journal des changements par rapport aux cinq ZIP d'origine

| Partie | Ancien système | Version préparée pour Vercel |
| --- | --- | --- |
| Hébergement | Cloudflare Sites / Vinext | Next.js 16 sur Vercel, sans dépendance Cloudflare au runtime métier |
| Interface métier | Pages et composants React originaux | Mêmes composants/styles, navigation conservée |
| Connexion | Compte ChatGPT lié à Sites | OTP e-mail Supabase (`/connexion`), rôle agence/client contrôlé par serveur |
| Accès public | Landing et formulaire dépendant du contexte | `/` et `/souscrire` publics ; protection de `/studio` et API métier |
| Base SQL | Cloudflare D1 (SQLite) | Tables PostgreSQL Supabase (`supabase/00-schema.sql`), couche de compatibilité `lib/vercel-db.mjs` |
| Médias | R2 + formulaires multi-part | Bucket privé Supabase, envoi direct signé après contrôle API, lecture par lien signé |
| E-mails OTP | Dépendance à ChatGPT | Supabase Auth + SMTP Brevo configuré manuellement dans Supabase |
| E-mails métier | Système Brevo déjà dans la source | Préservé, neutralisé par drapeaux `EMAIL_*` et validation de la copie |
| Rappel hebdo | Action métier hebdomadaire existante | Vercel Cron `0 15 * * 1`, garde `CRON_SECRET`, vérification fuseau Monterrey |
| Génération IA | API OpenAI via serveur | Même moteur métier + nouvelle garde `AI_GENERATION_ENABLED=false` |
| Stripe | Code Checkout/portail/webhook source | URL publique Vercel `/api/studio/stripe-webhook`, validation HMAC et mode bêta actif |
| Suppression | Purge clients + D1/R2 | Purge Supabase Storage, DB et identité Auth ; conservée à tester |
| Bêta/avis/quotas | Fonctionnalités originales | Logique métier conservée, invitations attachées à l’identité Supabase |

**Conserver un exemplaire des cinq archives originales pour comparaison et éventuelle réimportation de la police du moteur vidéo.**

Des composants d’intégration Cloudflare et des documentations d’origine sont conservés dans `build/`, `scripts/` ou `docs/` à titre d’archive ; ils ne constituent pas le chemin d’exécution Next/Vercel.

La partie payante demeure un flux de **demande de souscription publique → revue de l’agence → compte client OTP → Checkout Stripe**, et non un paiement anonyme immédiat. Aucun montant n’est débité lors d’une demande de souscription.
