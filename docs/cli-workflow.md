# Créer une app depuis le terminal

Après `npm ci`, commencer avec `npm run app`. Ce menu présente le parcours et l'aide disponible.
Les commandes historiques restent compatibles. Le menu délègue aux mêmes scripts, sans nouvelle dépendance.

## Commencer avec un assistant

Copier ce prompt dans l'assistant ouvert sur le projet :

> Utilise create-analytics-dbx-app pour construire une petite app Valiuz de suivi des commandes.
> Commence en démo, aide-moi à préciser les utilisateurs et les KPI, puis implémente et teste une première tranche.
> Reprends les informations déjà présentes et pose seulement les questions manquantes.

Pour produire une variante adaptée au métier :

```bash
npm run app -- prompt --role data-analyst --idea "Suivre les commandes par période"
npm run app -- prompt --role analytics-engineer --idea "Exposer une marge dont le calcul est vérifiable"
npm run app -- prompt --role data-engineer --idea "Suivre la fraîcheur et la complétude des sources"
```

La commande affiche du texte à copier. Elle ne lance aucun agent et ne lit aucun credential.
Le profil ajuste les questions ; il n'active pas de plugin ni de préparation.
Un même projet peut être repris par les trois métiers, sans réinitialisation.
`init` refuse une app déjà nommée ou suivie par `.valiuz-template.yml`, avant toute écriture.

| Profil | Point de départ | Première preuve utile |
| --- | --- | --- |
| Data analyst | Utilisateurs, décision, KPI et filtres | Une lecture compréhensible avec états chargement, vide et erreur |
| Analytics engineer | Grain, métriques, jointures et contrats SQL | Un calcul testé sur des fixtures et une requête bornée, liée et validée |
| Data engineer | Sources, fraîcheur, volumes et accès | Une lecture directe suffisante ou une préparation justifiée et bornée |

Le skill `create-analytics-dbx-app` conduit le travail. Il charge les skills Databricks utiles à l'étape,
conserve les règles Valiuz et vérifie les résultats. Les plugins AppKit exécutés dans l'app sont une décision distincte.

## Reprendre sans chercher la bonne commande

```bash
npm run app -- next
npm run app -- next --json
npm run app -- capabilities --all
npm run app -- skills --directory /chemin/vers/les/skills
npm run app -- feature --help
```

`next` examine les fichiers et propose une action. Il ne l'exécute pas et n'affirme pas que les tests passent.
Pour un JSON utilisable dans un script, employer `npm run --silent app -- next --json`.
`capabilities` expose les intégrations et leurs prérequis. `skills` contrôle uniquement le dossier indiqué, sans installation.
Les déclarations de la spec n'activent ni ressource, ni droit, ni plugin.

## Essayer une première tranche sans Databricks

Utiliser une nouvelle copie du template avec ses dépendances installées. Les tables ci-dessous sont fictives.
Le nom du projet est un exemple de l'allowlist Valiuz, sans preuve d'accès réel.

```bash
npm run app -- init analytics_dbx_app_commandes --data-project dev-dtm-operating --non-interactive
npm run app -- guide --audience "Équipe ventes" --decision "Suivre les commandes" --success "Lire le total de démo" --capabilities analytics --non-interactive
npm run app -- data commandes --mode direct --source dev-dtm-operating.demo_fictive.commandes --purpose "Source fictive de démonstration" --non-interactive
npm run app -- feature total-commandes --source commandes --aggregation count --demo-value 42 --non-interactive
npm run app -- check
npm run app -- dev
```

Ouvrir `http://localhost:3000/total-commandes`. Garder `APP_MODE=demo` pendant cet essai.
Relire le calcul généré. Un zéro est une valeur ; une absence de valeur affiche l'état vide.
Avant les données réelles, remplacer la source fictive et vérifier grain, droits et contrat avec un profil OAuth nommé.
Les commandes `dev` et `check` exécutent respectivement le serveur et les validations de la configuration courante.

Pour Genie, des fichiers ou une autre intégration, commencer par `guide` et `capabilities`.
Les étapes `data` et `feature` ne sont nécessaires que pour une tranche KPI. Le générateur reste limité à `count`, `sum` et `avg`.
Une pipeline n'est pas un prérequis pour un data engineer : le mode `direct` suffit souvent.
Les préparations locales n'exécutent aucun SQL distant. Leur déploiement et leur exécution suivent le runbook de préparation.

## Préparer une migration 1.4 ou 1.5

Depuis un checkout **2.0 relu**, distinct de l'ancienne app, avec `npm ci` exécuté :

```bash
npm run app -- migrate --app-dir /chemin/vers/ancienne-app
npm run app -- migrate --app-dir /chemin/vers/ancienne-app --json
```

Le bilan lit la version déclarée, inventorie les usages de Next.js et ordonne les guides.
Il ne modifie aucun fichier et n'exécute pas les scripts de l'app inspectée.
Si `.valiuz-template.yml` manque, examiner d'abord l'historique puis préciser `--from 1.4.0` ou `--from 1.5.0`.
Le bilan refuse une version contradictoire ou inconnue. L'ancienne copie du manifeste ne connaît pas les futures releases.

Prompt de migration à adapter :

> Utilise create-analytics-dbx-app pour migrer volontairement cette app vers le template 2.0.
> Le checkout du template cible est à [chemin]. Commence par le bilan de migration et les tests existants.
> Porte les routes et le runtime en préservant les URL, calculs, accès, tables personnelles et personnalisations.
> Vérifie le résultat localement et indique la recette distante restante.

Suivre [le guide 1.4/1.5 vers 2.0](migration-2.0.md). Il décrit le portage manuel et les validations requises.
Un bilan réussi ne constitue ni une migration ni une certification de compatibilité.
