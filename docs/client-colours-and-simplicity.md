# Couleurs propres aux clients et interface simple

Les couleurs déjà enregistrées dans chaque fiche client s’appliquent désormais à son espace : navigation, boutons, zones de fond, carte de marque, questionnaire, attente de validation et calendrier. Le thème est calculé depuis le client sélectionné et porté par son propre conteneur. Aucun thème n’est stocké globalement dans le navigateur.

Dans **Marque & accès / Identité & accès → Paramètres**, l’agence peut modifier les codes couleur et choisir une ambiance :
- **Sobre** : espaces clairs, mise en page simple.
- **Chaleureuse** : coins plus arrondis et titres avec une typographie à empattements.
- **Vive** : lignes plus affirmées et présence de la couleur.

Un aperçu apparaît dans ces paramètres avant l’enregistrement. La première couleur est la couleur principale ; la seconde complète la palette. Les boutons gardent la couleur principale exacte ; leurs lettres passent en clair ou en sombre selon le contraste nécessaire. Les textes de lecture utilisent des tons foncés lisibles. Les couleurs invalides sont ignorées et une palette de secours est utilisée si nécessaire. Le site agence garde son apparence propre.

Côté client :
- Le nom de sa marque est placé en haut du menu.
- Les entrées deviennent **Créer des photos, Mon calendrier, Mes photos, Idées de vidéos, Mes vidéos, Mes produits / Mes sujets**, et **Mes repères** pour les créateurs.
- Trois raccourcis à l’accueil permettent de créer des photos, filmer une vidéo ou ouvrir le calendrier.
- La création photo suit trois étapes visibles : choisir le sujet, ajouter des photos, puis créer les images avec les textes à publier.
- Les crédits sont expliqués et le coût reste visible avant toute création.
- Les textes ordinaires sont plus grands, les boutons ont au moins 44–48 pixels de hauteur, et les liens et zones de saisie disposent d’un repère de focus lisible.
- Les options facultatives de fêtes et les réglages vidéo moins fréquents sont repliés.
- Sur mobile, la semaine du calendrier se lit comme une liste de jours.

## Fiches vidéo

Chaque fiche affiche un guide en français, espagnol ou anglais selon la langue du contenu. Il explique le nettoyage de l’objectif, le téléphone debout, la lumière et la stabilité, puis présente une carte par petite vidéo :
- ce qu’il faut faire ;
- les mots à dire lorsqu’ils sont fournis ;
- la position du téléphone ;
- le temps conseillé pour filmer ;
- comment démarrer et arrêter l’enregistrement.

Les expressions techniques courantes sont expliquées avec des mots ordinaires. Par exemple, « gros plan » devient une vue de près avec une instruction pour approcher le téléphone ; « face caméra » explique où regarder ; « appel à l’action » devient la phrase qui dit quoi faire ensuite. Des cases aident à suivre la fiche pendant sa consultation ; elles ne changent pas l’avancement enregistré. Le sélecteur d’avancement existant reste disponible.

Le guide s’applique aussi aux idées déjà enregistrées, sans réécrire les données ni écraser les idées personnalisées de l’agence. Les notes originales restent visibles dans l’interface agence. Le bouton de copie inclut les instructions simplifiées.

Les limites réelles du montage restent expliquées : le studio réunit les vidéos dans l’ordre d’ajout ; il ne choisit pas les meilleurs moments et ne comprend pas les consignes écrites. Les sous-titres nécessitent toujours un fichier fourni par l’agence. Le client peut demander à l’agence de s’occuper du montage.

## Vérification

1. Donner des couleurs différentes à deux espaces, enregistrer, puis ouvrir **Vue client** pour chacun : boutons, menu, accueil et calendrier doivent changer selon l’espace sélectionné.
2. Refaire avec une couleur très claire : le texte des boutons doit rester lisible.
3. Ouvrir l’aperçu du questionnaire pour vérifier que son thème correspond aussi au client.
4. Ouvrir **Idées de vidéos → Comment filmer ?** : vérifier les cartes, la position du téléphone, les durées, les phrases et la copie.
5. Vérifier une idée personnalisée existante : ses mots et restrictions doivent être conservés.
6. Depuis un téléphone, vérifier la navigation, les champs et la semaine du calendrier.

Tests : `tests/client-experience.mjs` couvre contrastes, palettes invalides, isolation des thèmes, sauvegarde des ambiances, thème pendant le questionnaire, guides FR/ES/EN et préservation des consignes. Les suites sécurité, inscription, récompenses, créateurs et styles vérifient la compatibilité. Le contrôle TypeScript et le build de production sont exécutés. La recette visuelle dans un navigateur et un test avec de vrais utilisateurs restent à faire : aucune compréhension par une tranche d’âge n’a été mesurée.
