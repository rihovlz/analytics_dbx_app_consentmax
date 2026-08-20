# Databricks

## Identités

Le développement local utilise `DATABRICKS_TOKEN` uniquement lorsque `APP_MODE=databricks`. Préférer un token court
terme et le conserver dans `.env.local`. Le runtime Databricks Apps n’utilise jamais ce token : la plateforme injecte
`DATABRICKS_HOST`, `DATABRICKS_CLIENT_ID` et `DATABRICKS_CLIENT_SECRET` pour le service principal de l’app.

Le code ne journalise ni ne renvoie ces variables. N’ajouter aucune variable `NEXT_PUBLIC_*` contenant un host privé,
un identifiant de ressource ou un credential.

## SQL Warehouse et Unity Catalog

Le warehouse est déclaré comme ressource `sql-warehouse` dans `databricks.yml`, avec `CAN_USE`, puis transmis par
`valueFrom` dans `app.yaml`. Le service principal de l’app doit aussi disposer des privilèges Unity Catalog strictement
nécessaires : typiquement `USE CATALOG`, `USE SCHEMA` et `SELECT` sur les objets lus.

Ajoutez un `uc_securable` au bundle seulement si l’app doit rendre une ressource visible dans l’UI Databricks Apps.
Les grants de données doivent rester gérés par la gouvernance de l’équipe ; ne donnez pas de privilèges larges dans le
template.

## Pattern SQL

- Requêtes dans `src/features/<feature>/server/queries.ts` ou dans un fichier `.sql` voisin si elles sont longues.
- Entrées liées avec `ordinalParameters`; jamais d’interpolation d’entrée utilisateur.
- Résultats validés par un schéma Zod dans le repository.
- Nom de requête stable pour les logs et query tags.
- Timeout borné et limite de lignes explicite.
- Fermeture de l’opération, de la session et du client dans tous les cas.

`npm run test:databricks` exécute le smoke test `SELECT current_user()`. Ce test d’intégration est volontairement séparé
de `npm test`, afin que la CI unitaire ne dépende pas d’un workspace ou d’un warehouse actif.

## Secrets additionnels

Si une future app appelle un système tiers, créer un secret Databricks et le référencer par ressource/binding lorsque
la plateforme le permet. Ne placer ni valeur secrète dans `databricks.yml`, ni fallback secret dans le code. Documenter
le propriétaire, la rotation et le privilège minimal requis.
