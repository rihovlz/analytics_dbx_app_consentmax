# Databricks App Template

![Databricks App Boilerplate — de la copie du repository au déploiement](docs/assets/databricks-app-boilerplate.png)

Golden path Next.js/TypeScript pour construire des Databricks Apps analytics. Il fournit un shell UI neutre, une
configuration validée, une couche Databricks SQL centralisée, des erreurs publiques sûres, des logs structurés, des
tests et un déploiement reproductible avec Databricks Asset Bundles.

## Quick Start

Prérequis : Node.js 22.16+, npm et Git. Aucun accès Databricks n’est requis pour le mode démo.

```bash
git clone https://github.com/valiuz/analytics_dbx_app_template.git my-new-app
cd my-new-app
npm run init-app -- my-new-app
cp .env.example .env.local
npm ci
npm run dev
```

Ouvrir <http://localhost:3000>. Le mode démo est explicite et n’effectue aucun appel distant.

## Workflows d'assistance

Le repository fournit des workflows compatibles avec le standard ouvert Agent Skills :

| Skill | Usage |
| --- | --- |
| `create-analytics-dbx-app` | Créer le repository Valiuz, initialiser le clone et cadrer progressivement données, KPI, requêtes et fonctionnalités |
| `github-engineer` | Isoler une tâche dans une branche ou un worktree, publier une pull request et nettoyer prudemment le travail fusionné |
| `review-analytics-app-docs` | Comparer README, runbooks, manifests et workflows au code et à la configuration réels |

Depuis un checkout du template, demander à l'assistant d'utiliser le skill correspondant. Le bootstrap pose au maximum
trois questions à la fois. Toute mutation GitHub ou Databricks demande une autorisation explicite.

## Infrastructure Valiuz préremplie

Le bootstrap propose les valeurs partagées déjà utilisées par l’app FRAIM :

| Ressource | Valeur par défaut |
| --- | --- |
| Workspace Databricks | `https://3070470996474403.3.gcp.databricks.com` |
| SQL Warehouse | `team-da-poc` (`ab362e9710498a08`) |
| Permission du binding warehouse | `CAN_USE` |

Avec `npm run init-app -- <nom>`, accepter ces deux valeurs pour cibler l’infrastructure partagée, ou utiliser
`--host` et `--warehouse` pour les remplacer. Le catalog, le schema et les groupes d’accès restent propres à chaque
application. `CAN_USE` sur le binding autorise l’identité de l’app à utiliser le warehouse ; les privilèges Unity
Catalog et l’accès des utilisateurs à l’app restent à configurer séparément.

## Configuration

La configuration serveur est validée au démarrage dans `src/lib/config/server-config.ts`.

| Variable | Local démo | Local Databricks | Databricks Apps |
| --- | --- | --- | --- |
| `APP_MODE` | `demo` | `databricks` | `databricks` via `app.yaml` |
| `DATABRICKS_HOST` | non | oui | injectée par Databricks |
| `DATABRICKS_TOKEN` | non | oui | jamais utilisée |
| `DATABRICKS_CLIENT_ID` / `DATABRICKS_CLIENT_SECRET` | non | non | injectées par Databricks |
| `DATABRICKS_SQL_WAREHOUSE_ID` | non | oui | binding `valueFrom` |
| `DATABRICKS_CATALOG` / `DATABRICKS_SCHEMA` | non | oui | `app.yaml` |

Copier `.env.example` vers `.env.local`. Ne jamais committer `.env.local`, un token ou un secret client. Pour tester
une vraie connexion locale, renseigner un token court terme puis exécuter `npm run test:databricks`.

## Commandes

| Commande | Usage |
| --- | --- |
| `npm run dev` | serveur local avec rechargement |
| `npm run lint` | lint Next.js/TypeScript |
| `npm run typecheck` | vérification TypeScript stricte |
| `npm test` | tests unitaires Node |
| `npm run build` | build standalone de production |
| `npm run check` | toutes les validations locales |
| `npm run bundle:validate` | validation du bundle Databricks |
| `npm run deploy -- --target dev` | validate, déploie et démarre l’app |

`npm run deploy` modifie des ressources distantes. Vérifier le profil, le workspace, la target et les variables avant
de l’exécuter.

## Structure du repository

```text
src/app/                         pages, layouts et routes HTTP
src/components/                  shell et états UI génériques
src/features/<feature>/          UI, contrat et logique applicative d’une feature
src/features/<feature>/server/   queries, repository et service server-only
src/lib/config/                  parsing et validation de l’environnement
src/lib/databricks/              authentification et exécution SQL
src/lib/errors/                  taxonomie d’erreurs
src/lib/http/                    wrapper des routes API
src/lib/logging/                 logs JSON et contexte de requête
tests/                           tests unitaires sans Databricks
scripts/                         bootstrap, packaging et déploiement
docs/                            architecture et runbooks
```

La boundary attendue est : `UI → service de feature → repository → SqlExecutor → Databricks SQL / Unity Catalog`.

## Ajouter une feature

1. Créer `src/features/<nom>/` avec son contrat et son composant.
2. Placer la logique métier dans `server/service.ts`.
3. Placer l’accès aux données dans `server/repository.ts`.
4. Exposer le service par une route `src/app/api/.../route.ts` avec `withApiRoute`.
5. Ajouter des tests avec un `SqlExecutor` factice, puis lancer `npm run check`.

Les composants client ne doivent importer ni la configuration serveur, ni le driver Databricks, ni des credentials.

## Ajouter une requête SQL

Déclarer la requête courte et paramétrée dans `queries.ts`, l’exécuter depuis le repository avec un nom stable et
valider chaque ligne avec Zod. Ne pas interpoler d’entrée utilisateur dans le SQL. Pour une requête longue, utiliser
un fichier `.sql` voisin du repository et documenter son contrat d’entrée/sortie.

L’exemple `SELECT current_user()` se trouve dans `src/features/connection-check/server/`.

## Déploiement

Le chemin recommandé est `branche → pull request → CI → merge main → déploiement Databricks`. Le bundle possède :

- une target `dev` basée sur les fichiers locaux ;
- une target `prod` Git-backed sur la branche `main` ;
- un binding SQL Warehouse avec permission `CAN_USE` ;
- des permissions `CAN_USE` et `CAN_MANAGE` paramétrables.

Après `init-app`, relire `databricks.yml` et `app.yaml`, puis suivre [docs/deployment.md](docs/deployment.md). La GitHub
Action de déploiement utilise OIDC et des variables GitHub, sans secret Databricks committé. L’auto-déploiement reste
désactivé tant que `DATABRICKS_AUTO_DEPLOY` n’est pas `true`.

## Troubleshooting

- `INVALID_CONFIGURATION` : vérifier `APP_MODE` et les variables listées au démarrage.
- L’app locale affiche « mode démo » : passer explicitement `APP_MODE=databricks` pour interroger le warehouse.
- `SQL_QUERY_FAILED` : utiliser le `requestId` affiché pour retrouver le log serveur ; le SQL et les credentials ne sont
  jamais renvoyés au navigateur.
- Le build local utilise une mauvaise version Node : exécuter `nvm use` puis `npm ci`.
- Le déploiement Git-backed ne lit pas GitHub : ajouter un credential Git au service principal de l’app.
- Le bundle refuse des placeholders : relancer `npm run init-app -- <nom>` puis relire les valeurs.

Voir aussi [architecture](docs/architecture.md), [Databricks](docs/databricks.md), [déploiement](docs/deployment.md) et
[AGENTS.md](AGENTS.md).
