# Validation AppKit 2.0 — 23 septembre 2026

Base examinée : `8b779bcb363a7c57bdea12342964601d0acdfef4` (template 1.5.0).
Décision : **major 2.0.0**, car les routes, le chargement des pages et le runtime changent.
Packages AppKit et AppKit UI : `0.76.1`. Node.js : `22.16.0`.

## Vérifications locales

| Commande | Résultat |
| --- | --- |
| `npm run check` | Capabilities, release, configuration, lint, types, tests et build validés |
| `npm test` | 146 tests réussis, sans credential ni donnée distante |
| `APP_MODE=databricks npm run build` | Build sans credentials runtime réussi |
| `npm run test:e2e` | 8 parcours Chromium réussis sur le serveur de développement |
| `E2E_PRODUCTION=1 npm run test:e2e` | 8 parcours réussis sur le serveur compilé |
| `npm run template:journey` | Checkout propre, `npm ci`, initialisation, source directe, KPI généré, doctor et validations réussis |
| `npm run template:migration` | Fixture 1.5 initialisée avec KPI métier, état personnel et styles personnalisés : portage, tests métier et build réussis |
| `npm run bundle:compatibility` | Bundles app/data dev/prod validés avec les CLI 0.295.0, 1.12.1 et 1.14.1, contre un serveur local |
| `npm run template:release:check -- --base origin/main` | Passage 1.5.0 → 2.0.0 et trois nouvelles capabilities validés |
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

Le build signale un chunk de visualisations de 558 ko, chargé à la demande. Ce message n’empêche pas le build.
Les CLI signalent le chemin Shared du bundle data de la fixture ; aucun workspace réel n’est utilisé.

## Exceptions et maintenance

Les [exceptions AppKit](appkit-maintenance.md) restent explicites : Genie, sémantique du driver, démo, profil CLI et parsing HTTP.
Genie conserve son transport actuel jusqu’à preuve de parité AppKit pour l’annulation, les reprises et les logs.
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

## Revue documentaire et réserve distante

Skills appliqués : `review-analytics-app-docs` et `prepare-template-release`.
README, architecture, design system, configuration, accès, état personnel, exploitation, migrations, manifests et workflows ont été comparés au code.
Les mentions de layout serveur, hydratation et Next.js ont été corrigées dans les instructions actuelles.

Verdict : **PRÊT AVEC RÉSERVES** pour revue de code.
Findings restants : 0 bloquant local, 0 écart, 0 obsolète, 1 non vérifiable.
La réserve est la recette Databricks réelle, nécessaire avant adoption en production.

Aucun push, pull request, déploiement, grant, SQL d’écriture ou déclenchement de workflow distant n’a été effectué.
Les droits effectifs, l’identité injectée, le proxy OBO et la persistance Delta réelle restent à vérifier.
Le déploiement de développement exige une autorisation et la confirmation du host, profil, app, warehouse, projet, schéma et sources.
Après autorisation, appliquer la [recette distante](deployment.md) avec deux utilisateurs et vérifier la persistance après redémarrage.
