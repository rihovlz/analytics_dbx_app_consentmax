# Maintenance AppKit et guidance Databricks

Databricks fournit le runtime, les plugins et les intégrations via les packages npm.
Valiuz maintient la marque, les frontières métier, les accès déclarés et les tests de compatibilité.
Le repository ne contient aucun fork d’AppKit et ne publie aucun package Valiuz séparé.

## Versions et contrat

`config/appkit-compatibility.json` contient les versions testées et les révisions amont revues.
Les packages AppKit et AppKit UI commencent à 0.76.1, avec des versions exactes et un lockfile.
Les composants Valiuz existants conservent leurs contrats. Aucun composant AppKit UI ne remplace implicitement leur comportement.
Lors d’une adoption de composant UI, associer ses tokens aux variables de `src/client/globals.css`.

`app:doctor` compare le package, le lockfile, l’installation et la matrice CLI.
Il signale les écarts sans installer ni modifier de fichier.
`config/appkit-resources.generated.json` décrit la correspondance des ressources ; ce fichier est généré par Valiuz.
Il ne remplace ni un manifeste AppKit upstream ni le bundle Databricks.
`data:access:check` vérifie sa cohérence avec les déclarations d’accès.

Les caches de résultats AppKit restent désactivés.
Les routes génériques analytics ne sont pas montées.
Une sous-classe minimale installe `express.raw` avant JSON via le champ `serverApplication` du package 0.76.1.
Cette exception privée est vérifiée par les parcours HTTP réels. Elle conserve 64 Kio au transport et 16 Kio pour l’état personnel.
Le recorder UI automatique de développement est remplacé par un plugin sans route.
Les APIs des features gardent les limites de corps, l’identité et leurs validations.

## Exceptions suivies

| Exception | Motif dans 0.76.1 | Critère de retrait |
| --- | --- | --- |
| Transport Genie actuel | Annulation non transmise à plusieurs appels, politique SDK de reprise non maîtrisée et logs d’erreurs distantes | Tests prouvant soumission unique, OBO, annulation bornée, erreurs sûres et 500 lignes maximum |
| Driver SQL conservé | Écritures privées, paramètres nuls, types natifs, chaînes JSON exactes et diagnostics CLI | Parité explicite de ces contrats dans l’API programmatique |
| Client de démo | AppKit lit l’identité workspace dès son démarrage | Serveur upstream utilisable sans identité distante |
| Fournisseur OAuth CLI | AppKit ignore le profil lorsque le host est fourni | Profil nommé, host validé et renouvellement natifs |
| Politique HTTP locale | `extend()` intervient après JSON et le hook brut accepte uniquement des chemins exacts | Hook public avant parsing et contrôle des routes |

L’adaptateur SQL transmet un signal de délai et borne le résultat inline.
Il demande l’annulation d’un statement connu lors du dépassement.
Une soumission distante interrompue avant réception de son identifiant reste ambiguë.
Le serveur ne promet pas l’annulation effective du compute.
Les erreurs du client SQL sont neutralisées avant les logs AppKit.
Les logs applicatifs gardent seulement le nom de requête, sa durée, son identifiant et le nombre de lignes.

## Skills et plugins d’agents

Les plugins runtime npm et les skills d’agents sont des dépendances différentes.
Installer la guidance stable avec le [CLI Databricks officiel](https://github.com/databricks/databricks-agent-skills) :

```bash
databricks aitools install --agents codex --scope global --skills-only \
  --skills databricks-core,databricks-apps,databricks-dabs,databricks-dbsql
```

Cette installation reste hors du code copié dans les applications.
Le registre indique la release 0.2.10 et sa révision source.
Les skills Valiuz ajoutent les règles de marque, les catalogues autorisés, les KPI et les releases.
Le plan de migration Valiuz prime sur les suggestions de scaffolding générique.
Il conserve les APIs de features et Delta personnel sans ajouter Lakebase.

La [documentation AppKit livrée avec les packages](https://developers.databricks.com/docs/appkit/v0/plugins/server) décrit les APIs exactes.
Les [plugins GA](https://developers.databricks.com/docs/appkit/v0/plugins/stability) sont préférés.
Une adoption beta exige une décision documentée et des tests spécifiques.

## Revue hebdomadaire

Dependabot ouvre des PR npm chaque semaine et groupe AppKit avec AppKit UI.
Aucun workflow ne fusionne automatiquement ces PR.
Le mainteneur examine les changements, les exceptions et les résultats de CI avant fusion.

Le workflow `upstream-check.yml` compare les révisions revues avec les branches amont.
Il produit uniquement un résumé CI avec des liens et fichiers modifiés.
Il ne met à jour aucune dépendance ni révision.
Les permissions GitHub restent en lecture seule.

Après revue, avancer les révisions dans le registre par une PR.
Exécuter les tests de compatibilité, les parcours consommateur et migration, le build et Playwright.
Toute nouvelle version du template reste une migration guidée pour les applications existantes.
