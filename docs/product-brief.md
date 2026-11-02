# Brief produit

## Objectif et utilisateurs

- Type : dashboard
- Utilisateurs : À confirmer
- Décision à faciliter : À confirmer
- Critère de succès : À confirmer

## Capacités envisagées

Ces choix cadrent le besoin ; ils n’activent ni plugin, ni ressource, ni droit.

- **analytics** : KPI, filtres et agrégations SQL. Guide : [docs/databricks.md](../docs/databricks.md).

## KPI, sources et fonctionnalités

### Vue d'ensemble ConsentMax

- Question : Quel est l'état global du consentement ?
- Source : `last-consent-event`
- KPI : Opt-in (count, contacts)
- Critère d’acceptation : COUNT(*) WHERE current_consent = accept_all

## Accès, confidentialité et exploitation

À confirmer avant le premier accès à des données réelles.

## Backlog

Construire et faire valider une tranche à la fois.
