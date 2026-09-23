# Migration volontaire de 1.5.0 vers 2.0.0

La version 2.0.0 remplace Next.js par AppKit, Vite et React Router.
Les applications 1.5.0 continuent de fonctionner sans migration automatique.
Les requêtes métier, déclarations d’accès, tables personnelles et personnalisations Valiuz restent propres à chaque application.

## Préparer la branche

1. Créer une branche dédiée depuis la révision de production.
2. Conserver le SHA déployé pour le rollback.
3. Exécuter les validations 1.5.0 avant toute modification.
4. Afficher le guide avec `npm run template:diff -- --from 1.5.0 --to 2.0.0`.
5. Inventorier les pages, handlers, chargements serveur, personnalisations et usages de Next.js.
6. Relever les résultats attendus des tests métier.

## Porter les fichiers du socle

Fusionner les fichiers nommés dans le guide YAML. Ne pas remplacer un dossier métier complet.
Fusionner `package.json`, puis exécuter `npm install` avec Node.js 22.16+.
Les versions initiales de `@databricks/appkit` et `@databricks/appkit-ui` sont exactement `0.76.1`.
Le Vite utilisé correspond à la dépendance d’AppKit. Le lockfile reste dans Git.

| Contrat 1.5 | Contrat 2.0 |
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

Conserver le client Genie existant et ses tests OBO.
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

1. Exécuter lint, typecheck, tests unitaires et build.
2. Exécuter `npm run test:e2e` et vérifier les thèmes, le clavier et le mobile.
   Après le build, exécuter aussi `E2E_PRODUCTION=1 npm run test:e2e` pour les fichiers statiques de production.
   Ce second parcours vérifie l’état personnel désactivé : le stockage de démo reste réservé au développement.
3. Exécuter `npm run bundle:compatibility`.
4. Exécuter `npm run template:check -- --to 2.0.0`.
5. Après succès, déclarer la version 2.0.0 dans `.valiuz-template.yml`.
6. Ajouter les capabilities `appkit-native-runtime` et `upstream-compatibility`.
7. Ajouter `1.5.0-to-2.0.0` dans `appliedUpgrades`.
8. Exécuter `npm run app:doctor` et `npm run check`.
9. Après autorisation, déployer en développement et effectuer la recette distante.

Le repository source fournit `npm run template:migration`, avec son historique Git contenant la révision 1.5.
Cette commande de recette du template n’est pas exécutable dans un repository d’application sans cet historique.
Cette validation initialise une fixture 1.5 avec une feature métier, applique le portage décrit et vérifie le build.
Elle compare les requêtes, sources, tables personnelles et personnalisations avant et après migration.

La recette distante couvre deux utilisateurs Genie, l’isolation personnelle, la reprise après redémarrage et les logs.
Elle reste nécessaire avant adoption en production.
Le rollback redéploie le SHA précédent puis aligne Git par pull request. Il ne supprime aucune table.
