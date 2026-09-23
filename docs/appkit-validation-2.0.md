# Validation AppKit 2.0 — 23 septembre 2026

Base examinée : `8b779bcb363a7c57bdea12342964601d0acdfef4` (template 1.5.0).
Décision : **major 2.0.0**, car les routes, le chargement des pages et le runtime changent.
Packages AppKit et AppKit UI : `0.76.1`. Node.js : `22.16.0`.

## Vérifications locales

| Commande | Résultat |
| --- | --- |
| `npm run check` | Capabilities, release, configuration, lint, types, tests et build validés |
| `npm test` | 140 tests réussis, sans credential ni donnée distante |
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
