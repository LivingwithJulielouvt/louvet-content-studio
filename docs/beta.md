# Bêta sur invitation — octobre 2026

Le site reste propriétaire-privé lors de cette publication. Julie décidera de le passer en Public dans Sites après vérification. La publication ne change pas cette audience.

## Accès

- `AGENCY_OWNER_ID` doit être l’identifiant Sites déjà enregistré du propriétaire. Aucune promotion du premier visiteur ; seul cet identifiant peut posséder les droits agence. Le compte propriétaire utilise sa connexion ChatGPT existante (actuellement `louvet.partners@gmail.com`), avec ses protections habituelles. Le studio n’enregistre aucun mot de passe et ne crée pas de second écran de mot de passe.
- Les testeurs utilisent chacun leur propre connexion ChatGPT. L’adresse e-mail est fournie par l’identité Sites, pas par un champ libre accepté comme preuve d’identité.
- En mode bêta, l’inscription libre est bloquée. Le testeur entre une invitation de 128 bits, à usage unique, valable jusqu’au 15 décembre 2026 à 23:59:59 UTC. Une transaction la lie à un unique compte et espace ; seul son condensat SHA-256 est stocké. Cinq échecs par compte en dix minutes déclenchent une pause. L’invitation n’est pas placée dans une URL.
- Envoyer chaque code séparément, uniquement à son destinataire. Une invitation ne permet pas de choisir l’identité de son premier utilisateur : c’est le premier compte connecté qui la saisit qui la réserve. Les codes ne sont ni dans le dépôt ni dans le bundle ; la liste de remise séparée est réservée à Julie.
- Chaque requête, fichier, génération, calendrier et montage reste soumis aux contrôles d’appartenance côté serveur. Un rôle ou `client_id` envoyé par le navigateur ne donne aucun droit supplémentaire.
- Les espaces clients antérieurs sont conservés. En mode bêta, leurs comptes ne peuvent pas les ouvrir, et le sélecteur agence présente uniquement les cinq espaces fictifs. L’agence reste seule autorisée à administrer les données existantes.

## Cinq espaces fictifs

La migration `0008_smooth_bloodaxe.sql` crée les tables bêta et cinq espaces neufs : Maison Aube, Atelier Sol, Jardin Luna, Café Nuage et Nora Studio. Ils contiennent une identité/couleurs, un produit ou sujet, une recette d’une image, dix réponses fictives déjà étudiées, trois publications d’exemple et des points fictifs. Aucune donnée ou photo d’un vrai client n’est copiée. Les idées vidéo sont calculées par les règles existantes à l’ouverture, sans appel IA. Ajouter une référence photo avant de générer.

## Budget et paiements

- `BETA_MODE=true` active les protections et le bandeau « Version bêta » sur toutes les pages applicatives, y compris accueil, questionnaire et invitation.
- Les routes de paiement Checkout, portail, réglage/liaison et synchronisation sont bloquées, y compris pour l’agence. Aucun appel Stripe n’est exécuté dans la bêta et aucun lien de paiement n’est affiché. Le webhook ne traite pas d’événement pendant cette phase. Aucun abonnement existant dans Stripe n’est résilié ou modifié.
- Chaque espace est limité à **20 tentatives d’image pour toute la bêta**. Ce plafond indépendant des crédits est réservé dans la transaction de création. Il inclut variantes, corrections et reprises, y compris celles lancées par l’agence. Un échec ne restitue pas ce plafond afin de borner les appels facturables ; les crédits ordinaires conservent leur fonctionnement. Les rechargements, doublons, renouvellements et changements de crédits ne réinitialisent pas ce compteur. Les textes accompagnant chaque création ne consomment pas une tentative d’image supplémentaire. Les reprises isolées de textes en échec par les testeurs sont refusées pendant la bêta : elles sont réservées à l’agence pour éviter des appels facturables sans limite.
- `OWNER_PRIVATE_SERVICE=false` désactive l’ancien point d’entretien réservé à l’hébergement privé. Il est aussi systématiquement refusé en mode bêta. Ne jamais réactiver un traitement anonyme reposant seulement sur la confidentialité de l’hébergement lorsque le Site est Public.
- La clé OpenAI serveur déjà configurée est conservée. Aucun appel réel payant n’est nécessaire à l’installation. Les clés Stripe éventuelles restent inaccessibles au navigateur.

## État du moteur d’images à la livraison

Le dernier contrôle enregistré dans `studio_settings.api_status` (14 octobre 2026) indique `billing_required`. Ce statut est conservé : aucun contrôle réel payant n’a été exécuté pendant la préparation de la bêta. La génération reste bloquée tant que la connexion n’a pas été vérifiée avec succès. Dans la vue agence, le bouton **Vérifier après activation** relance un court appel au moteur configuré et met à jour le statut en cas de succès. Si nécessaire, activer préalablement la facturation du compte API OpenAI. Le ChatGPT Plus de l’utilisatrice ne remplace pas la facturation de ce moteur.

## Retours

« Donner mon avis » est disponible via le composant racine sur chaque écran. L’envoi exige un compte relié, est protégé contre les requêtes d’origine étrangère et limité à cinq retours en dix minutes. Un identifiant évite les doubles envois. Le serveur fixe lui-même l’auteur et l’espace. Les retours ne sont consultables que dans **Bêta & avis** côté agence. Cette vue indique aussi les invitations utilisées et la consommation de chaque espace.

## Vérifications

- `node tests/beta.mjs` : propriétaire, anonymes, invitations concurrentes, isolation, refus des vrais clients dans la bêta, suppression de toute possibilité de paiement, plafond exact sous concurrence/reprise/correction/échec, feedback privé et dédoublonné, ancien entretien privé inaccessible.
- Suites existantes : sécurité, quotas, questionnaire, calendrier/récompenses, personnalisation, créatrices, idées éditoriales, qualité et montage.
- TypeScript et build de production.
- Les tests de bêta utilisent une API simulée et ne consomment pas les cinq invitations de production. Ils n’effectuent aucun débit OpenAI ou Stripe. La recette navigateur et un paiement ne sont pas exécutés.

Après passage volontaire en Public, vérifier un premier accès avec un vrai compte de test, un upload puis une création si souhaité ; cela consommera le quota et l’API réelle. Ne pas réutiliser le compte agence pour réclamer une invitation de testeur.

Pour terminer la bêta, gérer explicitement les comptes invités et l’audience avant de retirer `BETA_MODE`. Les cinq compteurs de test restent persistants ; les paiements réels nécessitent toujours la configuration et les contrôles décrits dans `stripe-billing.md`.
