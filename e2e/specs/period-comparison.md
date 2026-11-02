# Comparaison facultative de périodes

Préconditions : AppKit local en mode démo, sans credentials, Chromium et mouvement réduit.
Fixture : commandes synthétiques du 1er janvier 2024 au 20 septembre 2026 ; trois canaux disjoints.
L'utilisateur veut comparer un montant entre deux périodes et lire la contribution de chaque canal à l'écart.

1. Ouvrir `/visualizations`, lire les deux périodes, leurs valeurs et leur écart ; ouvrir les contributions au clavier.
2. Filtrer un canal pour les deux périodes, puis choisir l'année précédente ; vérifier les dates et le filtre affichés.
3. Choisir une référence personnalisée plus courte ; vérifier l'avertissement et les dates exactes.
4. Demander une période partielle puis une période sans données ; distinguer ces deux états.
5. Bloquer une réponse pour observer le chargement, provoquer une erreur sûre puis réessayer.
6. Lancer une nouvelle comparaison pendant une requête lente ; le résultat ancien ne doit pas remplacer le nouveau.
7. Vérifier le thème clair sur bureau, le sombre sur mobile, le défilement interne du waterfall et le tableau au clavier.

Les calculs indépendants, références nulles/négatives, dates invalides, limites, moyennes et résidus sont aussi couverts
en tests unitaires. Le SQL généré est vérifié par un executor factice dans le parcours consommateur.
Hors scope : exécution Databricks, qualité réelle des données, fuseau d'une colonne TIMESTAMP et preuve de causalité.
