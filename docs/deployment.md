# Déploiement

## Une nouvelle application

1. Créer le repository via **Use this template**.
2. Cloner, créer une branche et exécuter `npm run init-app -- <nom>`.
3. Relire les placeholders remplacés dans `app.yaml`, `databricks.yml` et `.github/workflows/deploy.yml`.
4. Vérifier le workspace, le warehouse, le catalog/schema, les groupes et le chemin bundle.
5. Ajouter au service principal de l’app un credential Git en lecture sur le nouveau repository privé.
6. Ouvrir une pull request et laisser la CI valider lint, types, tests et build.
7. Fusionner dans `main`, puis déclencher le workflow `Deploy Databricks App`.

## Développement local

Le mode démo (`npm run dev`) n’utilise pas Databricks. Pour un test réel, créer `.env.local`, passer `APP_MODE` à
`databricks`, renseigner les variables locales et lancer `npm run test:databricks`. Ne jamais utiliser le catalog de
production pour tester une opération d’écriture.

## Target dev

Après authentification Databricks CLI et revue de la target :

```bash
npm run bundle:validate -- --target dev
npm run deploy -- --target dev
```

La target `dev` téléverse le checkout local. Cette commande crée ou modifie des ressources distantes et démarre l’app.

## Target prod et GitHub Actions

La target `prod` est Git-backed : Databricks Apps récupère la branche `main` depuis GitHub. Configurer l’environment
GitHub `databricks-production`, protéger ses approbateurs si nécessaire, puis définir ces **variables** :

| Variable | Valeur |
| --- | --- |
| `DATABRICKS_HOST` | URL HTTPS du workspace |
| `DATABRICKS_CLIENT_ID` | service principal fédéré autorisé à déployer |
| `DATABRICKS_AUTO_DEPLOY` | `false` initialement ; `true` après validation du workflow manuel |

Le workflow utilise GitHub OIDC (`DATABRICKS_AUTH_TYPE=github-oidc`) : aucun client secret Databricks n’est stocké dans
GitHub. Créer la federation policy Databricks correspondant au repository, à la branche/environment et au service
principal. Le principal CI doit pouvoir gérer les ressources du bundle, sans droits de données inutiles.

Le workflow vérifie l’identité, valide le bundle, le déploie, lance la ressource app, puis attend l’état `RUNNING`.

## Smoke checks et rollback

Après déploiement :

1. vérifier `GET /health` → `{ "status": "ok" }` ;
2. lancer la vérification de connexion depuis l’UI ;
3. contrôler les logs par `requestId` sans payload sensible ;
4. tester les permissions d’un utilisateur `CAN_USE` et d’un gestionnaire `CAN_MANAGE`.

Pour revenir en arrière, restaurer un commit connu sur `main` par une pull request puis redéployer cette révision. Ne
pas modifier manuellement le code source dans le workspace : cela rendrait l’état différent de Git.
