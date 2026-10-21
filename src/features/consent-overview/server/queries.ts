// All queries target IDENTIFIER(:source) — never interpolate user input.
// device_type_agg formula sourced from Looker Studio field definition (verified 2026-10-21).

export const KPI_HEADER_QUERY = `
SELECT
  COUNT(DISTINCT email_hash)                                                               AS contact_total,
  COUNT(DISTINCT CASE WHEN fl_consent_w_choice THEN email_hash END)                       AS contact_with_choice,
  COUNT(DISTINCT CASE WHEN current_consent = 'accept_all'    THEN email_hash END)         AS opt_in,
  COUNT(DISTINCT CASE WHEN current_consent = 'custom_choices' THEN email_hash END)        AS custom,
  COUNT(DISTINCT CASE WHEN current_consent = 'reject_all'    THEN email_hash END)         AS opt_out,
  COUNT(DISTINCT CASE WHEN NOT fl_consent_w_choice OR fl_consent_w_choice IS NULL
                       THEN email_hash END)                                                AS without_choice,
  MAX(KRA_UPDATE_DATE_TIME)                                                                AS last_event_at
FROM IDENTIFIER(:source)
`;

export const OPT_IN_BY_MONTH_QUERY = `
SELECT
  DATE_FORMAT(CONVERT_TIMEZONE('UTC', 'Europe/Paris', event_timestamp), 'yyyy-MM') AS month,
  SUM(CASE WHEN fl_first_consent = true  THEN 1 ELSE 0 END)                        AS first_consent,
  SUM(CASE WHEN fl_first_consent = false THEN 1 ELSE 0 END)                        AS refresh
FROM IDENTIFIER(:source)
WHERE current_consent = 'accept_all'
  AND event_timestamp >= :startTs
  AND event_timestamp <  :endTs
GROUP BY 1
ORDER BY 1 ASC
`;

export const CONSENT_BY_MEMBER_QUERY = `
SELECT
  member,
  COUNT(DISTINCT CASE WHEN current_consent = 'accept_all'     THEN email_hash END) AS opt_in,
  COUNT(DISTINCT CASE WHEN current_consent = 'reject_all'     THEN email_hash END) AS opt_out,
  COUNT(DISTINCT CASE WHEN current_consent = 'custom_choices' THEN email_hash END) AS custom,
  COUNT(DISTINCT CASE WHEN fl_consent_w_choice                THEN email_hash END) AS total
FROM IDENTIFIER(:source)
GROUP BY 1
ORDER BY opt_in DESC
`;

// device_type_agg from Looker Studio — verified 2026-10-21
export const CONSENT_BY_DEVICE_QUERY = `
SELECT
  CASE
    WHEN LOWER(channel)     IN ('app')                          THEN 'App'
    WHEN LOWER(channel)     IN ('kiosk')                        THEN 'Kiosk'
    WHEN LOWER(channel)     IN ('dooh')                         THEN 'DOOH'
    WHEN LOWER(device_type) IN ('m', 'mobile', 'tablet')        THEN 'Web mobile'
    WHEN LOWER(device_type) IN ('d', 'desktop')                 THEN 'Desktop'
    ELSE 'Unknown'
  END                                                                                AS device_type,
  COUNT(DISTINCT CASE WHEN current_consent = 'accept_all' THEN email_hash END)      AS opt_in,
  COUNT(DISTINCT CASE WHEN current_consent = 'reject_all' THEN email_hash END)      AS opt_out,
  COUNT(DISTINCT CASE WHEN fl_consent_w_choice            THEN email_hash END)      AS total
FROM IDENTIFIER(:source)
GROUP BY 1
ORDER BY total DESC
`;

export const CONSENT_BY_PAGE_TYPE_QUERY = `
SELECT
  COALESCE(page_type_display, 'Unknown')                                            AS page_type,
  COUNT(DISTINCT CASE WHEN current_consent = 'accept_all' THEN email_hash END)      AS opt_in,
  COUNT(DISTINCT CASE WHEN current_consent = 'reject_all' THEN email_hash END)      AS opt_out,
  COUNT(DISTINCT CASE WHEN fl_consent_w_choice            THEN email_hash END)      AS total
FROM IDENTIFIER(:source)
WHERE page_type_display IS NOT NULL
GROUP BY 1
ORDER BY total DESC
LIMIT 20
`;

export const OPT_IN_RATE_EVOLUTION_QUERY = `
SELECT
  CAST(CONVERT_TIMEZONE('UTC', 'Europe/Paris', event_timestamp) AS DATE) AS day,
  CAST(
    COUNT(DISTINCT CASE WHEN current_consent = 'accept_all' THEN email_hash END) AS DOUBLE
  ) / NULLIF(COUNT(DISTINCT CASE WHEN fl_consent_w_choice THEN email_hash END), 0) AS consent_rate
FROM IDENTIFIER(:source)
WHERE event_timestamp >= :startTs
  AND event_timestamp <  :endTs
GROUP BY 1
ORDER BY 1 ASC
`;
