# Déploiement

## Une nouvelle application

1. Créer le repository via **Use this template**.
2. Cloner, exécuter `npm ci`, créer une branche et lancer `npm run init-app -- <nom>` une seule fois.
3. Exécuter `npm run app:guide`, puis choisir la source avec `npm run data:init -- <nom-source>`. Garder le mode
   `direct` si une table ou vue existante convient.
4. Créer la première tranche avec `npm run feature:new -- <slug>`, puis relire la spec, le brief, le SQL et les tests.
5. Vérifier le nom du mainteneur et le lien Slack affichés dans le header, puis relire les placeholders remplacés dans
   `app.yaml`, `databricks.yml`, le manifeste de données et le workflow.
6. Vérifier le workspace prérempli `https://3070470996474403.3.gcp.databricks.com`, le warehouse `team-da-poc`
   (`ab362e9710498a08`), le projet/schema, les groupes, les sources et le chemin bundle.
7. Lancer `npm run app:doctor` puis `npm run check`.
8. Ouvrir une pull request, laisser la CI valider le cadrage, les contrats data, lint, types, tests et build, puis
   fusionner dans `main`.
9. Pour un contrat `notebook` ou `pipeline`, exécuter la préparation depuis la révision fusionnée et vérifier que sa
   table de sortie existe.
10. Provisionner l'app une première fois afin que Databricks crée son service principal.
11. Ajouter à ce service principal un credential Git en lecture sur le repository privé.
12. Déclencher le workflow `Deploy Databricks App` et laisser le smoke distant vérifier les accès runtime.

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

Le raccourci accompagné affiche d'abord tous ses contrôles et s'arrête sans `--confirm` :

```bash
npm run preview:real -- --profile valiuz-analytics-dev
npm run preview:real -- --profile valiuz-analytics-dev --confirm
```

Il est limité à `dev`, exécute ensuite le préflight distant, déploie et lance les smokes. Ajouter `--prepare-data`
autorise aussi l'exécution de toutes les préparations notebook/pipeline déclarées ; ne pas l'ajouter pour une app en
lecture directe.

## Préparation data avant l'app

Une préparation `notebook` ou `pipeline` est un SQL d'écriture et utilise son propre mini-bundle. L'afficher puis
l'exécuter séparément avant le premier binding `SELECT` de l'app :

```bash
npm run data:prepare -- <contrat> --target dev --profile valiuz-analytics-dev
npm run data:prepare -- <contrat> --target dev --profile valiuz-analytics-dev --confirm
```

La première commande ne modifie rien. La seconde valide et déploie `data/databricks.yml`, exécute le Job puis laisse les
schedules en pause. Vérifier la sortie avant d'utiliser `--activate-schedule`. Le workflow applicatif ne redéploie pas
ce mini-bundle : pour une app interne mono-mainteneur, la préparation évolue explicitement lorsque son contrat ou son
SQL change.

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
