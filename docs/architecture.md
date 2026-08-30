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
- `src/components` contient le shell, les états et les visualisations génériques.
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

## Flux conversationnel Genie

`GenieChat` envoie une question et un contexte borné à une route Next.js. Le contexte contient les filtres, la période,
les métriques visibles, les tables actives et la page. Le serveur produit un texte déterministe avant l’appel à Genie.

```text
GenieChat
      ↓ question + contexte + alias
Route SSE avec withApiRoute
      ↓ jeton x-forwarded-access-token, serveur uniquement
Service Genie → client Conversation API
      ↓ statuts + texte + pièces jointes de requête
Table, BigNumberKPI ou graphique + SQL repliable
```

Le navigateur connaît uniquement l’alias du Space. Le serveur charge `config/genie-spaces.json`, puis résout la
variable d’environnement liée. Les modules sous `src/features/genie/server` isolent le jeton, le client HTTP, le
polling borné et la validation Zod des réponses.

Le template utilise une Route Handler Next.js, car il ne contient pas de runtime AppKit. Il n’ajoute aucun gateway IA.
La route exige du JSON de même origine avant de lire l’identité OBO. Le lecteur arrête le flux entrant au-delà de
64 Kio. Le contrat limite aussi la question à 10 000 caractères et le contexte sérialisé à 12 000 caractères.

Le `POST` de soumission est exécuté une seule fois. Seuls les `GET` de statut et de résultat sont retentés après une
erreur transitoire. Chaque lecture accepte cinq reprises au maximum. Le délai exponentiel de 1 à 5 secondes utilise un
jitter et respecte `Retry-After` jusqu’à 60 secondes. L’ensemble du polling expire après dix minutes.

En mode Databricks, un limiteur en mémoire accepte huit flux actifs par processus Node et deux par utilisateur. Les
variables `GENIE_MAX_CONCURRENT_STREAMS` et `GENIE_MAX_CONCURRENT_STREAMS_PER_USER` modifient ces valeurs. Elles
acceptent des entiers de 1 à 100, et la limite utilisateur ne peut pas dépasser la limite globale. Le mode démo ne
réserve aucun slot. Cette protection n’est pas distribuée entre plusieurs réplicas.

Le flux SSE transmet les statuts dès leur disponibilité. L’API Genie ne fournit pas de delta de texte. Le client
révèle donc la réponse finale progressivement. Des commentaires heartbeat gardent le flux actif pendant une attente.
Le mode de mouvement réduit affiche le texte sans cette transition.

L’arrêt du `fetch` navigateur termine seulement le suivi local. Il ne prouve pas que Databricks a annulé le traitement.
La session cliente devient non continuable et demande une nouvelle conversation. Dès l’envoi du `POST`, toute erreur
cliente, réseau ou de flux rend la création distante ambiguë. Le client interdit alors le rejeu. Seul un refus HTTP
explicite reçu avant le début du flux peut rester rejouable.

Le rendu Markdown ne crée jamais de balise d’image. Il active uniquement les liens HTTP(S), les chemins de même origine
qui commencent par un seul `/` et les fragments. Une destination refusée conserve son libellé sans `href`.

Le serveur expose seulement le premier chunk inline, avec une limite de 500 lignes. Le champ `truncated` signale un
résultat plus grand. Les liens de téléchargement signés ne passent jamais dans le navigateur.

Les contrats `PinnedGenieInsight` et `GenieConversationSnapshot` peuvent contenir la réponse, le SQL et les lignes
gouvernées. Ils ne fournissent aucun stockage partagé. Un stockage privé doit rester lié à l’utilisateur connecté.
Une composition partagée conserve la définition et relit les données avec l’identité de chaque lecteur.

Le mode démo utilise une fixture synthétique. Il couvre les statuts, le Markdown, le tableau, le graphique, le SQL et
l’épinglage sans contacter Databricks.

## Accompagnement et génération locale

`config/app-spec.yml` est la source de vérité courte du cadrage. `app:guide` la synchronise avec
`docs/product-brief.md`. Ensuite, `feature:new` génère une première tranche verticale. Le SQL généré accepte seulement
`count`, `sum` et `avg` sur une source déclarée. Le repository délimite chaque segment de l'identifiant avant le binding.

Ces scripts sont des outils de développement. Ils ne sont ni importés par le runtime Next.js ni exécutés au démarrage
de l'app. `app:doctor` contrôle leur cohérence et propose une prochaine action sans corriger ou déployer automatiquement.

## Contrat de version du template

`template/manifest.yml` définit les versions, les capabilities et les chemins de mise à niveau. Chaque capability
utilise des sondes locales. Une sonde contrôle un fichier, un marqueur de fichier ou une commande npm exacte.

`init-app` crée `.valiuz-template.yml`. Cet état contient la version de départ et les capabilities héritées. Il ne
contient aucune configuration Databricks, aucune donnée métier et aucun credential.

`template:status`, `template:check`, `template:diff` et `template:release:check` sont des outils de développement.
Next.js ne les importe pas. Databricks Apps ne les exécute pas au runtime. Le diff décrit une migration, mais il ne
modifie pas les fichiers.

Dans le repository source, `template:release:check` compare le checkout à une base Git. Un changement de comportement
doit augmenter la version, déclarer un chemin de migration et inclure la revue du README et du guide des versions. Une
app initialisée ignore ce bump : ses features métier ne changent pas la version du template dont elle est issue.

Le champ `sourceCommit` fournit un point historique pour chaque version. Il ne prouve pas qu'une app reste identique à
ce commit. Les sondes donnent le niveau de preuve local après les adaptations propres à l'app.

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

Les tokens `--chart-*` séparent les couleurs de tracé des couleurs de marque. Le token `--focus-ring` conserve un
focus visible dans chaque thème et dans la portée claire du header.

Le shell propose les thèmes clair, système et sombre. Le navigateur stocke le choix sous `analytics-theme`. Un script
du layout applique le choix explicite avant l’hydratation. Sans choix explicite, les tokens suivent
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

Une page serveur peut donc composer la bibliothèque. Les feuilles interactives s’exécutent côté client avec les
propriétés transmises par React Server Components. Elles n’importent ni configuration serveur, ni repository, ni
client Databricks.

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

La route `/visualizations` compose la démonstration côté serveur avec des données synthétiques. `demo-map-data.ts`
importe `server-only` et convertit le TopoJSON embarqué par `world-atlas` en GeoJSON. `page.tsx` transmet ensuite cette
collection à `VisualizationsDemo`. Cette route n’appelle aucune API et ne contacte pas Databricks.

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

Un contrat notebook peut limiter une reprise à une plage de dates. Une table temporaire fige la source du run. Le Job
valide le grain, puis remplace la plage atomiquement et par nom de colonne. Il garde une seule exécution concurrente.
Il applique aussi le timeout du contrat.

Une architecture hot/cold appartient à un data product si elle conserve des données après leur rétention source.
L'app conserve seulement un accès `SELECT` sur la sortie publiée.

## Erreurs et observabilité

Les logs Pino sont des lignes JSON avec `requestId`, nom de requête, durée et nombre de lignes. Les champs courants de
credentials sont redactés. Ne jamais ajouter un payload métier complet aux logs.

Les erreurs typées portent un code, un statut HTTP et un message utilisateur sûr. La cause technique est loggée côté
serveur et remplacée dans la réponse par `{ error: { code, message, requestId } }`.

`withApiRoute` transmet aussi les réponses SSE. Une erreur qui précède le flux utilise l’enveloppe JSON commune. Une
erreur qui suit le début du flux utilise un événement SSE typé avec le même `requestId`.

## Extension

Créer une feature avant de généraliser une abstraction. Extraire un module dans `src/lib` seulement lorsqu’il est sans
vocabulaire métier et qu’au moins deux features ont le même besoin. Les modules optionnels comme l’upload et les
exports restent hors du socle tant qu’une application ne les demande pas. Genie reste isolé dans sa feature.
