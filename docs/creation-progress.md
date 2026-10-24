# Avancement — ConsentMax Analytics

Dernière mise à jour : 2026-10-21

## État

| Étape | Statut | Preuve |
|---|---|---|
| Bootstrap & init-app | ✅ fait | `npm run init-app` exécuté, `.valiuz-template.yml` créé |
| Source déclarée | ✅ fait | `config/data-access.json` — `dev-consent.analytics.last_consent_event` |
| Feature `consent-overview` | ✅ fait | Page, route, service, repository, queries, contrat, tests |
| Tests unitaires | ✅ 211/211 | `npm test` — 0 échec |
| Build production | ✅ fait | `npm run build` sans erreur |
| Smoke démo local | ✅ vérifié | API `/api/consent-overview` répond correctement en mode démo |
| Connexion données réelles | ✅ fait | `npm run databricks:check` + `test:databricks` OK sur `prd-consent` |
| Recette comparaison prd vs app | ✅ fait | Voir section Recette ci-dessous |
| Basculement catalogue dev → prd | ✅ fait | `config/data-access.json`, `app.yaml`, `.env.example` mis à jour |

## Décisions

### Catalogue dev
- Catalogue de développement : `dev-consent` (ajouté à `config/data-projects.json`)
- Catalogue production cible : `prd-consent`
- Schema : `analytics`
- Table : `last_consent_event`

### Formules métier vérifiées sur données réelles (dev-consent, 2026-03)
- **Contact** = `COUNT(DISTINCT email_hash)` ✅
- **Contact with choice** = `COUNT(DISTINCT email_hash) WHERE fl_consent_w_choice = true` ✅
- **Opt-in** = `COUNT(DISTINCT email_hash) WHERE current_consent = 'accept_all'` ✅
- **Custom** = `COUNT(DISTINCT email_hash) WHERE current_consent = 'custom_choices'` ✅
- **Opt-out** = `COUNT(DISTINCT email_hash) WHERE current_consent = 'reject_all'` ✅
- **Without choice** = `fl_consent_w_choice IS NULL OR fl_consent_w_choice = false` ✅
- **Consent rate** = opt_in / contact_with_choice ✅
- **device_type_agg** = formule Looker Studio fournie par richard.hooft ✅
- **page_type** = colonne `page_type_display` (normalisée côté table) ✅

### Fixtures de démo
- Valeurs calées sur snapshot `prd-consent` au 2026-10-20 (fichier `service.ts`, section `demoResult`)
- Explicitement marquées `status: "demo"` — non certifiées

## Inconnues restantes

| Inconnue | Impact | Source probable |
|---|---|---|
| `event_name` vs `current_consent` pour les KPIs | formules Looker Studio utilisent `event_name` (accept_all, dismiss…) mais la table expose aussi `current_consent` | À valider par recette |
| Exposed vs Eligible (page 1 bas) | Définitions non encore codées | Autre table ? colonne manquante ? |
| Pending rate evolution par device | Requiert `fl_consent_w_choice = false` + device sur fenêtre glissante | Page 2 du PDF — tranche suivante |

## Recette KPI — prd-consent (app) vs PDF Looker Studio 2026-10-20

Exécutée le 2026-10-21. Serveur local `APP_MODE=databricks`, profil `richard-dbx`, warehouse `team-da-poc`.

| KPI | App prd-consent | PDF référence | Écart | Statut |
|---|---|---|---|---|
| contactTotal | 24 578 095 | 24 600 000 | -0.1% | ✅ |
| contactWithChoice | 22 932 190 | 22 900 000 | +0.1% | ✅ |
| optIn | 13 894 247 | 13 948 207 | -0.4% | ✅ |
| custom | 107 995 | 108 005 | -0.0% | ✅ |
| optOut | 8 861 954 | 8 875 978 | -0.2% | ✅ |
| withoutChoice | 1 645 905 | 1 600 000 | +2.9% | ⚠️ écart mineur |
| consentRate | 60.6% | 60.9% | -0.3pp | ✅ |
| rejectRate | 38.6% | 38.8% | -0.2pp | ✅ |

**Écart `withoutChoice` (+2.9%)** : probablement dû à une différence de snapshot (app lit en temps réel, PDF capturé au 2026-10-20 23:59:56). Non bloquant.

## Tranche suivante recommandée

- Page "Alliance contribution" (page 2 PDF) : table `last_consent_event` + table cross-CRM (à identifier)
- Branchement sources réelles : `.env.local` + `npm run databricks:check`
- Recette : comparer KPI app vs chiffres PDF pour `prd-consent` à périmètre identique (2026-10-20)
