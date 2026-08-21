# Databricks

## Identités

Le développement local réel utilise en priorité un profil OAuth U2M créé par `databricks auth login`. Avec
`DATABRICKS_CONFIG_PROFILE`, le driver SQL demande au CLI un jeton éphémère via `databricks auth token`. Il ne l'écrit ni
dans `.env.local`, ni dans les logs. Un `DATABRICKS_TOKEN` court terme reste un fallback local ; les deux méthodes ne
peuvent pas être configurées ensemble.

Le runtime Databricks Apps n'utilise ni le profil du développeur ni son jeton : la plateforme injecte
`DATABRICKS_HOST`, `DATABRICKS_CLIENT_ID` et `DATABRICKS_CLIENT_SECRET` pour le service principal de l'app. La CI utilise
encore une identité distincte via GitHub OIDC. Suivre [local-development.md](local-development.md) pour configurer et
contrôler ces parcours.

Une préparation notebook ou pipeline utilise l'identité du mainteneur qui exécute `data:prepare`. Cette identité peut
lire la source et créer ou remplacer la sortie. Ces droits d'écriture ne sont jamais transmis au service principal de
l'app, qui conserve uniquement `CAN_USE` sur le warehouse et `SELECT` sur la sortie déclarée.

Le code ne journalise ni ne renvoie ces variables. N’ajouter aucune variable `NEXT_PUBLIC_*` contenant un host privé,
un identifiant de ressource ou un credential.

## SQL Warehouse et Unity Catalog

Le warehouse est déclaré comme ressource `sql-warehouse` dans `databricks.yml`, avec `CAN_USE`, puis transmis par
`valueFrom` dans `app.yaml`. Le service principal de l’app doit aussi disposer des privilèges Unity Catalog strictement
nécessaires : typiquement `USE CATALOG`, `USE SCHEMA` et `SELECT` sur les objets lus.

Le catalogue est le projet de données de l'application. Le template limite ce choix à :

- `dev-dtm-operating` ;
- `dev-dtm-media-pm` ;
- `dev-dtm-myvaliuz` ;
- `dev-dtm-insight-sharing`.

La liste maintenue se trouve dans `config/data-projects.json`. `npm run init-app` et la configuration serveur refusent
une autre valeur. Les noms contiennent des tirets : les requêtes dynamiques de contrôle utilisent `IDENTIFIER(?)` et
ne concatènent jamais ces identifiants dans du SQL.

Le template préremplit l’infrastructure partagée Valiuz suivante :

| Ressource | Valeur |
| --- | --- |
| Workspace | `https://3070470996474403.3.gcp.databricks.com` |
| SQL Warehouse | `team-da-poc` |
| SQL Warehouse ID | `ab362e9710498a08` |
| Permission du binding | `CAN_USE` |

`npm run init-app` propose ces valeurs par défaut et accepte `--host` ou `--warehouse` pour cibler une autre
infrastructure. Vérifier l’ID dans le workspace avant chaque déploiement : le nom lisible du warehouse est documenté
pour les opérateurs, mais le bundle utilise son ID stable.

Déclarer chaque table ou vue consommée dans `config/data-access.json`, avec un nom technique court, son identifiant
`projet.schema.objet` et sa finalité. `npm run data:access:render` génère un binding `uc_securable` `SELECT`. Databricks
accorde alors au service principal de l'app les privilèges minimaux sur l'objet et ses parents. La personne ou
l'identité qui déploie doit être autorisée à accorder ces droits ; ne pas élargir le binding à `MODIFY`.

Le manifeste et `resources/data-access.generated.yml` sont versionnés ensemble. La CI exécute
`npm run data:access:check` pour détecter une source hors projet, un doublon ou un fichier généré obsolète.

## Choisir entre direct, notebook et pipeline

Commencer par `direct`. Ajouter une préparation seulement si la requête interactive serait trop complexe ou lente, si
une table doit être partagée dans plusieurs vues de l'app, ou si la fraîcheur doit être pilotée indépendamment du
dashboard.

```bash
npm run data:init -- <nom>
npm run data:prepare:check
```

- `direct` enregistre la table ou vue dans `config/data-access.json` et ne crée aucune ressource.
- `notebook` génère un notebook SQL source-format et un Lakeflow Job utilisant le warehouse configuré.
- `pipeline` génère une materialized view dans une pipeline Lakeflow serverless, orchestrée par un Job.

Les contrats sont versionnés sous `data/contracts/`. Ils définissent source, sortie, colonnes explicites, grain, clés,
propriétaire, fraîcheur et fréquence. Les starters SQL évitent `SELECT *`; les adapter et exécuter manuellement les
contrôles agrégés sous `data/tests/` dans un notebook ou l'éditeur SQL avant la première écriture.

Le mini-bundle `data/databricks.yml` est séparé du bundle applicatif pour respecter cet ordre :

1. relire le contrat et le SQL ;
2. afficher workspace, profil, projet, source et sortie sans mutation ;
3. relancer avec `--confirm` pour déployer et exécuter la préparation ;
4. contrôler la sortie avec `app:doctor -- --remote` ;
5. déployer ensuite l'app et son binding `SELECT`.

```bash
npm run data:prepare -- <nom> --profile valiuz-analytics-dev
npm run data:prepare -- <nom> --profile valiuz-analytics-dev --confirm
```

Les schedules `hourly` et `daily` restent `PAUSED`. `--activate-schedule` les passe à `UNPAUSED` lors d'un déploiement
explicitement confirmé ; ce choix s'applique à toutes les préparations planifiées du mini-bundle. Pour une app interne
mono-mainteneur, garder `manual` tant qu'une exécution planifiée n'apporte pas de valeur claire.

## Pattern SQL

- Requêtes dans `src/features/<feature>/server/queries.ts` ou dans un fichier `.sql` voisin si elles sont longues.
- Entrées liées avec `ordinalParameters`; jamais d’interpolation d’entrée utilisateur.
- Résultats validés par un schéma Zod dans le repository.
- Nom de requête stable pour les logs et query tags.
- Timeout borné et limite de lignes explicite.
- Fermeture de l’opération, de la session et du client dans tous les cas.

`npm run databricks:check` vérifie en lecture seule le profil, le workspace, le warehouse, le projet, le schema et les
métadonnées des sources déclarées. `npm run test:databricks` exécute ensuite `SELECT current_user()` et compile toutes
les sources dans une requête paramétrée avec `WHERE FALSE`. Ce test d'intégration ne retourne aucune ligne et reste
séparé de `npm test`, afin que la CI unitaire ne dépende pas d'un workspace ou d'un warehouse actif.

## Secrets additionnels

Si une future app appelle un système tiers, créer un secret Databricks et le référencer par ressource/binding lorsque
la plateforme le permet. Ne placer ni valeur secrète dans `databricks.yml`, ni fallback secret dans le code. Documenter
le propriétaire, la rotation et le privilège minimal requis.
