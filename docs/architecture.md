# Architecture

## Principes

Le template sépare le socle de plateforme des futures fonctionnalités métier. Une feature peut ajouter des pages, des
services et des repositories sans modifier l’authentification, le logging ou le client SQL. Les abstractions restent
volontairement courtes : une interface `SqlExecutor`, un wrapper HTTP et une taxonomie d’erreurs.

Le parcours de création utilise `config/appkit-capabilities.json` pour relier les usages aux capacités et aux skills amont.
`config/app-spec.yml` garde les capacités envisagées. Ce cadrage ne configure pas le runtime et ne crée aucune ressource.
Une intégration non SQL conserve route → service → repository/adaptateur, avec le contrat décrit dans
[le guide des capacités](appkit-capabilities.md). Les skills de développement restent séparés des éventuels agents exécutés dans l'app.

`app:orchestrate` compose les contrôles locaux, la spec et la présence des fichiers pour proposer une reprise.
Il ne modifie rien et n'exécute pas les commandes proposées. Le skill de création conduit ensuite les actions autorisées.
Les notes `docs/creation-progress.md` conservent les décisions et les résultats observés, sans servir de preuve automatique.
Les générateurs et le runtime ne dépendent pas de ces notes.

`npm run app` expose une entrée commune qui délègue aux commandes existantes, sans moteur de workflow supplémentaire.
`app prompt --idea <besoin>` couvre le parcours complet pour une personne. Les anciens `--role` restent des priorités facultatives.
Le champ `workflow` de `app next` expose les revues du besoin à la mise en service et les contrats data déclarés.
Il ne calcule aucun état de réussite depuis les notes ou la présence de fichiers. La revue KPI intervient dès la conception.
`app migrate` lit une ancienne app et les guides du checkout cible. Il n'exécute ni ses scripts ni un portage automatique.
Les inventaires statiques et versions déclarées restent à vérifier par l'agent. Voir [le parcours CLI](cli-workflow.md).

```text
Browser / React
      ↓ JSON agrégé
Express route + withApiRoute
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

ConsentMax utilise trois tranches métier : `consent-overview`, `alliance-contribution` et `missings`.
Chacune conserve sa page, son endpoint `/api/<feature>`, son service et ses repositories SQL.
La route `/` redirige vers `/consent-overview`. `/visualizations` reste disponible directement.
Le contexte `src/components/language/language-context.tsx` partage le choix FR/EN entre les pages et le
conserve sous `analytics-lang` dans le stockage local. Cette préférence ne contient aucune donnée métier.

- `src/client` compose les pages React. `src/server` expose les endpoints Express. Aucun de ces dossiers ne contient de SQL métier.
- `src/components` contient le shell, les états et les visualisations génériques.
- `src/features` contient les vertical slices fonctionnelles. Les modules sous `server/` ne sont importés que par le
  serveur.
- `src/lib` est le socle réutilisable. Il ne connaît aucun KPI, table ou vocabulaire métier.
- Une route valide son entrée, appelle un service et délègue le format d’erreur à `withApiRoute`.
- Un repository nomme la requête, lie les paramètres et valide les lignes retournées par Zod.

## Configuration et runtime

`parseAppDisplayConfig` lit uniquement le mode, le nom, la description et le contact.
`/api/config` ajoute les flags personnels et valide le contrat public strict avant transmission au navigateur.
Le build Vite ne lit pas les credentials. Le serveur valide la configuration avant le démarrage AppKit.

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
La variante `--date-column` utilise les contrats purs de `src/features/period-comparison`, tout en conservant le SQL
dans le repository généré. Deux fenêtres bornées alimentent les valeurs, séries et contributions facultatives.
`--breakdown-column` ajoute une segmentation disjointe ; le waterfall automatique est limité aux mesures additives.
La route `/api/period-comparison/demo` appelle un service synthétique, sans accès Databricks.
Voir [le contrat de comparaison](period-comparison.md), ses limites et ses critères de complétude.

Le partage facultatif reste dans `src/features/period-comparison`.
`sharing.ts` valide la définition versionnée, construit le lien et prépare la synthèse du résultat affiché.
`comparison-sharing.tsx` fournit le panneau et les actions de copie.
Le fragment du lien contient seulement les périodes résolues et le filtre autorisé pour une vue connue.
L'ouverture valide la définition avant d'appeler l'API habituelle. Elle conserve les accès de cette API et recalcule les données courantes.
Un lien invalide ne déclenche pas de résultat par défaut. Aucun résultat n'est stocké par le partage.
La synthèse copiée reste un texte daté, avec les réserves du résultat et un lien de reprise.
Les contrats d'état personnel restent distincts de cette définition.

Ces scripts sont des outils de développement. Ils ne sont ni importés par le runtime AppKit ni exécutés au démarrage
de l'app. `app:doctor` contrôle leur cohérence et propose une prochaine action sans corriger ou déployer automatiquement.

## Contrat de version du template

`template/manifest.yml` définit les versions, les capabilities et les chemins de mise à niveau. Chaque capability
utilise des sondes locales. Une sonde contrôle un fichier, un marqueur de fichier ou une commande npm exacte.

`init-app` crée `.valiuz-template.yml`. Cet état contient la version de départ et les capabilities héritées. Il ne
contient aucune configuration Databricks, aucune donnée métier et aucun credential.

`template:status`, `template:check`, `template:diff` et `template:release:check` sont des outils de développement.
Le runtime ne les importe pas. Databricks Apps ne les exécute pas au runtime. Le diff décrit une migration, mais il ne
modifie pas les fichiers.

Dans le repository source, `template:release:check` compare le checkout à une base Git. Un changement de comportement
doit augmenter la version, déclarer un chemin de migration et inclure la revue du README et du guide des versions. Une
app initialisée ignore ce bump : ses features métier ne changent pas la version du template dont elle est issue.

Le champ `sourceCommit` fournit un point historique pour chaque version. Il ne prouve pas qu'une app reste identique à
ce commit. Les sondes donnent le niveau de preuve local après les adaptations propres à l'app.

## Shell Valiuz et contact

`AppShell` compose le header, la navigation et le contenu sans connaître le métier. Le header utilise le SVG canonique
`public/valiuz-logo-icon.svg` ; `public/favicon.svg` contient le même média et `index.html` l'associe à l'onglet
avec le nom de l'app chargé depuis `/api/config`.

Le contact Slack est une configuration publique transmise au shell. `APP_SUPPORT_NAME` nomme le
mainteneur ou l'équipe et `APP_SUPPORT_SLACK_URL` accepte uniquement une URL HTTPS du workspace
`valiuz.slack.com`. Le shell ouvre ce lien dans un nouvel onglet ; il n'embarque ni token Slack ni logique métier. Le
contact FRAIM est prérempli comme point de départ, puis remplacé par `init-app` lorsque l'équipe choisit son support.

Les couleurs et la typographie sont centralisées dans `globals.css` et `tailwind.config.ts`. Le shell auto-héberge
Outfit, conserve l'icône Valiuz à sa taille numérique minimale et réserve le gradient à une ligne ou une forme
d'accent. Les règles applicables aux pages métier et aux graphiques sont documentées dans `docs/design-system.md`.

Les tokens `--chart-*` séparent les couleurs de tracé des couleurs de marque. Le token `--focus-ring` conserve un
focus visible dans chaque thème et dans la portée claire du header.

Le shell propose les thèmes clair, système et sombre. Le navigateur stocke le choix sous `analytics-theme`. Un script
dans `index.html` applique le choix explicite avant le premier rendu React. Sans choix explicite, les tokens suivent
`prefers-color-scheme`.

Le header reste dans la portée claire `brand-header-surface` pour protéger le contraste du logo officiel. Le reste de
l’application utilise les tokens du thème actif.

## Bibliothèque de visualisation

`src/components/data-visualization/index.ts` est le point d’entrée public. Il exporte les composants, les types d’état,
les tons et les fonctions de formatage.

```text
Page ou feature serveur
  → données et formats sérialisables
  → @/components/data-visualization
  → feuilles interactives clientes
  → cards + kpi + charts + maps
  → Framer Motion + Recharts + D3 Geo
```

Les dossiers ont des responsabilités distinctes :

- `cards` fournit la surface `DataCard`.
- `kpi` fournit les grands nombres, les tendances, les jauges et les grilles de métriques.
- `charts` fournit les sparklines, les séries temporelles et les états partagés.
- `maps` fournit la carte SVG choroplèthe, les repères, le zoom et le tableau accessible.
- `data-visualization` fournit le point d’entrée public, les types et le formatage.

`NumberFormat` décrit les options de `Intl.NumberFormat`. `AxisValueFormat` décrit un axe texte, numérique ou date.
Ces formats contiennent uniquement des données sérialisables. L’API ne déclare aucune prop de callback.

Les pages React composent la bibliothèque avec les données de leurs APIs.
Elles n’importent ni configuration serveur, ni repository, ni client Databricks.

Le type `VisualizationState` distingue `ready`, `loading`, `empty` et `error`. Les composants utilisent `ready` par
défaut. Les états vide et erreur restent des contrats d’interface. Ils ne modifient pas l’enveloppe des routes API.

Recharts dessine les graphiques adaptatifs. Framer Motion gère les transitions et interroge
`prefers-reduced-motion`. Les graphiques temporels fournissent un tableau repliable avec les valeurs exactes.

`AnalyticsMap` reçoit une `FeatureCollection` GeoJSON et des valeurs indexées par zone. D3 Geo projette les formes dans
un SVG local. La carte ne charge aucune tuile, ne demande aucun token et ne fait aucun appel réseau au runtime.

La carte répartit ses responsabilités entre plusieurs fichiers internes :

- `analytics-map.tsx` orchestre l’état client et expose `AnalyticsMap`.
- `types.ts` contient les propriétés publiques et les contrats internes.
- `map-geometry.ts` calcule les projections, les formes, les repères et les lignes du tableau.
- `map-ui.tsx` dessine les couches SVG, les états, les infobulles, les contrôles et le tableau.
- `use-element-width.ts` adapte le SVG avec `ResizeObserver`.

Le SVG, les contrôles de zoom et les repères acceptent le focus clavier. Une vue agrandie se déplace avec les flèches
ou par glisser au pointeur. Les régions restent hors de l’ordre de tabulation. Le tableau repliable donne les valeurs
exactes de chaque région et de chaque repère.

La page `/visualizations` charge des données synthétiques via `/api/visualizations`.
Le module serveur `visualization-demo.ts` convertit le TopoJSON embarqué par `world-atlas` en GeoJSON.
La page transmet cette collection à `VisualizationsDemo`. Aucun appel Databricks n’est nécessaire.

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
donner des droits d'écriture analytiques au service principal de l'app. Un contrat `direct` ne génère aucune ressource. Les modes
`notebook` et `pipeline` restent adaptés aux transformations propres à l'app ; une donnée partagée par plusieurs apps
doit être maintenue dans un data product distinct.

Un contrat notebook peut limiter une reprise à une plage de dates. Une table temporaire fige la source du run. Le Job
valide le grain, puis remplace la plage atomiquement et par nom de colonne. Il garde une seule exécution concurrente.
Il applique aussi le timeout du contrat.

Une architecture hot/cold appartient à un data product si elle conserve des données après leur rétention source.
L'app conserve seulement un accès `SELECT` sur la sortie publiée.

## Erreurs et observabilité

Les logs Pino sont des lignes JSON avec `requestId`, nom de requête, durée et nombre de lignes. Les champs courants de
credentials sont redactés. Ne jamais ajouter un payload métier complet aux logs.

Les erreurs typées portent un code, un statut HTTP et un message utilisateur sûr. Le wrapper journalise les métadonnées
sûres (nom, code, méthode, chemin) sans cause brute, puis répond avec `{ error: { code, message, requestId } }`.

`withApiRoute` attend aussi les écritures SSE. Une erreur qui précède le flux utilise l’enveloppe JSON commune.
Une exception non traitée après les en-têtes annule le travail associé et ferme la connexion ; elle n’ajoute pas une réponse JSON au flux.

## Extension

Créer une feature avant de généraliser une abstraction. Extraire un module dans `src/lib` seulement lorsqu’il est sans
vocabulaire métier et qu’au moins deux features ont le même besoin. Les modules optionnels comme l’upload et les
exports restent hors du socle tant qu’une application ne les demande pas.

## État personnel optionnel

`src/features/user-state` regroupe contrats, composants, service, repository et requêtes. Les routes personnelles
utilisent `withApiRoute` et imposent `private, no-store` sur les succès et les erreurs. L’identité est résolue côté
serveur depuis le proxy Databricks ; aucune valeur owner du navigateur n’est acceptée.

Deux tables Delta déclarées séparément des sources analytiques reçoivent les écritures. Elles stockent des versions
de définitions et préférences, sans résultat analytique. La résolution par horodatage/UUID ne fournit pas de CAS.
Le shell lit le flag runtime depuis `/api/config`. Voir [les contrats et limites](user-state.md).

## Runtime AppKit

`src/server/index.ts` démarre les plugins AppKit. Le serveur garde un seul `app.yaml`.
Les routes React sont enregistrées dans `src/client/routes.tsx`. Les APIs sont enregistrées dans `src/server/routes.ts`.
`withApiRoute` produit directement un handler Express. Son callback reçoit `(request, context, response)`.
Il retourne une valeur JSON ou attend l’écriture dans `response`. Les paramètres et le corps viennent d’Express.
`context.signal` suit la déconnexion. Le SSE écrit directement dans la réponse et respecte la contre-pression.
La fermeture du navigateur annule le suivi serveur.
Le serveur standard AppKit utilise son parseur JSON borné à 64 Kio. L’état personnel borne aussi le JSON sérialisé
à 16 Kio. Les erreurs du parseur passent par l’enveloppe sûre commune. Aucun accès au champ privé `serverApplication`
n’est nécessaire. Le recorder UI automatique reste désactivé.

Le plugin Vite refuse les imports de modules serveur dans le graphe navigateur.
Les modules partagés ne lisent ni environnement, ni fichiers, ni credentials.
`SqlExecutor` utilise AppKit analytics pour les lectures compatibles. Le repository personnel conserve son driver privé.
Les deux transports reçoivent les paramètres nommés du repository sans réécriture du SQL.
Les [exceptions documentées](appkit-maintenance.md) précisent les limites upstream et leurs critères de retrait.
