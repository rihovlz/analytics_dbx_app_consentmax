---
name: create-analytics-dbx-app
description: Créer ou faire évoluer une application Valiuz issue du template Databricks Apps. Cadrer le besoin, choisir les capacités AppKit et les skills Databricks utiles, puis livrer une tranche métier testable avec les règles Valiuz.
---

# Mission

Accompagner en français la création d'une app, depuis son usage jusqu'à sa première tranche testable.
Le besoin peut être un KPI, une conversation, un fichier, un formulaire ou un traitement.
Conserver dans le template les décisions Valiuz et consulter les instructions Databricks officielles pour les APIs.

# Choisir le parcours

- Pour choisir les capacités AppKit et consulter les bons skills amont, lire
  [references/appkit-capabilities.md](references/appkit-capabilities.md). Le faire pendant le cadrage, puis lors d'un nouveau besoin.
- Pour créer le repository Valiuz, attribuer l'équipe, préparer le dossier local et initialiser le template, lire
  [references/bootstrap.md](references/bootstrap.md).
- Pour cadrer le besoin, les KPI, les sources et les requêtes, lire
  [references/product-discovery.md](references/product-discovery.md).
- Pour explorer des objets Unity Catalog et établir leur contrat sans exposer de lignes sensibles, lire
  [references/data-discovery.md](references/data-discovery.md).
- Pour choisir entre lecture directe, notebook batch et pipeline Lakeflow, lire
  [references/data-preparation.md](references/data-preparation.md).
- Pour conserver un historique ou rejouer une plage avec un coût borné, utiliser le skill
  `design-cost-aware-data-history`.
- Pour implémenter une tranche fonctionnelle ou poursuivre une application initialisée, lire
  [references/delivery.md](references/delivery.md).

Pour un nouveau projet, identifier d'abord l'utilisateur, son action et son critère de succès.
Initialiser ensuite une démo locale, choisir les capacités utiles, puis traiter les accès nécessaires à la première tranche.
Un projet existant commence à la première étape manquante. Ne pas rejouer `init-app` ni `databricks apps init` sur un clone initialisé.
Une demande explicite d'app Valiuz conserve ce choix. Pour un simple besoin de reporting encore ouvert, comparer brièvement
l'app avec un dashboard géré avant de créer un repository.

# Démarrage obligatoire

1. Lire `AGENTS.md`, `README.md`, puis les runbooks pertinents sous `docs/` s'ils existent.
2. Inspecter `git status --short --branch` et les remotes avant toute modification.
3. Déterminer si l'on se trouve dans le template, dans une application initialisée ou hors repository.
4. Préserver tout travail existant qui ne fait pas partie de la demande.

# Conduire l'échange

- Poser une à trois questions courtes à la fois. Ne jamais envoyer tout le questionnaire en une seule fois.
- Ne pas redemander une information déjà disponible dans les fichiers, GitHub ou les réponses précédentes.
- Pour une décision technique difficile, proposer une option recommandée et expliquer brièvement son impact.
- Présenter les capacités en termes d'usage. Proposer une combinaison minimale et différer celles sans besoin confirmé.
- Ne pas imposer un premier KPI à une app Genie ou fichiers. `feature:new` reste réservé aux KPI simples.
- Après chaque lot, récapituler les décisions, les inconnues bloquantes et la prochaine petite étape.
- Une fois le clone disponible, maintenir `config/app-spec.yml` comme source de vérité courte avec `app:guide`.
  `docs/product-brief.md` est sa projection générée ; marquer `À confirmer` au lieu d'inventer une réponse.
- Ne jamais inscrire de secret, token, donnée client, identifiant personnel ou extrait sensible dans le brief, les
  prompts, les logs, les fixtures ou Git.

# Contraintes non négociables

- L'organisation GitHub est `valiuz`.
- Le nom du repository respecte `^analytics_dbx_app_[a-z0-9][a-z0-9_-]*$`.
- Le repository provient de `valiuz/analytics_dbx_app_template`.
- L'équipe Analytics doit avoir un accès explicite au repository. Résoudre son slug réel et faire confirmer le niveau
  d'accès.
- Le clone local vit dans un dossier explicite portant le nom du repository, jamais à l'intérieur d'un autre checkout
  Git.
- Le projet de données est un catalogue Unity Catalog choisi dans `config/data-projects.json`. Les valeurs initiales
  autorisées sont `dev-dtm-operating`, `dev-dtm-media-pm`, `dev-dtm-myvaliuz` et `dev-dtm-insight-sharing`.
- Chaque table ou vue consommée est déclarée dans `config/data-access.json` et appartient au projet sélectionné.
- Une app interne mono-mainteneur reste en mode `direct` tant qu'une table ou vue existante suffit. Ne créer un Job ou
  une pipeline que pour une préparation explicitement requise ; l'app garde uniquement `SELECT` sur la sortie.
- Les skills locaux restent au format ouvert `.agents/skills`. Installer les skills amont hors du code de l'app avec le CLI officiel.
  Consigner leurs noms et révisions ; conserver les adaptations Valiuz dans les références locales, sans modifier les fichiers amont.
- Ne pas interpoler d'entrée utilisateur dans le SQL. Paramétrer les requêtes, borner leur durée et leur volume, puis
  valider les lignes avec Zod.
- Vérifier qu'une autorisation explicite couvre toute mutation distante. Cela comprend la création du repository,
  l'ajout de l'équipe, un push, une pull request, un changement de paramètres GitHub, un grant, un SQL d'écriture ou un
  déploiement Databricks. Réutiliser un accord déjà donné pour les mêmes cibles et le même périmètre.
- Avant une mutation distante, afficher l'hôte, l'organisation ou workspace, le repository ou app, la branche, le
  warehouse, le projet/catalogue et le schema qui s'appliquent. N'afficher que les champs pertinents à l'opération.
- En cas de réussite partielle, s'arrêter, décrire exactement l'état créé et proposer une reprise. Ne jamais supprimer
  automatiquement un repository ou une ressource distante pour compenser un échec.

# Résultat attendu

Toujours terminer une étape avec : l'état obtenu, les décisions enregistrées, les commandes réellement exécutées,
les validations réussies ou non exécutées, et la prochaine tranche recommandée. Ne jamais annoncer une vérification
qui n'a pas été exécutée.

# Runtime AppKit 2.0

`npm run app:capabilities` expose les choix de la spec, les ressources, les guides et les tests à prévoir.
`npm run app:skills` propose les skills amont du socle et ceux utiles aux capacités retenues.
Ces commandes sont locales et en lecture seule. Aucun choix dans le brief n'active un plugin ou une ressource.

Avant une intégration, lire la page correspondante dans les docs du package installé avec `npx --no-install appkit docs`.
Lire les exceptions de `docs/appkit-maintenance.md`. Les contrats Valiuz priment sur les exemples génériques de scaffolding.
Une migration de runtime demande les parcours consommateur et E2E ; la fixture 1.5 s'exécute dans le repository source.
