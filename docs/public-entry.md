# Accueil et accès — organisation préparée, non publiée

## Routes

- `/` reste toujours l’accueil Louvet & Partners FR/ES, y compris pour une personne déjà connectée. Aucun rôle ni espace client n’est chargé depuis cette page.
- « Se connecter » ouvre `/connexion`, puis la connexion hébergée. Le retour est `/studio` : le serveur rend l’agence au propriétaire épinglé et uniquement le client autorisé à chaque membre. Un visiteur non rattaché suit le parcours d’invitation/de demande ; il ne devient jamais administrateur.
- « Souscrire » ouvre la connexion avec le retour `/souscrire`. Le formulaire est désormais protégé, conformément à la nouvelle demande. Une personne déjà connectée y entre directement. La langue FR/ES est conservée.
- `/studio`, `/souscrire` et les autres adresses de pages tentées sans connexion renvoient vers `/connexion`. Les adresses de retour sont limitées à `/studio` et `/souscrire` ; aucun retour externe n’est accepté.
- Les opérations de studio et les fichiers privés continuent de vérifier identité, rôle, espace et état du compte sur le serveur. Les API renvoient 401/403 plutôt qu’une page de connexion HTML. Les ressources de présentation et `/api/studio/public-info` restent publiques.
- Les endpoints techniques Stripe/maintenance/rappel gardent leurs autorisations propres et les paiements restent désactivés en bêta. Le lien personnel signé de désinscription du rappel ne donne accès à aucun espace ni donnée du studio et conserve son fonctionnement indépendant d’une connexion.

## Formulaire et confidentialité

Les nouvelles demandes exigent une identité connectée. La génération du jeton et son utilisation sont liées à cette identité. Le serveur exige l’adresse e-mail de cette identité, et le formulaire l’affiche sans permettre sa modification. Les anciennes demandes anonymes restent des demandes historiques, sans droits d’accès.

Les brouillons locaux sont séparés par adresse connectée ; l’ancien brouillon anonyme commun n’est plus repris. Les demandes restent dans une table distincte des espaces clients, et leur dépôt ne crée ni compte client autorisé ni abonnement payant. L’agence seule lit leurs réponses.

Les garde-fous précédents restent en place : origine/cookie/jeton, consentement, dix réponses obligatoires, limites de taille et de fréquence, anti-doublon et e-mail « Demande reçue » retenu sans accord explicite et configuration Brevo. Aucun envoi réel n’a été réalisé.

## Limite de chatgpt.site

L’accueil pourra devenir anonyme en passant le site en Public après autorisation. Le site en ligne est actuellement privé et inchangé.

L’authentification prise en charge par Sites reste ChatGPT. L’interface de gestion exposée ne permet pas de substituer Supabase, Brevo OTP ou une session autonome à cette identité. Cette modification ne prétend pas offrir une connexion par e-mail sans ChatGPT sur chatgpt.site et ne fabrique pas de nouveaux en-têtes d’identité.

## Solution proposée sans ChatGPT — à valider, non provisionnée

Conserver le code du studio et le déployer hors de chatgpt.site : Cloudflare Workers pour l’application, Supabase Auth pour les sessions et les codes à usage unique, Brevo comme expéditeur SMTP. L’application utilise déjà Workers/D1/R2 ; cette piste conserve l’architecture et l’interface tout en remplaçant l’identité hébergée par une identité indépendante.

Sources officielles consultées :
- https://developers.cloudflare.com/workers/framework-guides/automatic-configuration/
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://developers.brevo.com/docs/supabase-smtp-integration

À préparer avant une migration autorisée : compte Cloudflare et projet Supabase, adresse du studio sur un domaine choisi, expéditeur/domaine Brevo vérifié, clé SMTP Brevo (distincte de la clé API transactionnelle), secrets serveur et adresses de retour autorisées. Supabase vérifie le code ; Brevo transporte l’e-mail. L’authentification ne confère aucun rôle ni espace sans rattachement serveur explicite.

Le travail de migration devra remplacer et vérifier toute la frontière d’identité, ignorer les anciens en-têtes ChatGPT sur l’hébergement indépendant, conserver les contrôles d’isolation, rattacher explicitement les identités aux membres existants et transférer les données/fichiers après vérification. Les ressources actuelles sont gérées par Sites : leur réutilisation ou export doit être validé avant bascule. Aucun transfert, changement DNS, provisioning ou contrat payant n’a été effectué.

## Aperçu et tests

L’aperçu montre l’accueil approuvé et le parcours de connexion e-mail proposé après migration. Son envoi et sa validation de code sont simulés ; il ne communique avec aucun service. Il ne s’agit pas d’une connexion fonctionnelle sur chatgpt.site.

Tests locaux : accueil identique avec/sans session ; redirections des pages protégées ; rejet des retours externes ; retour agence/client propre au rôle ; rejet d’un autre espace client ; rejet anonyme des API privées ; formulaire et jeton liés à l’identité ; adresse de réception vérifiée ; e-mails toujours désactivés par défaut. La compilation de production complète la vérification. L’identité hébergée est simulée dans les tests, aucun compte réel n’est modifié. Aucune vérification en navigation anonyme sur le domaine public n’a été effectuée puisque le site reste privé.
