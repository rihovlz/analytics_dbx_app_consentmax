# Design system Valiuz pour les apps analytics

Ce guide traduit l'essentiel des **Valiuz Brand Guidelines 2026** en règles adaptées aux dashboards, cockpits et outils
internes. Il complète la charte : il ne remplace ni les médias officiels ni leurs règles d'usage.

## Principes

1. Faire passer l'information avant la décoration : beaucoup d'espace blanc, une hiérarchie courte et peu d'effets.
2. Utiliser l'orange pour guider l'attention, pas pour colorer tout l'écran.
3. Réserver le gradient Valiuz au logo et à de petits accents structurels. Ne jamais l'appliquer à du texte.
4. Donner un sens stable aux couleurs de données et accompagner la couleur d'un libellé, d'une icône ou d'une valeur.
5. Concevoir chaque état : vide, chargement, succès, erreur, données partielles et absence de permission.

## Tokens de référence

| Token | Valeur | Usage |
| --- | --- | --- |
| Encre | `#212222` | texte, contours et CTA sombres |
| Orange primaire | `#FF9D00` | action principale, métrique critique, accent actif |
| Corail secondaire | `#FF494A` | erreur, alerte ou évolution négative |
| Gradient | `#F75A55` → `#F88033` → `#F2BB06` | logo, ligne ou forme décorative ponctuelle |
| Vert data | `#58B89C` | évolution positive |
| Violet data | `#835CB7` | série de données |
| Ardoise data | `#627C89` | série de données |
| Gris data | `#B5BFC1` | série secondaire ou contexte |

Les couleurs étendues sont des couleurs de visualisation, pas des couleurs de marque pour les titres ou le logo. Les
fonds et bordures neutres du shell sont des adaptations UI destinées à préserver le contraste.

## Typographie

- Utiliser **Outfit**, auto-hébergée par l'application, pour le shell et les écrans métier.
- Réserver `800–900` aux titres courts, `600–700` aux libellés importants et `300–400` au corps de texte.
- Employer Inter, Roboto ou une police système très lisible pour une table ou un graphique exceptionnellement dense.
- Garder Caveat hors des données et des longs textes ; elle n'est pertinente que pour une annotation éditoriale courte.

## Logo et identité

- Utiliser `public/valiuz-logo-icon.svg` sur fond clair et conserver ses proportions.
- Afficher l'icône à au moins 45 px en numérique, avec une zone libre autour.
- Ne pas enfermer le logo dans une carte, ne pas ajouter d'ombre et ne pas recolorer son SVG.
- Sur fond sombre, utiliser un média officiel prévu pour fond sombre plutôt qu'un filtre CSS.

## Composants et interactions

- Une action principale par zone. L'orange primaire porte un texte `#212222` pour rester lisible ; éviter le texte blanc
  sur orange.
- Les zones cliquables font au moins 44 px de haut et possèdent un focus clavier visible.
- La navigation indique uniquement la page réellement active avec `aria-current="page"`.
- Les animations restent courtes et respectent `prefers-reduced-motion`.
- Les messages techniques restent côté serveur. L'interface donne une action suivante et, si disponible, une référence
  partageable au support.

## Data visualisation

- Préférer les graphiques 2D simples, les axes explicites, les unités visibles et les comparaisons directes.
- Utiliser la palette data pour les séries standard, le vert pour le positif, le corail pour le négatif et l'orange pour
  la mesure la plus importante.
- Éviter les ombres inutiles, la 3D, les doubles axes ambigus et les gradients sur plusieurs séries.
- Ne jamais encoder une information uniquement par la couleur. Ajouter signe, libellé, motif ou annotation accessible.
- Afficher la définition du KPI, sa période, sa fraîcheur et sa source à proximité ou dans une aide contextuelle.

## Checklist d'une nouvelle page

- Le titre répond à la décision que l'utilisateur doit prendre.
- Le KPI principal est identifiable en quelques secondes.
- Les filtres ont des valeurs initiales compréhensibles et peuvent être réinitialisés.
- Les états vide, chargement, erreur et absence d'accès sont testés.
- Le clavier, le mobile et un zoom à 200 % restent utilisables.
- Les couleurs et formats d'un même KPI sont stables sur toutes les pages.
