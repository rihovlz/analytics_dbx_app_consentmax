# Préparation data proportionnée

Utiliser ce parcours après la découverte d'une source et avant la première feature lorsqu'une question subsiste sur la
forme des données consommées par l'app. Le résultat attendu est le chemin le plus simple qui respecte le grain et la
fraîcheur nécessaires.

## Choisir le mode

- Recommander `direct` si une table ou vue existante répond au besoin avec une requête interactive bornée.
- Recommander `notebook` pour une sélection ou transformation batch simple, propre à l'app et rejouée manuellement ou
  à faible fréquence.
- Recommander `pipeline` uniquement pour une materialized view incrémentale, une préparation planifiée ou une qualité
  de données qui justifie Lakeflow.

Une donnée utilisée par plusieurs apps n'appartient plus au petit périmètre mono-mainteneur : recommander un data
product séparé plutôt que de l'enfouir dans le repository de l'app.

## Créer le contrat

Lancer `npm run data:init -- <nom>`. Faire préciser au maximum trois éléments à la fois : mode et source, sortie et
colonnes, puis propriétaire, grain, clés et fraîcheur. Les objets source et sortie doivent rester dans le projet choisi.

Le script synchronise le contrat sous `data/contracts/`, la source consommée par l'app et les fichiers générés. Pour un
mode préparé, relire le SQL sous `data/notebooks/` ou `data/pipelines/` et les contrôles agrégés sous `data/tests/`.
Ne pas conserver `SELECT *`, donnée client, résultat de notebook ou credential.

## Exécuter une préparation

Une préparation est un SQL d'écriture. Afficher d'abord le plan sans `--confirm` :

```bash
npm run data:prepare -- <nom> --profile <profil>
```

Après autorisation explicite sur workspace, profil, projet, source et sortie, relancer avec `--confirm`. Le mini-bundle
`data/` est séparé du bundle app afin de créer la sortie avant son binding `SELECT`. Les schedules restent en pause ;
ne les activer qu'après une exécution manuelle réussie.

Clore par `npm run app:doctor -- --remote` en lecture seule. Ensuite seulement, construire la feature sur le nom court
`appSource` du contrat.
