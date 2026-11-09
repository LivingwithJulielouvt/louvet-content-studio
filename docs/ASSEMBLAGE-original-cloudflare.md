# Reconstituer Louvet Content Studio

Télécharger les cinq ZIP de cette série, puis les extraire dans le MÊME dossier. Tous contiennent une arborescence `louvet-content-studio/` : fusionner ce dossier à chaque extraction, en conservant les chemins. Ne pas remplacer tout le dossier par une seule partie.

1. `louvet-studio-01-interface.zip` : pages, composants, styles, icônes et ressources d’interface.
2. `louvet-studio-02-serveur-configuration.zip` : logique serveur, base, migrations, README complet, `.env.example`, documentation, scripts, dépendances et lockfile.
3. `louvet-studio-03-moteur-video-tests.zip` : moteur vidéo JavaScript, police/licences, tests et premier fragment WASM.
4. `louvet-studio-04-video-complement-a.zip` : deux fragments WASM supplémentaires.
5. `louvet-studio-05-video-complement-b.zip` : dernier fragment WASM.

Les cinq fichiers sont des ZIP ordinaires qui s’ouvrent séparément, et non des volumes `.z01`. Toutes les parties sont nécessaires pour reconstituer le projet complet, notamment le moteur vidéo.

Lire ensuite `louvet-content-studio/README.md`. Les 236 fichiers du précédent export sont tous conservés, octet pour octet. Le présent guide est ajouté à chaque ZIP. Le fichier `SHA256SUMS.txt` permet de vérifier l’intégrité des fichiers reconstitués.

Cet export conserve la version actuelle Sites/Vinext avec sa connexion ChatGPT et ses bindings D1/R2. Il n’effectue aucune migration Vercel/Supabase, n’active aucun service et ne contient pas les secrets ni les données privées des clients.
