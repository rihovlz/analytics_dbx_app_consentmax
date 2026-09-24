# Migration volontaire de 1.4.0 ou 1.5.0 vers 2.0.0

La version 2.0.0 remplace le runtime Next.js par AppKit/Express, Vite et React Router. React reste la bibliothèque UI.
Les applications 1.4.0 et 1.5.0 continuent de fonctionner sans migration automatique.
Les requêtes métier, déclarations d’accès, tables personnelles et personnalisations Valiuz restent propres à chaque application.

## Obtenir le bilan depuis le template cible

Utiliser un checkout de la version 2.0 relue, dans un dossier distinct de l'app. Installer ses dépendances avec `npm ci`.
Ne pas exécuter `init-app` dans l'app existante. Depuis ce checkout cible :

```bash
npm run app -- migrate --app-dir /chemin/vers/ancienne-app
npm run app -- migrate --app-dir /chemin/vers/ancienne-app --json
```

La version vient de `.valiuz-template.yml`. Si elle n'est pas suivie, examiner l'historique puis fournir `--from 1.4.0` ou `--from 1.5.0`.
Une version fournie ne remplace jamais silencieusement un état contradictoire.
Les guides viennent du checkout cible : le manifeste copié dans une ancienne app ne connaît pas les versions futures.
`template:diff` affiche toujours un seul guide direct ; le bilan `app migrate` assemble les étapes nécessaires.

Le bilan repère les pages, layouts, handlers, imports Next.js, candidats serveur et noms `NEXT_PUBLIC_*`.
Il ignore `.env.local`, les dépendances et les sources liées par symlink. Il n'affiche pas les valeurs de l'environnement.
Ce relevé statique n'est pas exhaustif. Examiner aussi les middleware, rewrites, Server Actions, routes dynamiques,
Pages Router, authentification et conventions propres à l'app. Le bilan n'exécute aucun test ni modification.

## Partir de 1.4.0

Appliquer les contrats du [guide 1.4 → 1.5](../template/upgrades/1.4.0-to-1.5.0.yml), puis le portage 1.5 → 2.0 décrit ici.
Ces étapes peuvent rester sur la même branche de migration, avec une revue distincte pour chaque contrat.
Ajouter les modules personnels, leurs routes, le flag du shell et les variables optionnelles, sans activer le stockage.
Conserver `USER_STATE_ENABLED=false` si l'app n'en a pas besoin. Aucune table, permission MODIFY ou exécution de
`user-state:init` n'est nécessaire pour ce parcours. Une activation ultérieure suit [le guide personnel](user-state.md).
La capability `personal-user-state` décrit la présence du code, pas l'activation d'un stockage.
Préserver les éventuels stockages métier préexistants et leurs garanties ; ils ne sont pas convertis automatiquement.

## Préparer la branche

1. Créer une branche dédiée depuis la révision de production.
2. Conserver le SHA déployé pour le rollback.
3. Exécuter les validations de la version de départ avant toute modification.
4. Dans le checkout cible, examiner le bilan puis `npm run template:diff -- --from 1.5.0 --to 2.0.0`.
5. Inventorier les pages, handlers, chargements serveur, personnalisations et usages de Next.js.
6. Relever les résultats attendus des tests métier.

## Porter les fichiers du socle

Fusionner les fichiers nommés dans le guide YAML. Ne pas remplacer un dossier métier complet.
Fusionner `package.json`, puis exécuter `npm install` avec Node.js 22.16+.
Les versions initiales de `@databricks/appkit` et `@databricks/appkit-ui` sont exactement `0.76.1`.
Le Vite utilisé correspond à la dépendance d’AppKit. Le lockfile reste dans Git.

| Contrat Next.js 1.4/1.5 | Contrat 2.0 |
| --- | --- |
| `src/app/<route>/page.tsx` | `src/client/pages/<route>/page.tsx`, enregistré dans `src/client/routes.tsx` |
| `src/app/layout.tsx` | Shell dans `src/client/main.tsx` et document dans `index.html` |
| Server Component ou page `async` | Handler dans `src/server/routes/`, service existant, chargement client avec états explicites |
| `src/app/api/<route>/route.ts` | Handler Web dans `src/server/routes/<route>/route.ts`, enregistré avec `expressRoute` |
| `NextResponse.json` | `Response.json` |
| `next/navigation` | `useLocation`, `Link`, paramètres de React Router |
| `next/image` | `img` avec dimensions et texte alternatif |
| `generateMetadata` | Configuration publique validée par `/api/config` et métadonnées HTML |
| `server-only` | Séparation serveur et contrôle des imports dans `vite.config.ts` |
| `npm run build` | Vite pour `dist/client`, esbuild pour `dist/server/index.js` |
| `npm run start` | Serveur AppKit en production, port injecté par Databricks Apps |

Les handlers conservent `withApiRoute`, les identifiants de requête et l’enveloppe publique d’erreur.
Le pont Express transmet le corps, les paramètres et l’annulation des flux.
Supprimer les exports `dynamic`, `runtime` et les mécanismes propres à Next.js après leur portage.
Supprimer `next.config.mjs`, `next-env.d.ts`, `src/instrumentation.ts` et `scripts/prepare-standalone.mjs`.
Retirer les dépendances `next`, `eslint-config-next` et `server-only`.
Retirer aussi les directives `use client` devenues inutiles lors des prochaines modifications des composants.

## Préserver les données et identités

Les contrats `service → repository → SqlExecutor` restent identiques.
Le runtime utilise AppKit analytics pour les lectures compatibles.
Les paramètres ordinaux deviennent des paramètres nommés ; leurs valeurs restent liées.
Les lignes restent validées avec Zod. Le nom, la limite et le délai restent obligatoires au niveau du contrat.

AppKit omet les paramètres nuls et transforme certaines chaînes JSON en objets.
Les paramètres nuls utilisent automatiquement le driver avant la soumission.
Pour une colonne STRING qui peut contenir du JSON, ajouter `transport: "driver"` à sa requête.
Les nombres, booléens et dates JSON_ARRAY arrivent sous forme de chaînes depuis le Statement Execution API.
Si le contrat existant attend des types natifs du driver, conserver aussi `transport: "driver"`.
Les KPI générés acceptent déjà les nombres avec `z.coerce.number()`.
Cette option conserve les valeurs d’origine. Ne pas élargir un schéma Zod pour masquer une différence de transport.

Porter l’orchestration Genie vers AppKit et conserver le client HTTP de compatibilité ainsi que ses tests OBO.
L’exception AppKit est détaillée dans [la maintenance amont](appkit-maintenance.md).
Les écritures personnelles utilisent leur repository privé et le driver existant.
Les tables, namespaces, identités propriétaires et définitions enregistrées ne changent pas.

Conserver `config/data-access.json`, `config/genie-spaces.json`, `data/` et les variables métier.
Exécuter `npm run data:access:render` pour produire les métadonnées AppKit et les bindings.
Les sources analytiques gardent SELECT. Seules les deux tables personnelles conservent MODIFY incluant SELECT.

## Variables et déploiement

Les variables APP, DATABRICKS et USER_STATE conservent leurs noms.
Le serveur traduit `DATABRICKS_SQL_WAREHOUSE_ID` vers la variable interne AppKit `DATABRICKS_WAREHOUSE_ID`.
Ne pas créer un second binding warehouse.
Le profil OAuth local reste renouvelé par le CLI. Databricks Apps conserve ses credentials injectés.

Retirer les variables `NEXT_PUBLIC_*` et exposer chaque valeur nécessaire via un contrat public validé.
Ne pas convertir les credentials en variables Vite. Le build n’expose aucune variable d’environnement automatiquement.
Le build fonctionne sans credentials, même avec `APP_MODE=databricks`.

Conserver un seul `app.yaml` avec `npm run start`.
Conserver la source Git de production, les gates et la confirmation des mutations distantes.
En local, `PORT` vaut 3000 par défaut ; `DATABRICKS_APP_PORT` reste prioritaire.
`APP_HOST` permet un bind local explicite. `NODE_ENV` choisit Vite ou les fichiers de production.

## Valider et déclarer la migration

Fusionner les scripts de cadrage, `config/appkit-capabilities.json` et les références de skills locales.
Conserver les valeurs métier de `config/app-spec.yml`. Sans champ `capabilities`, la spec garde le parcours Analytics.
Exécuter `npm run app:guide -- --non-interactive` pour ajouter ce choix et régénérer le brief sans perdre les features.
Examiner `npm run app:capabilities` et `npm run app:skills`. Aucun plugin n'est activé par ces commandes.
Fusionner aussi les modules de [comparaison facultative](period-comparison.md), leurs exports et le générateur indiqué
dans le guide YAML. Les features migrées restent identiques ; ajouter une comparaison est une décision métier distincte.

1. Exécuter lint, typecheck, tests unitaires et build.
2. Exécuter `npm run test:e2e` et vérifier les thèmes, le clavier et le mobile.
   Après le build, exécuter aussi `E2E_PRODUCTION=1 npm run test:e2e` pour les fichiers statiques de production.
   Ce second parcours vérifie l’état personnel désactivé : le stockage de démo reste réservé au développement.
3. Exécuter `npm run bundle:compatibility`.
4. Exécuter `npm run template:check -- --to 2.0.0`.
5. Après succès, déclarer la version 2.0.0 dans `.valiuz-template.yml`.
6. Ajouter les capabilities `appkit-native-runtime`, `upstream-compatibility`, `guided-appkit-capabilities`, `period-comparison` et `appkit-genie-integration`.
7. Ajouter `1.5.0-to-2.0.0` dans `appliedUpgrades`.
   Pour une origine 1.4, ajouter aussi `personal-user-state` et `1.4.0-to-1.5.0` après validation de leurs contrats.
8. Exécuter `npm run app:doctor` et `npm run check`.
9. Après autorisation, déployer en développement et effectuer la recette distante.

Le repository source fournit `npm run template:migration`, avec son historique Git contenant les révisions 1.4 et 1.5.
Cette commande de recette du template n’est pas exécutable dans un repository d’application sans cet historique.
Cette validation initialise deux fixtures avec une feature métier, vérifie le bilan, applique le portage décrit et vérifie les builds.
La fixture 1.4 garde l'état personnel désactivé sans table déclarée ni binding MODIFY.
La fixture 1.5 conserve ses déclarations de tables personnelles. Aucun DDL n'est exécuté.
Les requêtes, sources, contrats métier et personnalisations sont comparés avant et après migration.
Les seuls ajouts de configuration à la fixture 1.4 sont les variables personnelles optionnelles et désactivées.
Ces fixtures couvrent le contrat du template ; chaque application doit aussi tester ses adaptations.

La recette distante couvre deux utilisateurs Genie, l’isolation personnelle, la reprise après redémarrage et les logs.
Elle reste nécessaire avant adoption en production.
Le rollback redéploie le SHA précédent puis aligne Git par pull request. Il ne supprime aucune table.

## Porter Genie et le contexte de comparaison

Conserver les alias, les bindings et les callbacks existants. Porter ensemble `src/features/genie/server`,
`src/server/genie-plugin.ts`, l’enregistrement dans `src/server/index.ts` et la route de session.
Le plugin AppKit reçoit les ressources du registre existant ; aucun second manifeste ni nouveau droit n’est requis.
Garder le client HTTP de compatibilité pour les opérations encore non conformes dans AppKit 0.76.1.
Ne pas ajouter les routes génériques du plugin et ne pas basculer de transport après une erreur d’envoi.
Le serveur configure `sendMessage` au démarrage. Les tests qui appellent directement `streamGenieMessage`
doivent aussi configurer le plugin ou injecter cette dépendance ; la fixture `tests/fixtures/genie-appkit.ts`
exerce le vrai plugin avec un client synthétique, sans credential.

`GenieChat` garde son API ; `initialQuestion` est facultatif et n’envoie rien automatiquement.
La prop `genie` de `PeriodComparison` est également facultative. La renseigner seulement après validation du Space,
des sources, des définitions et des périodes. Voir [le parcours](genie.md).
Les tables d’état personnel restent inchangées ; le contexte enrichi et les résultats ne sont pas persistés.
Tester OBO, interruption, refus, troncature et absence de double envoi avant la recette distante autorisée.
