---
name: create-analytics-dbx-app
description: Créer et faire évoluer pas à pas une application analytics Valiuz issue du template Databricks Apps, depuis le repository GitHub et son clone local jusqu'au cadrage des données, requêtes, KPI et fonctionnalités.
---

# Mission

Accompagner un membre de l'équipe en français pour démarrer puis construire une application de dashboard, cockpit ou
suivi de chiffres. Transformer les zones floues en décisions explicites, garder une trace courte des choix et avancer
par tranches verticales testables.

# Choisir le parcours

- Pour créer le repository Valiuz, attribuer l'équipe, préparer le dossier local et initialiser le template, lire
  [references/bootstrap.md](references/bootstrap.md).
- Pour cadrer le besoin, les KPI, les sources et les requêtes, lire
  [references/product-discovery.md](references/product-discovery.md).
- Pour explorer des objets Unity Catalog et établir leur contrat sans exposer de lignes sensibles, lire
  [references/data-discovery.md](references/data-discovery.md).
- Pour implémenter une tranche fonctionnelle ou poursuivre une application initialisée, lire
  [references/delivery.md](references/delivery.md).

Un nouveau projet suit les trois parcours dans cet ordre. Un projet déjà initialisé commence au premier parcours
encore incomplet. Ne pas rejouer `npm run init-app` si les placeholders ont déjà été remplacés.

# Démarrage obligatoire

1. Lire `AGENTS.md`, `README.md`, puis les runbooks pertinents sous `docs/` s'ils existent.
2. Inspecter `git status --short --branch` et les remotes avant toute modification.
3. Déterminer si l'on se trouve dans le template, dans une application initialisée ou hors repository.
4. Préserver tout travail existant qui ne fait pas partie de la demande.

# Conduire l'échange

- Poser une à trois questions courtes à la fois. Ne jamais envoyer tout le questionnaire en une seule fois.
- Ne pas redemander une information déjà disponible dans les fichiers, GitHub ou les réponses précédentes.
- Pour une décision technique difficile, proposer une option recommandée et expliquer brièvement son impact.
- Après chaque lot, récapituler les décisions, les inconnues bloquantes et la prochaine petite étape.
- Une fois le clone disponible, maintenir `docs/product-brief.md` comme source de vérité. Marquer `À confirmer` au lieu
  d'inventer une réponse.
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
- Le contenu versionné reste neutre vis-à-vis des assistants de développement : aucun nom de produit ou de fournisseur
  d'assistant, fichier de configuration propre à un outil ou texte promotionnel ne doit entrer dans le repository.
  Le standard ouvert `.agents/skills` est autorisé.
- Ne pas interpoler d'entrée utilisateur dans le SQL. Paramétrer les requêtes, borner leur durée et leur volume, puis
  valider les lignes avec Zod.
- Demander une autorisation explicite juste avant toute mutation distante. Cela comprend la création du repository,
  l'ajout de l'équipe, un push, une pull request, un changement de paramètres GitHub, un grant, un SQL d'écriture ou un
  déploiement Databricks.
- Avant une mutation distante, afficher l'hôte, l'organisation ou workspace, le repository ou app, la branche, le
  warehouse, le projet/catalogue et le schema qui s'appliquent. N'afficher que les champs pertinents à l'opération.
- En cas de réussite partielle, s'arrêter, décrire exactement l'état créé et proposer une reprise. Ne jamais supprimer
  automatiquement un repository ou une ressource distante pour compenser un échec.

# Résultat attendu

Toujours terminer une étape avec : l'état obtenu, les décisions enregistrées, les commandes réellement exécutées,
les validations réussies ou non exécutées, et la prochaine tranche recommandée. Ne jamais annoncer une vérification
qui n'a pas été exécutée.
