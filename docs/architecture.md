# Architecture

## Principes

Le template sépare le socle de plateforme des futures fonctionnalités métier. Une feature peut ajouter des pages, des
services et des repositories sans modifier l’authentification, le logging ou le client SQL. Les abstractions restent
volontairement courtes : une interface `SqlExecutor`, un wrapper HTTP et une taxonomie d’erreurs.

```text
Browser / React
      ↓ JSON agrégé
Next.js route + withApiRoute
      ↓
Feature service (orchestration métier)
      ↓
Feature repository (contrat de données + requêtes)
      ↓
SqlExecutor (auth, session, timeout, row validation)
      ↓
Databricks SQL Warehouse → Unity Catalog
```

## Boundaries

- `src/app` compose les pages et expose les endpoints ; aucune requête SQL n’y vit.
- `src/components` contient uniquement des composants génériques.
- `src/features` contient les vertical slices fonctionnelles. Les modules sous `server/` ne sont importés que par le
  serveur.
- `src/lib` est le socle réutilisable. Il ne connaît aucun KPI, table ou vocabulaire métier.
- Une route valide son entrée, appelle un service et délègue le format d’erreur à `withApiRoute`.
- Un repository nomme la requête, lie les paramètres et valide les lignes retournées par Zod.

## Configuration et runtime

`parseServerConfig` accepte deux modes. `demo` est credential-free et déterministe. `databricks` échoue immédiatement
si une variable obligatoire manque. En local, il utilise en priorité un jeton OAuth U2M éphémère fourni par un profil
Databricks CLI ; un PAT court terme reste un fallback explicite. Dans Databricks Apps, la présence de
`DATABRICKS_APP_NAME` force OAuth M2M avec les credentials injectés par la plateforme.

`/health` reste un probe superficiel et ne réveille pas le warehouse. `/api/connection-check` teste explicitement le
chemin Databricks. `/api/readiness` vérifie en plus, avec l'identité runtime, un accès `SELECT` sans ligne retournée sur
chaque source déclarée dans `config/data-access.json`. Ces usages ont ainsi des coûts et des sémantiques distincts.

## Erreurs et observabilité

Les logs Pino sont des lignes JSON avec `requestId`, nom de requête, durée et nombre de lignes. Les champs courants de
credentials sont redactés. Ne jamais ajouter un payload métier complet aux logs.

Les erreurs typées portent un code, un statut HTTP et un message utilisateur sûr. La cause technique est loggée côté
serveur et remplacée dans la réponse par `{ error: { code, message, requestId } }`.

## Extension

Créer une feature avant de généraliser une abstraction. Extraire un module dans `src/lib` seulement lorsqu’il est sans
vocabulaire métier et qu’au moins deux features ont le même besoin. Les modules optionnels (upload, charts, Genie,
exports) doivent rester hors du socle tant qu’une application ne les demande pas.
