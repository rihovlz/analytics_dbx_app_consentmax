# Intégration ConsentMax et template 3.0.0

Préconditions : serveur en mode démo, aucune connexion Databricks.
Self stats utilise sa démo ; Alliance et Missings utilisent des réponses synthétiques interceptées,
car leurs services existants exigent un accès SQL réel.

- Ouvrir `/` et vérifier la redirection vers Self stats et l'affichage des KPI.
- Choisir un membre, appliquer le filtre et vérifier le paramètre envoyé et son retour dans la réponse.
- Naviguer vers Alliance puis Missings, changer FR/EN et vérifier la langue après rechargement.
- Vérifier l'absence de lien Genie.
- Retarder puis refuser la réponse Self stats et vérifier les états de chargement et d'erreur.

Hors scope : validation des KPI sur données réelles, permissions des sources et export PDF.
