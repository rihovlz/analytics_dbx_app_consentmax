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

`parseAppDisplayConfig` lit uniquement le mode, le nom, la description et le contact. Next.js peut utiliser cette
configuration pendant le build sans credentials Databricks.

`parseServerConfig` accepte les modes `demo` et `databricks`. Le mode `databricks` refuse une variable runtime
manquante. En local, il utilise en priorité un jeton OAuth U2M fourni par un profil Databricks CLI. Un PAT court terme
reste un fallback explicite. Dans Databricks Apps, `DATABRICKS_APP_NAME` active OAuth M2M avec les credentials injectés.

`/health` reste un probe superficiel et ne réveille pas le warehouse. `/api/connection-check` teste explicitement le
chemin Databricks. `/api/readiness` vérifie en plus, avec l'identité runtime, un accès `SELECT` sans ligne retournée sur
chaque source déclarée dans `config/data-access.json`. Ces usages ont ainsi des coûts et des sémantiques distincts.

## Accompagnement et génération locale

`config/app-spec.yml` est la source de vérité courte du cadrage. `app:guide` la synchronise avec
`docs/product-brief.md`. Ensuite, `feature:new` génère une première tranche verticale. Le SQL généré accepte seulement
`count`, `sum` et `avg` sur une source déclarée. Le repository délimite chaque segment de l'identifiant avant le binding.

Ces scripts sont des outils de développement. Ils ne sont ni importés par le runtime Next.js ni exécutés au démarrage
de l'app. `app:doctor` contrôle leur cohérence et propose une prochaine action sans corriger ou déployer automatiquement.

## Shell Valiuz et contact

`AppShell` compose le header, la navigation et le contenu sans connaître le métier. Le header utilise le SVG canonique
`public/valiuz-logo-icon.svg` ; `public/favicon.svg` contient le même média et `generateMetadata` l'associe à l'onglet
avec le nom de l'app.

Le contact Slack est une configuration publique transmise au shell. `APP_SUPPORT_NAME` nomme le
mainteneur ou l'équipe et `APP_SUPPORT_SLACK_URL` accepte uniquement une URL HTTPS du workspace
`valiuz.slack.com`. Le shell ouvre ce lien dans un nouvel onglet ; il n'embarque ni token Slack ni logique métier. Le
contact FRAIM est prérempli comme point de départ, puis remplacé par `init-app` lorsque l'équipe choisit son support.

Les couleurs et la typographie sont centralisées dans `globals.css` et `tailwind.config.ts`. Le shell auto-héberge
Outfit, conserve l'icône Valiuz à sa taille numérique minimale et réserve le gradient à une ligne ou une forme
d'accent. Les règles applicables aux pages métier et aux graphiques sont documentées dans `docs/design-system.md`.

## Préparation data optionnelle

La lecture directe reste le défaut. Lorsqu'une table dédiée est nécessaire, les contrats sous `data/contracts/`
pilotent un mini-bundle séparé :

```text
identité du mainteneur
  → data/databricks.yml
  → notebook SQL ou pipeline Lakeflow
  → table préparée dans le projet choisi

identité de l'app
  → SQL Warehouse
  → SELECT sur la table préparée
```

Cette séparation permet de créer la table avant que le bundle applicatif ne lui attribue `SELECT`. Elle évite aussi de
donner des droits d'écriture au service principal de l'app. Un contrat `direct` ne génère aucune ressource. Les modes
`notebook` et `pipeline` restent adaptés aux transformations propres à l'app ; une donnée partagée par plusieurs apps
doit être maintenue dans un data product distinct.

## Erreurs et observabilité

Les logs Pino sont des lignes JSON avec `requestId`, nom de requête, durée et nombre de lignes. Les champs courants de
credentials sont redactés. Ne jamais ajouter un payload métier complet aux logs.

Les erreurs typées portent un code, un statut HTTP et un message utilisateur sûr. La cause technique est loggée côté
serveur et remplacée dans la réponse par `{ error: { code, message, requestId } }`.

## Extension

Créer une feature avant de généraliser une abstraction. Extraire un module dans `src/lib` seulement lorsqu’il est sans
vocabulaire métier et qu’au moins deux features ont le même besoin. Les modules optionnels (upload, charts, Genie,
exports) doivent rester hors du socle tant qu’une application ne les demande pas.
