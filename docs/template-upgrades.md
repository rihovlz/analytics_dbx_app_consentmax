# Versions et mises à niveau du template

## Contrat

`template/manifest.yml` est la source de vérité pour la version du template. Il déclare les versions, les capabilities
et les guides de mise à niveau. La version de `package.json` reste propre à l'application.

Une capability décrit un contrat observable. Ses sondes contrôlent des fichiers, des marqueurs ou des commandes npm.
`npm run template:check` échoue si une capability déclarée ne correspond pas au checkout.

`init-app` crée `.valiuz-template.yml`. Ce fichier appartient à l'app générée et doit rester dans Git. Il ne contient
ni credential, ni configuration du workspace, ni donnée métier.

## Versions disponibles

| Version | Point historique | Contenu |
| --- | --- | --- |
| `1.0.0` | `05d914c6863c92304b1bc662e40c17e0f97b2c29` | Parcours guidé, accès déclarés, préparation optionnelle, shell Valiuz et bundle Databricks |
| `1.1.0` | `5df063bd0dc7b3664f1bf2cbe624119ddf5568ac` | Compatibilité de déploiement, parcours consommateur propre et suivi de version |

Le point historique sert à expliquer le changement. Le manifeste et ses sondes définissent le contrat réel de la
version. Ils acceptent les adaptations métier qui conservent ce contrat.

## Nouvelle app

Initialiser l'app, puis afficher son état :

```bash
npm run init-app -- <nom>
npm run template:status
npm run template:check
```

Une nouvelle app reçoit la version `1.1.0`. `npm run check` inclut aussi `template:check`.

## App copiée avant le suivi de version

Créer une pull request dédiée à l'adoption du manifeste. Copier `template/`, `scripts/template-manifest.mjs` et
`scripts/template-status.mjs`. Ajouter aussi les trois commandes `template:*` de `package.json`.

Contrôler la baseline `1.0.0` avant de créer l'état :

```bash
npm run template:check -- --to 1.0.0
```

Si ce contrôle réussit, créer `.valiuz-template.yml` avec ce contenu :

```yaml
schemaVersion: 1
template:
  id: valiuz/analytics_dbx_app_template
  repository: https://github.com/valiuz/analytics_dbx_app_template
  version: 1.0.0
capabilities:
  - guided-app-workflow
  - declared-data-access
  - optional-data-preparation
  - valiuz-app-shell
  - databricks-app-bundle
appliedUpgrades: []
```

Si le contrôle échoue, ne déclarez pas cette baseline. Examinez les écarts et choisissez la dernière version réellement
présente dans l'app.

## Passage de 1.0.0 à 1.1.0

Afficher le guide sémantique :

```bash
npm run template:diff -- --from 1.0.0 --to 1.1.0
```

Appliquer les changements guidés dans une branche dédiée. Conserver les choix métier et les contrats de données de
l'app. Puis contrôler les capabilities cibles :

```bash
npm run template:check -- --to 1.1.0
```

Si ce contrôle réussit, modifier `.valiuz-template.yml` :

- Remplacer `version: 1.0.0` par `version: 1.1.0`.
- Ajouter les capabilities `databricks-deployment-compatibility`, `clean-template-consumer-journey` et
  `template-version-tracking`.
- Ajouter `1.0.0-to-1.1.0` à `appliedUpgrades`.

Exécuter ensuite les validations locales :

```bash
npm run template:status
npm run app:doctor
npm run check
```

## Limites du MVP

Le MVP ne télécharge aucun fichier et ne crée aucune pull request. Il ne fusionne pas automatiquement les changements
du template dans une app. Cette limite protège les features, les requêtes et les choix de déploiement propres à l'app.

Le manifeste utilise le versionnage sémantique :

- Une version patch corrige le contrat sans ajouter de capability.
- Une version minor ajoute une capability compatible avec le parcours existant.
- Une version major exige une migration qui peut modifier le contrat d'une app.
