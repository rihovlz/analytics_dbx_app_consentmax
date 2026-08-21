# Déploiement

## Une nouvelle application

1. Créer le repository via **Use this template**.
2. Cloner, créer une branche et exécuter `npm run init-app -- <nom>`.
3. Choisir le projet de données autorisé, déclarer les tables/vues dans `config/data-access.json`, puis exécuter
   `npm run data:access:render`.
4. Relire les placeholders remplacés dans `app.yaml`, `databricks.yml`, le manifeste de données et le workflow.
5. Vérifier le workspace prérempli `https://3070470996474403.3.gcp.databricks.com`, le warehouse `team-da-poc`
   (`ab362e9710498a08`), le projet/schema, les groupes, les sources et le chemin bundle.
6. Ouvrir une pull request, laisser la CI valider le manifeste, lint, types, tests et build, puis fusionner dans `main`.
7. Provisionner l'app une première fois afin que Databricks crée son service principal.
8. Ajouter à ce service principal un credential Git en lecture sur le repository privé.
9. Déclencher le workflow `Deploy Databricks App` et laisser le smoke distant vérifier les accès runtime.

Le credential Git ne peut pas être configuré avant l'étape de provisioning, car le service principal dédié n'existe
pas encore.

## Développement local

Le mode démo (`npm run dev`) n'utilise pas Databricks. Pour un test réel, configurer le profil OAuth U2M et les variables
non secrètes en suivant [local-development.md](local-development.md), puis lancer `npm run databricks:check` et
`npm run test:databricks`. Ne jamais utiliser le catalog de production pour tester une opération d'écriture.

## Target dev

Après authentification Databricks CLI et revue de la target, passer le profil explicitement :

```bash
npm run bundle:validate -- --target dev --profile valiuz-analytics-dev
npm run deploy -- --target dev --profile valiuz-analytics-dev
```

La target `dev` téléverse le checkout local. Cette commande crée ou modifie des ressources distantes et démarre l’app.

## Premier provisioning

Depuis une révision fusionnée et avec un profil autorisé à créer l'app et à accorder les bindings déclarés :

```bash
npm run app:provision -- --target prod --profile valiuz-analytics-dev
```

La commande affiche d'abord le workspace, la target, l'app, le commit, le warehouse, le projet, le schema et le nombre
de sources. Elle valide puis crée les ressources, sans démarrer l'app. Utiliser ensuite la page **Authorization** de
l'app pour identifier son service principal, et lui configurer un credential GitHub en lecture seule. Ne jamais placer
ce credential dans le repository, les variables non secrètes GitHub ou un log.

## Target prod et GitHub Actions

La target `prod` est Git-backed : Databricks Apps récupère le commit exact résolu par le workflow. Configurer l’environment
GitHub `databricks-production`, protéger ses approbateurs si nécessaire, puis définir ces **variables** :

| Variable | Valeur |
| --- | --- |
| `DATABRICKS_HOST` | `https://3070470996474403.3.gcp.databricks.com` par défaut |
| `DATABRICKS_CLIENT_ID` | service principal fédéré autorisé à déployer |
| `DATABRICKS_AUTO_DEPLOY` | `false` initialement ; `true` après validation du workflow manuel |

Le workflow utilise GitHub OIDC (`DATABRICKS_AUTH_TYPE=github-oidc`) : aucun client secret Databricks n’est stocké dans
GitHub. Créer la federation policy Databricks correspondant au repository, à la branche/environment et au service
principal. Le principal CI doit pouvoir gérer les ressources du bundle, sans droits de données inutiles.

Le workflow vérifie l’identité, valide le bundle, injecte le SHA du checkout dans `git_source.commit`, déploie, lance
la ressource app, puis attend l’état `RUNNING`. Un déclenchement manuel accepte une branche, un tag ou un SHA dans
`git_ref` ; la valeur est résolue et épinglée avant le déploiement.

## Smoke checks et rollback

Après déploiement :

1. appeler `GET /api/health` avec OAuth → `{ "status": "ok" }` ;
2. appeler `GET /api/readiness` : chaque source déclarée doit accepter la requête `SELECT ... WHERE FALSE` sans ligne
   retournée, avec l'identité de l'app ;
3. lancer la vérification de connexion depuis l’UI ;
4. contrôler les logs par `requestId` sans payload sensible ;
5. tester les permissions d’un utilisateur `CAN_USE` et d’un gestionnaire `CAN_MANAGE`.

Le workflow effectue automatiquement les deux premiers contrôles avec `npm run app:smoke`. En local, la même commande
accepte `--profile <profil>` ; le jeton OAuth reste en mémoire et n'est jamais affiché.

Pour revenir en arrière, utiliser le déclenchement manuel avec le SHA d'une révision connue, puis restaurer `main` par
une pull request. Le déploiement reste ainsi associé à un commit immuable. Ne pas modifier manuellement le code source
dans le workspace : cela rendrait l’état différent de Git.
