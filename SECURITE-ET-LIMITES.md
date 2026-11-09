# Sécurité, état de validation et limites de la migration

## État exact de ce livrable

- **Ce dépôt est une adaptation de la source originale fusionnée des cinq ZIP**, pas le starter Next.js reconstruit. Les CSS originaux et les écrans métier ont été préservés ; les seules modifications visibles concernent la connexion, les textes devenus inexacts, et le transport des médias.
- **Aucun service n’a été provisionné, aucun DNS changé, aucun site mis en ligne, aucune génération facturable ni aucun envoi réalisé.** Les nouvelles variables d’environnement sont des exemples vides.
- **Pas de preuve de compilation ni de tests d’intégration complets.** Les dépendances npm ne pouvaient pas être téléchargées dans l’environnement de préparation. Les sources JavaScript/TypeScript ont été vérifiées syntaxiquement, mais `npm install`, `npm run build`, `npm run test:source` et les essais avec Supabase/Brevo/Stripe/OpenAI demeurent à effectuer par un humain.

## Séparation des accès

- L’accueil `/` et la demande `/souscrire` restent accessibles sans session. Le formulaire accepte l’adresse libre d’un prospect et n’ouvre aucun compte studio automatiquement.
- `/connexion` permet de vérifier un compte Supabase Auth via un OTP e-mail. Une invitation ou une autorisation agence lie ensuite le compte vérifié à un espace ; un compte Supabase sans espace n’accède à aucune donnée de client.
- Les vues studio et API métier exigent une session ; la logique serveur vérifie le rôle et l’espace client pour chaque opération. La clé `SUPABASE_SERVICE_ROLE_KEY` et la connexion PostgreSQL ne sont jamais envoyées au navigateur.
- Le stockage est **privé**. Les transferts directs utilisent des jetons signés à durée courte, sans ouvrir le bucket au public. Les téléchargements sont autorisés côté serveur avant création d’un lien temporaire. Ne jamais activer une politique publique sur le bucket.
- La fonction **Supprimer le compte client** désactive l’espace puis purge les médias, le compte Supabase Auth et les lignes métier ; elle conserve un marqueur de suppression. Tester avec des données de démonstration avant tout effacement de données réelles. Le Studio est une application personnelle/collective, pas une solution de conformité juridique certifiée.

## États bloqués par défaut

- `BETA_MODE=true` : pas de facturation Stripe ; les cinq espaces fictifs ne sont présents que si le fichier SQL optionnel est exécuté.
- `AI_GENERATION_ENABLED=false` : l’appel aux modèles OpenAI est refusé, même si une clé est renseignée.
- `EMAIL_DELIVERY_ENABLED=false`, `MAIL_WEEKLY_ENABLED=false` : les e-mails transactionnels et le rappel ne partent pas.
- `EMAIL_COPY_APPROVED_VERSION` vide et `EMAIL_UNSUBSCRIBE_PUBLIC_READY=false` : double verrou avant l’envoi Brevo.
- `STRIPE_WEBHOOK_INGRESS_READY=false`, clés test, absence de configuration Live : aucun paiement réel.
- **Les codes OTP Supabase constituent un circuit séparé.** Ils exigent un SMTP Brevo activé manuellement dans Supabase ; les interrupteurs Brevo du studio n’empêchent pas un OTP si ce SMTP est activé ensuite par l’administrateur.

## Validation obligatoire avant production

1. `npm install`, `npm run build`, puis tests du dépôt.
2. Tests d’authentification : code correct, code faux/expiré, invitation utilisée, rôle agence, rôle client et tentative d’accès croisé.
3. Tests du formulaire sans connexion et des mesures anti-spam, sans envoi automatique.
4. Tests d’upload JPG/PNG/vidéos, téléchargement signé, conservation du rendu, refus d’accès d’un autre client, purge complète ; tester spécialement des fichiers de plus de 4,5 Mo.
5. Vérification de rendu visuel écran par écran contre la version source.
6. Tests Stripe uniquement en mode **test** : idempotence webhook, abonnement, annulation, perte de paiement, taxes, droits des clients.
7. Tests Brevo OTP et e-mails applicatifs uniquement sur adresses expressément approuvées ; journaliser toute incertitude avant relance.
8. Vérification du rappel local lundi 9 h Monterrey dans une Preview isolée, et du timeout fonction Vercel pour un lot réel de membres.
9. Confirmation des montants, consentements, traitement de données, politique de confidentialité, DNS et restauration des données préexistantes.

## Données non présentes dans les cinq archives

Les ZIP ont fourni l’application et les migrations SQLite ; **ils ne comprennent pas l’export de la base Cloudflare D1, ni les objets R2 privés, ni l’export des identités existantes**. La reprise des vrais clients nécessite un export séparé, une correspondance explicite vers les identités Supabase et une recette de cohérence, sans jamais supposer qu’un ancien identifiant ChatGPT est un identifiant Supabase.

## Ressource typographique originale

Une police binaire de sous-titrage existe dans les sources initiales. Elle n’est **pas redistribuée** dans ce ZIP final. Pour retrouver la génération vidéo avec sous-titres strictement identique, recopier vous-même depuis votre archive originale `louvet-studio-03-moteur-video-tests.zip` le fichier `public/media-engine/DejaVuSans.ttf` au même chemin, sur votre copie locale avant compilation. En son absence, les vidéos sans sous-titres fonctionnent normalement en principe ; un rendu demandant des sous-titres signalera qu’il manque la police.
