# Préparer les 30 idées vidéo mensuelles

Site : appgprj_6ad01024e2508191b26c6920ce76b201
URL : https://louvet-content-studio.louvet-partners.chatgpt.site

Chaque premier du mois à 07:00 America/Monterrey, préparer les 30 idées pour chaque client actif. La préparation utilise les marques, produits, pays, secteurs et occasions enregistrés. Aucun appel IA facturé n’est nécessaire. Les idées existantes, leurs corrections et leur avancement ne sont pas écrasés.

## Accès sans utilisateur présent

1. Lire le Site avec l’outil Sites get_site, pour cet identifiant exact.
2. Vérifier que l’audience est encore limitée au propriétaire : politique custom avec uniquement le propriétaire dans allowed_users, aucun groupe, aucun autre éditeur ou visiteur. En cas de doute ou d’élargissement d’audience, arrêter et signaler le blocage. Ne jamais changer l’audience pour exécuter la tâche.
3. Obtenir le siwc_bypass_bearer_token retourné pour ce même Site. Ce jeton reste uniquement en mémoire ; ne pas l’inscrire dans un fichier, le journal ou le texte de la tâche.
4. Envoyer une seule requête POST à `/api/studio/monthly-maintenance`, avec le jeton dans `OAI-Sites-Authorization: Bearer ...` et `X-Studio-Request: 1`. Le corps est `{}`. Ne pas fabriquer d’en-têtes d’identité utilisateur.
5. Vérifier le résultat : `month`, `clients`, `created_plans`, `ideas_per_plan` (30). Lire ensuite l’aperçu de la base via Sites, puis les lignes autorisées de `video_plans` pour confirmer la persistance. Les résultats sont limités ; ne pas exfiltrer les contenus éditoriaux ni les données clients.
6. Une reprise est sans doublon : le couple client/mois et les 30 emplacements sont uniques. Ne pas modifier le statut des idées tournées, les demandes de montage ou les quotas image.

L’endpoint est activé seulement pour cette version owner-private via OWNER_PRIVATE_SERVICE=true. Il n’est pas un endpoint public. **Avant d’élargir l’audience, de rendre le Site public ou de migrer l’hébergement, désactiver ce service et remplacer cet accès par un worker authentifié dédié.** Le renouvellement du mois courant est aussi disponible à l’ouverture de chaque espace client, avec les autorisations normales.

Le succès de la tâche signifie que les idées éditoriales ont été préparées. Il ne signifie pas qu’un email a été envoyé, qu’une vidéo a été montée ou qu’un contenu a été publié sur un réseau social.
