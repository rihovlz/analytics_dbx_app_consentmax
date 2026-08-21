# Livraison par tranches verticales

Utiliser ce parcours lorsqu'une tranche fonctionnelle possède un objectif, des sources et des critères d'acceptation
suffisamment clairs.

## Avant de modifier

1. Relire `docs/product-brief.md`, `docs/architecture.md`, `docs/databricks.md` et les instructions du repository.
2. Inspecter le statut et le diff. Ne pas mélanger du travail existant avec la nouvelle tranche.
3. Créer ou utiliser une branche de feature dédiée. Ne pas pousser sans autorisation explicite.
4. Résumer le critère d'acceptation et les fichiers probablement concernés.

## Construire un chemin complet

Respecter la boundary du template :

```text
page ou composant de feature
  -> route avec withApiRoute
  -> service de feature
  -> repository de feature
  -> SqlExecutor
  -> Databricks SQL / Unity Catalog
```

- Mettre une page dans `src/app/<route>/page.tsx`.
- Garder l'UI métier dans `src/features/<feature>/` et les composants neutres partagés dans `src/components`.
- Mettre l'orchestration métier dans `server/service.ts`.
- Mettre les requêtes et contrats de lignes dans `queries.ts` et `server/repository.ts`.
- Utiliser des paramètres driver, un nom de requête stable, un timeout, une limite de lignes et un schéma Zod.
- Ne pas importer la configuration serveur, un client Databricks ou un repository depuis un module client.
- Garder `/health` superficiel ; placer une vérification distante dans un endpoint distinct.

Commencer par une fixture de démo déterministe lorsque le contrat métier est validé mais que l'accès distant ne l'est
pas encore. La fixture doit être synthétique et ne contenir aucune ligne issue d'un client.

## Tester la tranche

Ajouter des tests déterministes dans `tests/*.test.ts` avec un faux `SqlExecutor`. Couvrir au minimum le résultat nominal
et l'état vide ou l'erreur qui compte pour le critère d'acceptation. Les tests unitaires ne doivent pas dépendre du réseau
ou de credentials.

Avant le handoff, exécuter les commandes demandées par `AGENTS.md`, normalement :

```bash
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

Relire ensuite le diff complet, le statut final, la présence éventuelle de secrets ou de données sensibles, et la
neutralité du repository vis-à-vis des assistants de développement.

Utiliser `review-analytics-app-docs` avant la pull request lorsqu'une tranche modifie le comportement, la configuration,
les routes, les sources, les droits ou l'exploitation de l'application.

## Boucle d'itération

Après chaque tranche :

1. Montrer ce que l'utilisateur peut maintenant faire.
2. Lister les hypothèses validées ou encore ouvertes.
3. Mettre à jour le brief et ordonner le backlog selon valeur, risque et dépendances.
4. Proposer une seule prochaine tranche, avec son critère d'acceptation.
5. Demander un retour ciblé sur le chiffre, la requête et l'usage avant d'élargir l'interface.

Une pull request, un déploiement, un grant ou un test d'intégration distant constitue une nouvelle mutation ou action
distante : afficher les cibles exactes et obtenir l'autorisation correspondante juste avant de l'exécuter.
