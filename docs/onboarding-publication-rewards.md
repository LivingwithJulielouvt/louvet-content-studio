# Inscription, calendrier et récompenses

## Fonctionnement livré

- L’identité existante reste la connexion ChatGPT. Un visiteur autorisé sur le site peut créer son espace (prénom, nom public/marque, type marque ou créateur, langue), ou rejoindre un espace existant avec son code. Le formulaire de dix questions est obligatoire avant l’envoi de la demande.
- Le brouillon persiste dans D1. Après l’envoi, la demande est « En attente ». Les API du studio, y compris la lecture des fichiers et du calendrier préparé, sont bloquées jusqu’à la validation. Les comptes et espaces existants conservent leurs données et leur statut.
- L’agence dispose de « Demandes en attente », avec compteur, contact, lecture des réponses, préparation de la stratégie/réglages et du calendrier. « Valider et ouvrir le compte » autorise le studio. Pour les créateurs, les prérequis de stratégie existants sont conservés.
- Dans « Marque & accès » ou « Identité & accès » → « Aperçu du parcours client », le « Mode test » permet les quatre étapes, les brouillons et l’envoi simulé. Chaque test est marqué test et isolé par couple administrateur/espace dans une table dédiée. L’effacement ne touche jamais les vraies réponses. Aucun email ni point n’est produit par ces tests.
- « Mon calendrier » / « Calendrier clients » : mois, semaine, dates selon America/Monterrey, Instagram/TikTok/LinkedIn/Facebook/YouTube/Pinterest/X/Autre, titre, légende et visuel privé de l’espace. L’agence crée, modifie, déplace via la date et supprime les posts. Une suppression conserve l’historique et retire les points éventuels.
- Un post non confirmé dont la date est antérieure à aujourd’hui à Monterrey est « En retard ». Les autres sont « Prévu » ou « Publié ». Les statuts sont recalculés à la lecture.
- « J’ai publié ce post » attribue 10 points par défaut. « Annuler ma validation » les retire. La première valeur attribuée au post est conservée même si le barème change ensuite. Une nouvelle confirmation restaure cette même valeur : aucun cumul possible sur un même post. Les validations concurrentes sont protégées par version et transaction D1.
- Le total et l’historique de points sont calculés depuis un journal de gains/retraits. La progression mensuelle compte les posts non supprimés programmés dans le mois courant à Monterrey. La vue d’ensemble agence affiche ces mesures pour tous les espaces.

## Email transactionnel : Resend

L’envoi est implémenté via l’API HTTPS Resend, côté serveur uniquement. Aucun nouvel abonnement IA, aucune nouvelle clé OpenAI et aucun service de publication sociale ne sont nécessaires pour ces fonctions.

1. Créer un compte Resend et ajouter un domaine possédé par l’agence, par exemple `louvetpartners.com`, ou un sous-domaine réservé à ces emails.
2. Dans le gestionnaire DNS, ajouter exactement les enregistrements de vérification demandés par Resend (SPF/DKIM selon sa configuration). Attendre la validation du domaine. Ne pas remplacer arbitrairement les enregistrements de la messagerie existante.
3. Créer une clé Resend autorisée à envoyer sur ce domaine.
4. Dans les variables serveur du site, configurer `RESEND_API_KEY` comme secret et `EMAIL_FROM`, par exemple `Louvet & Partners <studio@louvetpartners.com>` si ce domaine a bien été vérifié. Ne jamais placer la clé dans le code, le navigateur ou Git.
5. `STUDIO_URL` est déjà configurée à `https://louvet-content-studio.louvet-partners.chatgpt.site/`. Republier pour appliquer les changements de variables.
6. Faire une validation avec une adresse de test autorisée et vérifier l’email reçu, le prénom et le bouton.

L’objet est « Votre compte est prêt ». Le message HTML et sa version texte sont personnalisés par prénom et signés « L’équipe Louvet & Partners ». L’ouverture et la mise en file de l’email s’effectuent dans une même transaction. Un seul email d’ouverture par compte/espace est créé. L’envoi est lancé automatiquement lors de la validation si Resend est configuré.

Si la configuration est absente, le compte s’ouvre et l’email reste en attente. « Marque & accès » / « Identité & accès » affiche l’état et le bouton « Reprendre les emails en attente ». Ce bouton reprend les emails en attente ou refusés explicitement. « Accepté par Resend » signifie que l’API l’a accepté, pas que le destinataire l’a reçu. Un échec réseau ou une erreur fournisseur incertaine bloque la relance : vérifier dans Resend avant toute intervention manuelle. Une clé d’idempotence stable est jointe à chaque requête.

Documentation fournisseur :
- https://resend.com/docs/dashboard/domains/introduction
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/dashboard/emails/idempotency-keys

## Accès des clients

Le site conserve son audience privée existante, actuellement limitée au propriétaire. Pour tester avec une autre personne, autoriser cette adresse dans le partage Sites (et, pour le parcours par code, dans les adresses autorisées de l’espace). La connexion doit utiliser le compte ChatGPT correspondant. L’inscription libre depuis Internet nécessiterait une décision explicite de rendre le site public ; cela ne fait pas partie de cette modification.

## Recette manuelle

1. **Mode test** : ouvrir l’aperçu depuis un espace existant, activer Mode test, remplir les étapes, enregistrer un brouillon, quitter/revenir, terminer et transmettre. Revenir à la vraie fiche pour vérifier qu’elle n’a pas changé. Effacer le test et vérifier qu’il est vierge. Refaire avec un second espace : aucune réponse ne doit être partagée.
2. **Inscription** : avec un second compte ChatGPT autorisé sur le site, créer un espace. Remplir quelques réponses, recharger pour vérifier le brouillon, puis les dix réponses et envoyer. Vérifier le message d’attente et l’absence d’accès au studio. Dans l’agence, ouvrir Demandes en attente, lire les réponses, préparer stratégie/réglages et calendrier, puis valider. Le client peut rafraîchir ou attendre le rafraîchissement de 30 secondes de l’écran d’attente pour entrer.
3. **Email** : après configuration, valider un vrai compte de test ; vérifier réception, prénom, objet, signature et bouton vers le studio. Répéter la reprise d’envoi : aucun doublon. Sans configuration, vérifier l’état « En attente d’envoi ».
4. **Calendrier** : ajouter un post avec légende et visuel, vérifier mois/semaine côté client. Modifier sa date et vérifier son déplacement. Ajouter un post daté d’hier : En retard. Supprimer un post et vérifier sa disparition.
5. **Points** : confirmer un post → +10 ; recharger → le total persiste ; annuler → −10 ; reconfirmer → +10, sans cumul. Modifier le barème dans les paramètres de l’espace (ex. 25), puis confirmer un nouveau post → +25. L’ancien conserve sa valeur de 10. Vérifier l’historique, la progression mensuelle et le tableau agence. Supprimer un post publié : ses points sont retirés.
6. **Isolation** : se connecter à deux clients différents. Les réponses, tests, visuels, calendriers et points doivent rester propres à chaque espace ; les routes d’un autre espace sont refusées côté serveur.

## Validation technique

Les tests `tests/publication.mjs` et `tests/intake.mjs` couvrent l’inscription, les brouillons, l’attente, la validation concurrente, l’outbox/email personnalisé (fournisseur simulé), les échecs d’envoi, le contrôle d’accès, les dates du calendrier et les points concurrents/réversibles. Les suites de sécurité, quotas, éditorial, montage, styles, profils qualité et créateurs couvrent la compatibilité des fonctions existantes. Vérification TypeScript et build de production avant publication. Aucun envoi email réel n’a lieu dans ces tests. La recette navigateur et la réception réelle de l’email restent à réaliser avec les accès/configurations ci-dessus.
