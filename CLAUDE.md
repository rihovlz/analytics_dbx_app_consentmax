# Règles permanentes — analytics_dbx_app_consentmax

## Parcours principal

Utilise le skill `create-analytics-dbx-app` (dans `.agents/skills/`) comme parcours principal.

## Démarrage obligatoire

1. Lire `AGENTS.md`, `README.md` et les runbooks pertinents sous `docs/`.
2. Inspecter `git status --short --branch` et les remotes.
3. Déterminer si le repo est encore le template ou déjà initialisé.
4. Exécuter `npm run template:status` et `npm run app:doctor`.
5. Ne jamais rejouer `npm run init-app` si les placeholders ont déjà été remplacés.

La version du template est dans `template/manifest.yml` et `npm run template:status` — pas en dur ici.

## Cadrage (dans cet ordre)

- Utilisateurs et décision métier facilitée
- Problème actuel et fréquence d'utilisation
- Critère de succès de la première version
- KPI prioritaires avec définition exacte (formule, unité, grain, période, comparatif, objectif, arrondi, fuseau)
- Dimensions et filtres nécessaires
- Tables ou vues Databricks disponibles (grain, clés, fraîcheur, profondeur, qualité)
- Requêtes, pages, interactions et états d'interface attendus

Maintenir `config/app-spec.yml` avec `npm run app:guide`. Laisser « À confirmer » si une info manque.

## Données

- Mode `direct` par défaut si une table ou vue existante suffit.
- Déclarer chaque source avec `npm run data:init` et `config/data-access.json`.
- Utiliser uniquement un projet autorisé par `config/data-projects.json`.
- Ne proposer notebook ou pipeline que si une préparation est réellement nécessaire.
- Utiliser `design-cost-aware-data-history` si une source expire, si une période doit être rejouée ou si une historisation doit être conservée.
- Ne jamais exécuter d'écriture SQL, de préparation ou de reprise sans montrer les cibles et obtenir une confirmation explicite.
- Ne jamais copier de ligne client ou donnée sensible dans un prompt, une fixture, un log ou Git.

## Interface

- Réutiliser en priorité la bibliothèque de visualisation du template.
- Concevoir explicitement les états `ready`, `loading`, `empty` et `error`.
- Conserver l'accessibilité clavier, les thèmes clair/sombre et le mouvement réduit.
- Utiliser des fixtures synthétiques en mode démo avant de dépendre d'un accès distant.

## Genie

Évaluer si Genie apporte une vraie valeur métier — ne pas le forcer dans le MVP. Si utilisé : déclarer le Space, les alias, les utilisateurs. Conserver l'identité OBO. Ne jamais partager un instantané d'un autre utilisateur.

## Première tranche

Utiliser `npm run feature:new -- <slug>`, relire et adapter systématiquement le SQL généré. Respecter la séparation `page → route → service → repository → SqlExecutor`.

## Skills à utiliser selon le périmètre

| Situation | Skill |
|---|---|
| Chaque KPI ou conclusion chiffrée | `validate-analytics-kpis` |
| Parcours utilisateur critique | `test-analytics-app-e2e` |
| Changement de comportement ou d'exploitation | `review-analytics-app-docs` |
| Branche, commits, PR | `github-engineer` |

## Reporting après chaque étape

Indiquer systématiquement :
- Ce qui a été obtenu
- Les décisions enregistrées
- Les commandes réellement exécutées
- Les contrôles réussis ou non exécutés
- Les inconnues restantes
- La prochaine petite tranche recommandée

## Mutations distantes — confirmation obligatoire

Ne jamais pousser, merger, déployer, créer une ressource distante, modifier un grant ou exécuter un SQL d'écriture sans demander une **confirmation explicite juste avant l'action**.

## Questions

- Poser 1 à 3 questions courtes à la fois, idéalement autour d'une seule décision.
- Ne pas redemander ce qui existe déjà dans les fichiers ou les réponses précédentes.
