// Source de référence : traitement dtm-core-enrichment (reports.py, optin_missing_contacts).
export const MISSING_SOURCE = "prd-dtm-core-enrichment.analytics.optin_missing_contacts";
export const HISTO_SOURCE = "prd-dtm-core-enrichment.analytics.optin_missing_contacts_histo";

export const missingRowsQuery = `SELECT
  consent_member AS member,
  nb_email_optin AS self,
  nb_email_not_in_member_profiles AS unknown
FROM IDENTIFIER(:source)`;

export const historyQuery = `SELECT
  CAST(histo_date AS STRING) AS day,
  consent_member AS member,
  CASE WHEN nb_email_optin > 0 THEN nb_email_not_in_member_profiles / nb_email_optin END AS unknown_pct
FROM IDENTIFIER(:histoSource)
ORDER BY 1, 2`;
