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
| `1.2.0` | `a1ed6bc333c8b8355641b17f74fe3ed0fb200815` | Historisation à coût borné et gouvernance automatique des releases et de la documentation |
| `1.3.0` | `08058f189790546146dabec88a6a0897568b55e9` | Visualisations analytics réutilisables, page de démonstration et modes clair/sombre |

Le point historique est le SHA complet de la branche de base examinée pour préparer la version. Il sert à borner le
diff, pas à reproduire seul le checkout final. Le manifeste et ses sondes définissent le contrat réel de la version.
Ils acceptent les adaptations métier qui conservent ce contrat.

## Nouvelle app

Initialiser l'app, puis afficher son état :

```bash
npm run init-app -- <nom>
npm run template:status
npm run template:check
```

Une nouvelle app reçoit la version `1.3.0`. `npm run check` inclut `template:check` et
`template:release:check`. Le second reconnaît une app initialisée et n'exige aucun bump pour ses features métier.

## App copiée avant le suivi de version

Créer une pull request dédiée à l'adoption du manifeste. Copier `template/`, `scripts/template-manifest.mjs`,
`scripts/template-status.mjs` et `scripts/check-template-release.mjs`. Ajouter aussi les commandes `template:*` de
`package.json`.

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

Une app `1.0.0` applique ensuite séparément les guides `1.1.0 → 1.2.0`, puis `1.2.0 → 1.3.0`.
`template:status` propose la prochaine étape disponible au lieu de sauter une migration intermédiaire.

## Passage de 1.1.0 à 1.2.0

Afficher le guide sémantique :

```bash
npm run template:diff -- --from 1.1.0 --to 1.2.0
```

Appliquer les changements guidés sans remplacer les contrats data ou les adaptations métier de l'app. La reprise
`bounded-replace` reste optionnelle à l'usage, mais ses garde-fous et son skill font partie du contrat `1.2.0`.

Contrôler les capabilities avant de modifier l'état :

```bash
npm run template:check -- --to 1.2.0
```

Si ce contrôle réussit, modifier `.valiuz-template.yml` :

- Remplacer `version: 1.1.0` par `version: 1.2.0`.
- Ajouter `cost-aware-data-history` et `feature-release-governance` aux capabilities.
- Ajouter `1.1.0-to-1.2.0` à `appliedUpgrades`.

Exécuter ensuite `npm run template:status`, `npm run app:doctor` et `npm run check`.

## Passage de 1.2.0 à 1.3.0

Afficher le guide sémantique :

```bash
npm run template:diff -- --from 1.2.0 --to 1.3.0
```

Appliquer les changements guidés sans remplacer les composants métier, la navigation ou les styles propres à l'app.
Installer les dépendances avec npm afin de fusionner correctement `package.json` et `package-lock.json`. Les composants
restent génériques : l'app leur transmet des données déjà agrégées et ne leur donne accès à aucun credential ou module
serveur. La route `/visualizations` utilise uniquement des données synthétiques. Si l'app possède déjà cette route,
fusionner la démonstration avec la page existante au lieu de l'écraser.

Contrôler la capability avant de modifier l'état :

```bash
npm run template:check -- --to 1.3.0
```

Si ce contrôle réussit, modifier `.valiuz-template.yml` :

- Remplacer `version: 1.2.0` par `version: 1.3.0`.
- Ajouter `reusable-analytics-visualizations` aux capabilities.
- Ajouter `1.2.0-to-1.3.0` à `appliedUpgrades`.

Exécuter ensuite `npm run template:status`, `npm run app:doctor` et `npm run check`. Vérifier visuellement
`/visualizations` en modes clair et sombre, au clavier, sur mobile et avec un zoom navigateur à 200 %.

## Préparer la version après une feature du template

`AGENTS.md` demande automatiquement les skills `prepare-template-release` et `review-analytics-app-docs` après un
changement de comportement, de configuration, de workflow ou de skill partagé. Il n'est pas nécessaire de les nommer
dans chaque session.

Le contrôle déterministe utilise la branche ou le SHA de base :

```bash
npm run template:release:check -- --base origin/main
```

Il vérifie le bump SemVer, le `sourceCommit`, les capabilities, le guide direct, `README.md` et ce document. La CI lui
transmet le SHA de base de la pull request ou du push. Par prudence, toute modification hors `README.md`, `docs/` et
`tests/` demande une release ; le manifeste lui-même appartient au contrat. Le contrôle ne crée aucun commit, tag,
pull request ou release.

## Limites du MVP

Le MVP ne télécharge aucun fichier et ne crée aucune pull request. Il ne fusionne pas automatiquement les changements
du template dans une app. Cette limite protège les features, les requêtes et les choix de déploiement propres à l'app.

Le manifeste utilise le versionnage sémantique :

- Une version patch corrige le contrat sans ajouter de capability.
- Une version minor ajoute une capability compatible avec le parcours existant.
- Une version major exige une migration qui peut modifier le contrat d'une app.
