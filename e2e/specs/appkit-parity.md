# Parité AppKit 2.0

Préconditions : serveur AppKit local, APP_MODE=demo, analyses personnelles activées, aucune donnée distante.
Fixtures : données synthétiques Genie et visualisations ; définitions personnelles en mémoire.

- Naviguer entre les URL conservées avec la navigation, puis recharger une route directe.
- Au clavier, atteindre le lien d’évitement et le contenu.
- Vérifier les thèmes clair/sombre et l’absence de débordement sur mobile.
- Retarder puis refuser une réponse de configuration ou de visualisation et vérifier l’état observable.
- Afficher une bibliothèque vide, enregistrer des filtres, modifier une note, rouvrir et supprimer l’analyse.
- Vérifier que le payload personnel ne contient que la définition, le nom et la note.
- Après interruption d’un POST Genie, vérifier le verrouillage sans rejeu.
- Vérifier les limites HTTP 64 Kio / 16 Kio, le refus UTF-8 invalide et les routes génériques absentes.
- Rejouer avec `E2E_PRODUCTION=1` après build pour les routes directes et assets de production.
  L’état personnel reste désactivé dans ce parcours : l’identité de démo en mémoire est interdite en production.

Hors scope : données, OBO réel, persistance Delta et déploiement. Leur recette exige une autorisation distante.
