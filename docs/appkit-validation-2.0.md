# Validation AppKit 2.0 — 23 septembre 2026

Base examinée : `8b779bcb363a7c57bdea12342964601d0acdfef4` (template 1.5.0).
Décision : **major 2.0.0**, car les routes, le chargement des pages et le runtime changent.
Packages AppKit et AppKit UI : `0.76.1`. Node.js : `22.16.0`.

## Vérifications locales

| Commande | Résultat |
| --- | --- |
| `npm run check` | Capabilities, release, configuration, lint, types, tests et build validés |
| `npm test` | 170 tests réussis, sans credential ni donnée distante |
| `APP_MODE=databricks npm run build` | Build sans credentials runtime réussi |
| `npm run test:e2e` | 13 parcours Chromium réussis sur le serveur de développement |
| `E2E_PRODUCTION=1 npm run test:e2e` | 13 parcours réussis sur le serveur compilé |
| `npm run template:journey` | Checkout propre, `npm ci`, initialisation, source directe, KPI simple et comparaison générés ; 175 tests et build réussis |
| `npm run template:migration` | Fixtures 1.4 et 1.5 initialisées avec KPI métier et styles personnalisés : portage, tests métier et builds réussis |
| `npm run bundle:compatibility` | Bundles app/data dev/prod validés avec les CLI 0.295.0, 1.12.1 et 1.14.1, contre un serveur local |
| `npm run template:release:check -- --base origin/main` | Passage 1.5.0 → 2.0.0 et quatre nouvelles capabilities validés |
| `npm run upstream:check` | Comparaisons GitHub en lecture seule réussies |
| `git diff --check` | Aucun défaut d’espacement |

La fixture de migration compare les requêtes, repositories, services, sources, tables personnelles, configuration et médias avant/après.
Les styles et la navigation métier restent présents. Les fixtures source exigent l’historique Git du template.
La CI les réserve au repository source ; elles ne s’exécutent pas dans une application initialisée.

Les tests couvrent les paramètres liés, limites de lignes et délais, Zod, troncature SQL, erreurs sûres et imports serveur interdits.
Deux flux Genie HTTP simultanés utilisent des identités OBO synthétiques distinctes, sans mélange des réponses ou jetons.
Les refus OBO, interruptions, quotas et soumissions ambiguës restent couverts.
Les tests personnels vérifient l’isolation, les payloads de définition, les limites et l’absence de résultats analytiques persistés.

Les parcours navigateur vérifient routes directes, filtres, attente, vide, erreur, Genie et cycle de vie d’une analyse.
Les captures clair/sombre, desktop/mobile et le focus clavier ont été inspectés.
Le stockage personnel de démo reste interdit en production ; ce parcours vérifie donc son état désactivé.
Les captures synthétiques restent sous `test-results/`, ignoré par Git.

Le build signale un chunk de visualisations d'environ 587 ko, chargé à la demande. Ce message n’empêche pas le build.
Les CLI signalent le chemin Shared du bundle data de la fixture ; aucun workspace réel n’est utilisé.

## Exceptions et maintenance

Les [exceptions AppKit](appkit-maintenance.md) restent explicites : Genie, sémantique du driver, démo, profil CLI et parsing HTTP.
Cette validation initiale conservait le transport Genie. La migration coordonnée décrite plus bas active le plugin programmatique avec un client de compatibilité.
Le contrôle amont a relevé 0 commit template et 43 commits skills depuis les révisions revues, sans les avancer.
La guidance Databricks 0.2.10 a été installée hors du repository avec le CLI supporté.

## Parcours de création et skills

Le complément de parcours reste inclus dans la release 2.0.0, avant sa publication.
Les six points d'entrée installés correspondent octet pour octet à la révision source revue 0.2.10.
`databricks-app-design` et `databricks-data-discovery` complètent les quatre skills du socle initial.
Les skills officiels restent hors du template ; les adaptations Valiuz sont dans le skill local et ses références.

Les nouveaux tests couvrent une app Genie sans KPI, les choix optionnels et bêta, les valeurs invalides et la conservation des choix.
Ils vérifient aussi les skills absents, modifiés, invalides ou non examinés, sans installation automatique.
Le catalogue a été comparé aux pages des plugins livrées dans AppKit 0.76.1.

Après ces changements, `npm run check`, `template:journey`, `template:migration` et `bundle:compatibility` ont été relancés avec succès.
Le parcours consommateur compte 142 tests avec le KPI généré. La migration conserve les features lors de l'ajout du champ `capabilities`.
Le validateur du skill `skill-creator` accepte les trois skills locaux modifiés.
`app:skills --directory <dossier-externe> --check` accepte les six empreintes installées.
La matrice CLI ajoute 1.12.1 après validation locale des quatre bundles ; les validations 0.295.0 et 1.14.1 viennent de l'étape runtime.
Les tests navigateur ont été exécutés lors de cette étape runtime. L'évolution du parcours de création ne modifie ni le serveur ni l'UI.

## Orchestration et essai sur une mini-app

`create-analytics-dbx-app` pilote la création et la reprise. `app:orchestrate` propose l'étape et les skills utiles depuis les fichiers.
Le diagnostic reste en lecture seule. Les notes de reprise ne valent ni réussite de test ni autorisation.
Les skills absents sont des candidats à une installation ciblée ; les entrées différentes ne sont pas écrasées automatiquement.

Après cette évolution, `npm run check` passe avec 146 tests, le lint, le typecheck et le build.
Le parcours `template:journey` passe avec 148 tests dans une copie propre installée avec `npm ci`.
Il examine deux fois chaque reprise : bootstrap, cadrage, source, implémentation et vérification, sans modifier la spec.
`template:migration` passe aussi avec la fixture métier 1.5. Le validateur du skill accepte l'entrée et ses références locales sont présentes.

Un essai indépendant a créé une mini-app de suivi des commandes avec un montant synthétique de 1 200 EUR.
Il a suivi le skill, généré une feature, précisé sa période de démo et sa source synthétique, puis adapté sa présentation mobile.
Les reprises après cadrage, génération et recette conservent les fichiers applicatifs, sans rejouer l'initialisation ou le générateur.
La copie passe ses 149 tests unitaires, son lint, son typecheck et son build.
La recette Chromium sur le serveur compilé passe 14 tests, dont six propres à la mini-app :

- Navigation, clavier, accès direct et montant de démo.
- Chargement avec le bouton temporairement désactivé.
- Absence de valeur affichée explicitement.
- Zéro conservé comme valeur numérique.
- Erreur compréhensible et nouvelle tentative.
- Affichage mobile.

Les captures desktop, mobile, chargement, vide et erreur sont conservées dans les preuves locales de l'essai.
Les captures desktop et mobile ont été inspectées. Les interceptions HTTP des tests utilisent uniquement des données synthétiques.
La première tentative sur le serveur de développement de cette copie a subi des redémarrages, puis un refus de connexion.
Après remplacement du lien de dépendances par une installation propre avec `npm ci`, les six tests ciblés passent aussi en développement.
Ce contrôle a pris 22 secondes, installation comprise. Le défaut initial ne s'est pas reproduit ; sa cause précise reste indéterminée.

L'essai a conduit à trois corrections du template : l'état vide des futurs KPI, l'aide `init-app --help` sans saisie,
et les fixtures imbriquées qui partagent leurs dépendances par lien symbolique.
Le lien `node_modules` est aussi ignoré par Git, comme un dossier de dépendances normal.
Le générateur distingue désormais une absence de valeur d'un zéro. La copie a démontré l'échec avant correction et la réussite après correction.
Les tests de reprise, de sélection des skills, d'aide et de dépendances liées sont déterministes et sans accès distant.

La décision de release reste **2.0.0** sur cette branche non publiée, comparée à la baseline 1.5.0.
La capability `guided-appkit-capabilities`, ses sondes et le guide de migration décrivent l'orchestration.
Les intégrations Databricks réelles et l'installation effective d'un skill manquant n'ont pas été exercées dans cet essai.

L’illustration du README a été adaptée avec l’outil `imagegen` intégré.
Le [fichier livré](assets/databricks-app-boilerplate-v2.png) et son [prompt exact](assets/databricks-app-boilerplate-v2.prompt.md) sont conservés.
Les médias officiels `public/valiuz-logo-icon.svg` et `public/favicon.svg` sont inchangés et identiques.

## CLI par métier et migrations 1.4/1.5

`npm run app` délègue aux commandes existantes. Les prompts couvrent data analyst, analytics engineer et data engineer.
`app next` reprend le diagnostic de création. `app migrate` lit une ancienne app depuis le checkout cible et ordonne les guides.
L'inventaire n'exécute pas l'app, n'importe pas son code et ne lit ni `.env.local` ni un profil OAuth.
Les tests vérifient les versions contradictoires ou absentes, les chemins avec espaces, les arguments littéraux,
les sources liées par symlink et l'absence de modification pendant les diagnostics.

`init-app` refuse une seconde initialisation avant les questions et les écritures. L'état de version reste intact.
Le contrôle complet passe avec 153 tests, lint, typecheck et build. La copie propre du parcours CLI passe avec 155 tests.
Ce parcours utilise la nouvelle entrée pour le cadrage, la source, le KPI, la reprise, les capacités et les skills.

Les deux baselines Git de migration sont vérifiées : 1.4 à `26a1d0a64a9fed4d0a9cad1c7031a9d2c07eb95f`
et 1.5 à `8b779bcb363a7c57bdea12342964601d0acdfef4`.
Chaque app génère une feature avant le portage ; ses deux tests métier, son lint, son typecheck et son build passent après migration.
La fixture 1.4 n'obtient aucune table personnelle ni permission MODIFY. La fixture 1.5 conserve ses déclarations personnelles.
Les contrats, déclarations, requêtes et médias métier restent présents ; seules les variables personnelles désactivées sont ajoutées à 1.4.

Un essai CLI supplémentaire a créé une app de commandes dans un dossier temporaire, avec installation propre et source fictive.
`app dev` sert `/health`, la route `/total-commandes` et son API, qui renvoie la valeur de démo 42.
`app next --json` propose la vérification sans réinitialiser la tranche.
`bundle:compatibility` passe avec le CLI 1.12.1 depuis le template et depuis cette app initialisée sur un autre projet de l'allowlist.
Le contrôle utilise une configuration synthétique dans sa propre copie et préserve les fichiers et l'historique de l'app appelante.
Le test a corrigé une absence de catalogue dans l'environnement d'exemple de cette fixture ; la reprise passe ensuite.
Le serveur et les copies temporaires de cet essai sont arrêtés et supprimés. Aucun workspace réel n'a été contacté.

Les deux skills modifiés passent le validateur `skill-creator`. Les liens documentaires locaux sont valides.
La décision reste **major 2.0.0**, non publiée. Le release check compare toujours la branche à `origin/main` en 1.5.0.
Les tests navigateur de l'étape précédente restent la preuve UI ; cette évolution CLI ne les a pas relancés.

## Parcours complet pour une personne

Le prompt par défaut couvre le besoin, les sources et leur qualité, les KPI, la préparation utile, l'interface,
les tests et la mise en service. Aucun choix de métier n'est requis. Les anciennes options `--role` restent compatibles.
Le skill réutilise les réponses connues et distingue démo testée, données réelles validées et livraison vérifiée.

`app next` expose les revues du parcours et les contrats data déclarés. La revue KPI est proposée dès la conception.
Une préparation notebook sélectionne la guidance Bundles sans activer le plugin Jobs ni exécuter de SQL.
Un contrat illisible reste un diagnostic à corriger. Des fichiers complets ou des notes positives ne certifient
ni les calculs, ni la qualité réelle, ni le déploiement.

Vérifications exécutées après ce changement :

- `npm run check` : 154 tests, lint, typecheck, contrats et build réussis.
- `npm run template:journey` : copie propre, prompt sans profil, reprise et KPI généré ; 156 tests et build réussis.
- `npm run template:migration` : fixtures 1.4 et 1.5, tests métier, lint, typecheck et builds réussis.
- `npm run bundle:compatibility` : CLI 1.12.1, bundles app et data dev/prod contre le serveur local.
- Validateur `skill-creator` : skill de création valide ; 49 liens Markdown locaux vérifiés.

La vérification porte sur les commandes et leurs contrats. Elle ne constitue pas un nouvel essai conversationnel
indépendant de l'agent. Aucun test navigateur ni accès aux données réelles n'a été relancé pour cette évolution du parcours.
La décision reste **major 2.0.0**, non publiée, face à la base 1.5.0.

## Comparaison facultative et waterfall

La capability `period-comparison` rejoint la **2.0.0 non publiée**. Le générateur conserve le KPI simple par défaut.
`--date-column` ajoute les fenêtres précédente, annuelle ou personnalisée. `--breakdown-column` ajoute un filtre commun
et une décomposition pour les mesures additives. Les moyennes utilisent leurs effectifs valides et n'obtiennent pas de waterfall automatique.
Les skills de création et de revue KPI décrivent les critères d'adoption, sans imposer cette option à toutes les apps.

Vérifications exécutées après cette évolution :

- `npm run check` : 170 tests, lint, typecheck, contrats, release et build réussis.
- `npm run template:journey` : app propre avec un KPI simple et une comparaison par canal ; 175 tests et build réussis.
- `npm run template:migration` : fixtures 1.4 et 1.5, deux tests métier par fixture, types, lint et builds réussis.
- `npm run bundle:compatibility` : CLI 1.12.1, app/data dev/prod contre un serveur local.
- `npm run test:e2e` puis `E2E_PRODUCTION=1 npm run test:e2e` : 13 parcours réussis dans chaque mode.
- `npm run template:release:check -- --base origin/main` et `git diff --check` : réussis.
- Validateur `skill-creator` : les deux skills modifiés sont valides ; liens Markdown locaux vérifiés.

Les calculs couvrent fenêtres civiles, année bissextile, chevauchement, durée différente, référence nulle ou négative,
mesures absentes, moyenne pondérée, segments nouveaux ou disparus, filtre commun, limites et réconciliation du waterfall.
Les tests du repository généré vérifient les sources liées, les deux bornes de dates, les lignes Zod et le refus de troncature.
Une dimension conserve le transport driver pour distinguer les libellés STRING ressemblant à du JSON des valeurs nulles.
Aucun résultat ni sélection de comparaison n'est ajouté au stockage personnel.

Les cinq nouveaux parcours navigateur couvrent choix des dates, filtre, contributions, valeurs exactes, périodes partielles,
vide, chargement, erreur, reprise, requêtes concurrentes, thèmes et clavier. Les captures clair/bureau et sombre/mobile ont été inspectées.
Une largeur automatique corrige les montants coupés sur l'axe temporel. Un contrôle géométrique vérifie les libellés après redimensionnement.
Un premier passage sous exécution simultanée des validations a expiré sur l'animation texte du test Genie existant.
La trace montrait une réponse arrivée mais encore partiellement révélée. Les suites finales passent sans modifier ce test ni ses attentes.
Le test géométrique a été corrigé pour trouver les libellés réellement rendus par Recharts.

Le SQL généré n'a pas été exécuté sur Databricks. DATE, fuseau métier, grain, additivité et couverture de chaque source
restent à valider avant utilisation réelle. Les fixtures n'établissent ni causalité ni fraîcheur des données métier.

## Genie AppKit, accompagnement et comparaison — 24 septembre 2026

Le plugin Genie 0.76.1 est actif en mode Databricks. Les tests passent par sa méthode `sendMessage` réelle,
avec un client synthétique par requête. Le transport HTTP de compatibilité reste nécessaire pour l’annulation,
l’envoi unique, les erreurs sûres et les résultats bornés. Ses critères de retrait figurent dans le registre de compatibilité.

La revue du skill couvre le besoin, le Space, les sources, les définitions et les questions de référence.
Le bouton facultatif « Explorer cet écart avec Genie » conserve les deux périodes, les filtres appliqués et les réserves.
La question reste modifiable avant l’envoi. Les cartes épinglées restent en mémoire et disparaissent avec la comparaison.

Vérifications exécutées après ces trois changements :

- `npm run check` : 177 tests, lint, typecheck, contrats, release et build réussis.
- `npm run template:journey` : installation propre, mini-app avec KPI simple et comparaison ; 182 tests et build réussis.
- `npm run template:migration` : fixtures 1.4 et 1.5, deux tests métier par fixture, lint, typecheck et builds réussis.
- `npm run bundle:compatibility` : CLI 1.12.1, bundles app/data dev/prod contre le serveur local.
- `npm run test:e2e -- --workers=1` : 14 parcours réussis en développement.
- `E2E_PRODUCTION=1 npm run test:e2e -- --workers=1` : 14 parcours réussis sur le build final.
- Validateur `skill-creator` : skill de création valide.
- `npm run template:release:check -- --base origin/main` et `git diff --check` : réussis ; 71 liens Markdown locaux des fichiers modifiés vérifiés.

Les tests vérifient deux utilisateurs OBO simultanés jusqu’aux résultats, le refus sans identité, l’absence de route
générique, les ressources déclarées, les interruptions pendant le POST et les lectures, ainsi que le délai global.
Ils couvrent les types de cellules, les pièces jointes sans statementId, la limite de 500 lignes et les erreurs nettoyées.
Les schémas de l’état personnel refusent toujours les observations et résultats du contexte enrichi.
Le parcours navigateur vérifie l’absence d’envoi automatique, le contexte, l’épinglage, le clavier et le mobile sombre.
La capture mobile sombre a été inspectée. Aucun résultat n’est écrit dans le stockage du navigateur ou les tables personnelles.

Le build signale un chunk Genie chargé à la demande d’environ 816 ko, soit 240 ko gzip. Le build réussit malgré cet avertissement.
La décision reste **major 2.0.0 non publiée** face à la base 1.5.0. `appkit-genie-integration` est la cinquième capability ajoutée.
La qualité des réponses d’un Space réel, les droits effectifs et le déploiement de développement restent à vérifier après autorisation.

## Revue documentaire et réserve distante

Skills appliqués : `review-analytics-app-docs` et `prepare-template-release`.
README, architecture, design system, configuration, accès, état personnel, exploitation, migrations, manifests et workflows ont été comparés au code.
Les mentions de layout serveur, hydratation et Next.js ont été corrigées dans les instructions actuelles.

Verdict : **PRÊT AVEC RÉSERVES** pour revue de code.
Findings restants : 0 bloquant local, 0 écart, 0 obsolète, 1 non vérifiable.
La réserve est la recette Databricks réelle, nécessaire avant adoption en production.

Aucun push, pull request, déploiement, grant, SQL d’écriture ou déclenchement de workflow distant n’a été effectué.
Les droits effectifs, l’identité injectée, le proxy OBO, la qualité des réponses du Space et la persistance Delta réelle restent à vérifier.
Le déploiement de développement exige une autorisation et la confirmation du host, profil, app, warehouse, projet, schéma et sources.
Après autorisation, appliquer la [recette distante](deployment.md) avec deux utilisateurs et vérifier la persistance après redémarrage.
