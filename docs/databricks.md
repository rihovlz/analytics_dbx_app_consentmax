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
