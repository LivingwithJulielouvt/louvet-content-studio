# Passage à une application commerciale indépendante

Le prototype reste privé sur ChatGPT Sites. Aucune transaction financière n’est intégrée : Sites n’autorise actuellement pas les transactions financières.

Pour ouvrir le studio sans compte ChatGPT et permettre des paiements :

1. Créer les comptes d’infrastructure au nom de Louvet & Partners et retenir une entité de facturation et ses devises.
2. Préparer un dépôt de production et une migration vers un hébergement indépendant. Une piste cohérente avec le code actuel est Cloudflare Workers avec vinext, D1 et R2 sur le compte de l’agence. La compatibilité doit être vérifiée et les intégrations propres à Sites remplacées.
3. Installer une authentification indépendante avec invitations, email et mot de passe ou liens de connexion. Migrer les identités sans se fier à une adresse fournie par le navigateur. Conserver les rôles et l’appartenance aux espaces côté serveur.
4. Exporter et migrer les données et fichiers privés. Remplacer l’accès de maintenance owner-private par une tâche authentifiée dédiée. Ajouter un stockage durable des résultats générés sans nécessiter la réouverture du site.
5. Connecter le service de paiement choisi. Stripe peut gérer abonnements, paiements et facturation commerciale ; définir les offres avant intégration. Les événements vérifiés du prestataire, reçus côté serveur, doivent seuls activer un abonnement ou ajouter des crédits. Ne jamais créditer un compte sur simple retour à une page de succès.
6. Sélectionner et connecter un service de montage vidéo. Un premier rendu MP4 WebAssembly est disponible sur l’appareil, onglet ouvert. Il faut un service distant pour poursuivre après fermeture, des ressources de marque persistantes et une transcription pour les sous-titres automatiques. Tester durées, formats, sous-titres et gestion des erreurs sur les appareils clients.
7. Brancher le domaine de l’agence, par exemple un sous-domaine studio du domaine déjà possédé. Configurer HTTPS, les secrets, les sauvegardes et les emails transactionnels.
8. Valider deux vrais comptes clients distincts, un paiement en mode test, les quotas, les accès aux fichiers, une génération réelle et un montage réel avant toute ouverture commerciale.

Prévoir séparément les dépenses d’hébergement et de stockage, de génération IA, de rendu vidéo et de traitement des paiements. Aucun budget chiffré n’a encore été validé.
