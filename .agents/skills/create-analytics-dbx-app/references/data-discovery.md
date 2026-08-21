# Découverte des sources Databricks

Utiliser ce parcours lorsque les tables, vues, grains, clés ou garanties de fraîcheur ne sont pas suffisamment connus
pour définir les KPI et les requêtes. Le résultat attendu est un contrat de source vérifiable, pas un export de données.

## Partir de ce qui est déjà connu

Lire `docs/product-brief.md`, la configuration serveur et les repositories existants. Distinguer les informations
confirmées, les hypothèses et les inconnues. Demander au maximum trois précisions à la fois, en privilégiant :

1. la question métier et le grain recherché ;
2. le workspace, le warehouse, le projet/catalogue et le schema autorisés ;
3. les tables ou vues candidates et leur propriétaire.

Ne pas lancer une exploration distante si les fichiers locaux, la documentation de la source ou un contrat fourni
répondent déjà à la question.

## Sécuriser l'exploration distante

Avant tout accès distant, même en lecture seule, afficher et faire confirmer :

```text
Workspace : <host>
Identité ou profil : <nom non secret>
Warehouse : <nom ou identifiant>
Projet/catalogue : <catalog>
Schema : <schema>
Objets candidats : <liste bornée>
```

Lorsque le repository fournit `npm run databricks:check`, l'exécuter d'abord pour vérifier l'identité et le périmètre
sans SQL. Utiliser ensuite le même profil pour toute exploration approuvée ; ne jamais extraire ou recopier son jeton.

Vérifier que l'identité dispose uniquement des accès nécessaires. Une exploration ne justifie ni grant, ni SQL
d'écriture, ni nouveau job, ni copie locale de résultats. Ne jamais afficher ou enregistrer un token.

## Explorer du général au précis

Utiliser le mécanisme de requête en lecture seule déjà disponible dans l'environnement. Préférer successivement :

1. les métadonnées `information_schema` pour inventorier un nombre borné d'objets et de colonnes ;
2. `DESCRIBE TABLE` ou son équivalent pour le schéma, le type et les propriétés d'un objet confirmé ;
3. des agrégations bornées pour compter les lignes, mesurer les valeurs nulles, estimer l'unicité et vérifier les dates ;
4. des regroupements agrégés pour détecter doublons de clés, grains mixtes ou explosions de jointure.

Valider et citer chaque partie d'un identifiant Unity Catalog avant de l'utiliser. Paramétrer toutes les valeurs de
filtre. Ne jamais transformer une saisie libre en fragment SQL. Fixer un nom de requête, un timeout et une limite de
lignes pour chaque contrôle.

Éviter les échantillons de lignes. Si un cas ne peut pas être compris sans exemple, demander une autorisation ciblée,
sélectionner uniquement des colonnes non sensibles et appliquer une limite très basse. Ne jamais copier une ligne
client dans le brief, une fixture, un prompt ou un log.

## Établir le contrat de source

Pour chaque objet retenu, consigner dans `docs/product-brief.md` :

```markdown
### <catalog.schema.object>

- Statut : Confirmé | À confirmer | Rejeté
- Type et propriétaire :
- Finalité métier :
- Grain d'une ligne :
- Clé ou clés candidates :
- Colonne temporelle et fuseau :
- Fréquence et délai de rafraîchissement :
- Profondeur d'historique :
- Dimensions et mesures utiles :
- Valeurs nulles, doublons ou règles de validité connus :
- Classification des champs sensibles :
- Jointures autorisées et cardinalités attendues :
- Privilèges minimaux nécessaires :
- Preuve consultée et date de vérification :
```

Enregistrer également chaque objet confirmé dans `config/data-access.json`. Son `fullName` doit commencer par le projet
sélectionné et sa `purpose` doit expliquer pourquoi l'app en a besoin. Exécuter `npm run data:access:render`, relire le
binding `SELECT` généré et committer les deux fichiers ensemble. Ne pas déclarer un objet seulement exploratoire.

Comparer le grain de la source au grain du KPI. Pour chaque jointure candidate, expliciter la cardinalité attendue et
contrôler le nombre de lignes avant et après. Marquer `À confirmer` dès que la preuve est insuffisante.

## Clore la découverte

Résumer les objets retenus et rejetés, les contrôles réellement exécutés, les bindings déclarés, les limites de la
preuve et les inconnues.
Proposer ensuite une seule requête métier, bornée et testable, pour la prochaine tranche. L'exploration n'est pas une
autorisation de modifier les grants, les données ou le déploiement.
