# Comptes et e-mails Brevo — préparation, sans activation

## État livré

L’audience privée du Site est conservée. Le code et les aperçus sont publiés ; aucun compte réel n’est supprimé, aucun contact n’est transmis à Brevo, aucun e-mail réel n’est envoyé et aucune tâche planifiée n’est créée. L’activation exige un accord explicite de Julie dans une étape ultérieure. Une clé API seule ne suffit pas à autoriser l’envoi.

Les six textes français/espagnol sont définis dans `lib/studio-email-templates.mjs` et visibles dans **E-mails & rappels**. La version proposée est `louvet-2026-10-16-v1`. La banque de chiffres reste vide : aucun chiffre ni source n’a été inventé en production.

## Gestion des comptes

Sur chaque espace sélectionné, l’agence voit **Supprimer le compte**. Le dialogue propose désactivation réversible ou suppression définitive (réactivation si l’espace est déjà désactivé). Il faut retaper le nom exact pour toutes ces actions. Le serveur vérifie lui-même le rôle, le nom et l’espace ; modifier le HTML ou appeler directement l’API ne contourne pas la confirmation.

- Désactiver ferme l’accès du client et suspend les futurs rappels ; données et fichiers restent conservés. Réactiver rouvre l’espace tout en conservant les éventuelles suspensions individuelles d’utilisateurs.
- Supprimer ferme immédiatement l’accès, inscrit une marque technique de suppression et efface les objets R2 sous le préfixe de ce client, puis toutes ses lignes de données et comptes rattachés. Les autres clients et styles globaux de l’agence sont conservés.
- Si l’effacement échoue, le compte reste fermé ; **Reprendre la suppression** termine le nettoyage. Plus de 8 000 objets nécessitent plusieurs reprises. Aucun succès complet n’est annoncé avant l’effacement des fichiers et de la base.
- Les écritures tardives sont bloquées par la base. Les envois de fichiers déjà engagés et les résultats IA/vidéo en cours ne peuvent pas recréer un fichier après l’effacement. Une marque minimale (identifiant d’espace, administrateur ayant demandé la suppression, état technique et date) est conservée à cette fin, sans nom ni e-mail du client.
- Le périmètre est le stockage du studio : cette action ne résilie pas un abonnement Stripe, ne rappelle pas les e-mails déjà reçus et ne supprime pas les éventuelles données déjà conservées par des services externes. Aucune action Stripe ou Brevo externe n’est déclenchée par la suppression.

## Les trois événements

1. **Demande reçue** : préparé lorsque le client envoie les dix réponses complètes, pas lorsqu’il commence un brouillon. Création du message et soumission sont atomiques. Une clarification puis resoumission ne crée pas un second accusé de réception.
2. **Bienvenue, ton compte est actif** : préparé dans la transaction de validation agence, avec le prénom, la langue et le lien du studio. Les essais du questionnaire agence n’envoient rien.
3. **Rappel du lundi** : seulement pour les comptes clients actifs, ouverts par l’agence et inscrits au rappel. Le choix est proposé à l’inscription, puis modifiable dans l’espace client. Le rappel comporte un chiffre vérifié, sa source, sa date, un bouton vers le studio et une désinscription.

La langue est celle de l’espace : espagnol pour `es`, français sinon. Chaque membre reçoit son propre message ; les adresses ne sont pas partagées entre destinataires.

## Accord et configuration futurs

Ne configurer aucune de ces autorisations d’envoi avant l’accord de Julie. Aucun de ces réglages n’a été ajouté pendant cette livraison.

- Secret serveur `BREVO_API_KEY`.
- `BREVO_SENDER_EMAIL` : expéditeur vérifié dans Brevo ; nom affiché **Louvet & Partners**. Valider le domaine/expéditeur selon les exigences Brevo avant une recette réelle.
- `STUDIO_URL` : déjà définie pour ce Site.
- `BREVO_STUDIO_LIST_ID` : identifiant numérique de la liste **Membres studio**. Le serveur vérifie son nom avant toute synchronisation de contacts.
- Attributs Brevo nécessaires : `FIRSTNAME` (texte), `STUDIO_LANGUAGE` (texte), `STUDIO_WEEKLY` (booléen). Créer/configurer ces attributs seulement après accord.
- Après validation des textes : `EMAIL_COPY_APPROVED_VERSION=louvet-2026-10-16-v1` et `EMAIL_DELIVERY_ENABLED=true`. Les deux conditions sont obligatoires en plus de la configuration. Si les textes changent, incrémenter leur version afin d’exiger un nouvel accord.
- Les anciens messages Resend sont conservés avec `copy_version=legacy` et ne sont plus expédiés par ce transport. Les brouillons en attente avant activation ne sont pas envoyés en masse : il faut les reprendre explicitement, message par message, depuis l’agence.

La validation de compte déclenche, une fois les autorisations actives, l’ajout du membre à **Membres studio**. La synchronisation ne force pas la fusion de contacts et ne retire jamais un blocage ou une désinscription Brevo. Un échec de synchronisation est enregistré ; il n’annule pas l’ouverture du compte. La liste de membres et le consentement au rappel sont distincts.

## Chiffres sourcés

L’agence saisit le texte complet dans les deux langues, le titre de la source, son URL HTTPS et sa date de publication, puis confirme l’avoir vérifié. Seuls les chiffres marqués utilisables sont sélectionnés. Modifier un champ depuis l’interface décoche la validation. Décocher cette validation retire le chiffre des prochains rappels. Le message conserve un instantané de la source choisie ; celle-ci doit encore être validée au moment de l’envoi. Sans chiffre validé, aucun rappel ne part.

## Rappel hebdomadaire et désinscription — encore désactivés

Créneau préparé : lundi 9 h, fuseau **America/Monterrey**. Le traitement refuse les appels hors du lundi entre 9 h et 10 h locales, ne dépend pas de l’ouverture du navigateur et dédoublonne par membre/date du lundi. Il traite au maximum 500 membres par passage ; au-delà, ajouter une pagination avant activation.

Après accord seulement :

1. Ajouter `EMAIL_UNSUBSCRIBE_SECRET` (secret aléatoire d’au moins 32 caractères).
2. Vérifier depuis l’extérieur que `/mail/unsubscribe` est accessible sans connexion ChatGPT. Le Site propriétaire-privé actuel ne satisfait pas cette condition. Ne pas contourner cette protection : attendre l’audience publique autorisée par Julie ou une entrée publique approuvée, puis définir `EMAIL_UNSUBSCRIBE_PUBLIC_READY=true`.
3. Ajouter `STUDIO_MAIL_CRON_SECRET` (autre secret aléatoire d’au moins 32 caractères).
4. Configurer un ordonnanceur hébergé approuvé qui appelle `POST /api/studio/mail-weekly` avec `Authorization: Bearer <secret>`. Si le Site est encore privé, il faut aussi un accès de service Sites autorisé. Ne jamais mettre les secrets dans le texte d’une tâche, un navigateur ou un dépôt.
5. Raccorder l’ordonnanceur au lundi 9 h dans America/Monterrey, vérifier son accès autonome et le résultat en base. Aucune tâche native Sites n’a été créée, car cette opération l’activerait avant l’accord demandé.
6. Activer `MAIL_WEEKLY_ENABLED=true` seulement après ces vérifications et une recette autorisée. Le transport e-mail et les textes doivent déjà être approuvés.

Le lien de désinscription porte un jeton signé sans adresse e-mail en clair, valable un an. GET affiche une confirmation et n’arrête pas le rappel, pour éviter la désinscription par un scanner d’e-mail ; POST la confirme. Le compte reste actif et les messages de compte ne sont pas désactivés. Les futurs rappels consultent aussi l’état canonique du contact Brevo (blocage/listes) et ne réabonnent pas silencieusement un contact bloqué.

## Incidents et validation

Un message est réservé une seule fois avant son appel Brevo et possède une clé d’idempotence. Une erreur réseau, réponse illisible ou résultat incertain n’est jamais relancé automatiquement. Vérifier les journaux Brevo avant toute décision sur un message « À vérifier ». Une reprise manuelle est possible pour un échec confirmé, après approbation/configuration. Les événements envoyés ne sont pas rejoués.

Tests :

- `node tests/client-lifecycle.mjs` : confirmation exacte, rôle agence, désactivation/réactivation, suppression isolée, stockage interrompu/reprise, écritures et upload tardifs.
- `node tests/studio-mail.mjs` : six variantes, clé seule insuffisante, déclencheurs, liste/contacts, opt-in et désinscription, chiffre/source obligatoire, fuseau, dédoublonnage, erreurs et authentification du traitement.
- Suites existantes, TypeScript et build de production.

Tous les transports Brevo des tests sont simulés. Aucune recette navigateur, suppression réelle ou connexion Brevo de production n’a été réalisée.

Sources techniques :

- https://developers.brevo.com/reference/send-transac-email
- https://developers.brevo.com/reference/create-contact
- https://developers.brevo.com/reference/update-contact
- https://developers.brevo.com/reference/get-contact-info
- https://developers.brevo.com/reference/get-list
