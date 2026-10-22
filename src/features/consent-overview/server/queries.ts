// Toutes les requêtes utilisent IDENTIFIER(:source) — aucune interpolation utilisateur.
// device_type_agg issu de la définition Looker Studio (vérifié 2026-10-21).

// ── Clause WHERE commune ──────────────────────────────────────────────────────
// Les paramètres :member, :startTs, :endTs sont optionnels : si NULL, la clause est ignorée.

const WHERE_FILTERS = `
WHERE (:member IS NULL OR member = :member)
  AND (:startTs IS NULL OR event_timestamp >= :startTs)
  AND (:endTs   IS NULL OR event_timestamp <  :endTs)
`;

// ── KPI header ────────────────────────────────────────────────────────────────

export const KPI_HEADER_QUERY = `
SELECT
  COUNT(DISTINCT email_hash)                                                          AS contact_total,
  COUNT(DISTINCT CASE WHEN fl_consent_w_choice             THEN email_hash END)       AS contact_with_choice,
  COUNT(DISTINCT CASE WHEN current_consent = 'accept_all'    THEN email_hash END)     AS opt_in,
  COUNT(DISTINCT CASE WHEN current_consent = 'custom_choices' THEN email_hash END)    AS custom,
  COUNT(DISTINCT CASE WHEN current_consent = 'reject_all'    THEN email_hash END)     AS opt_out,
  COUNT(DISTINCT CASE WHEN NOT fl_consent_w_choice OR fl_consent_w_choice IS NULL
                       THEN email_hash END)                                            AS without_choice,
  MAX(KRA_UPDATE_DATE_TIME)                                                            AS last_event_at
FROM IDENTIFIER(:source)
${WHERE_FILTERS}
`;

// ── Opt-in by period (day / week / month) ─────────────────────────────────────
// :granularity = 'day' | 'week' | 'month'
// On calcule le label côté SQL pour éviter des manipulations JS complexes.

export const OPT_IN_BY_PERIOD_QUERY = `
SELECT
  CASE
    WHEN :granularity = 'day'
      THEN CAST(CONVERT_TIMEZONE('UTC', 'Europe/Paris', event_timestamp) AS DATE)
    WHEN :granularity = 'week'
      THEN CONCAT(
        YEAR(CONVERT_TIMEZONE('UTC', 'Europe/Paris', event_timestamp)), '-W',
        LPAD(WEEKOFYEAR(CONVERT_TIMEZONE('UTC', 'Europe/Paris', event_timestamp)), 2, '0')
      )
    ELSE
      DATE_FORMAT(CONVERT_TIMEZONE('UTC', 'Europe/Paris', event_timestamp), 'yyyy-MM')
  END                                                                                  AS period,
  SUM(CASE WHEN fl_first_consent = true  THEN 1 ELSE 0 END)                           AS first_consent,
  SUM(CASE WHEN fl_first_consent = false THEN 1 ELSE 0 END)                           AS reexposed
FROM IDENTIFIER(:source)
WHERE (:member IS NULL OR member = :member)
  AND current_consent = 'accept_all'
  AND event_timestamp >= :startTs
  AND event_timestamp <  :endTs
GROUP BY 1
ORDER BY 1 ASC
`;

// ── Consent rate by member ────────────────────────────────────────────────────

export const CONSENT_BY_MEMBER_QUERY = `
SELECT
  member,
  COUNT(DISTINCT CASE WHEN current_consent = 'accept_all'     THEN email_hash END)   AS opt_in,
  COUNT(DISTINCT CASE WHEN current_consent = 'reject_all'     THEN email_hash END)   AS opt_out,
  COUNT(DISTINCT CASE WHEN current_consent = 'custom_choices' THEN email_hash END)   AS custom,
  COUNT(DISTINCT CASE WHEN fl_consent_w_choice                THEN email_hash END)   AS total
FROM IDENTIFIER(:source)
${WHERE_FILTERS}
GROUP BY 1
ORDER BY opt_in DESC
`;

// ── Consent by device (device_type_agg Looker Studio) ────────────────────────

export const CONSENT_BY_DEVICE_QUERY = `
SELECT
  CASE
    WHEN LOWER(channel)     IN ('app')                   THEN 'App'
    WHEN LOWER(channel)     IN ('kiosk')                 THEN 'Kiosk'
    WHEN LOWER(channel)     IN ('dooh')                  THEN 'DOOH'
    WHEN LOWER(device_type) IN ('m', 'mobile', 'tablet') THEN 'Web mobile'
    WHEN LOWER(device_type) IN ('d', 'desktop')          THEN 'Desktop'
    ELSE 'Unknown'
  END                                                                                 AS device_type,
  COUNT(DISTINCT CASE WHEN current_consent = 'accept_all' THEN email_hash END)       AS opt_in,
  COUNT(DISTINCT CASE WHEN current_consent = 'reject_all' THEN email_hash END)       AS opt_out,
  COUNT(DISTINCT CASE WHEN fl_consent_w_choice            THEN email_hash END)       AS total
FROM IDENTIFIER(:source)
${WHERE_FILTERS}
GROUP BY 1
ORDER BY total DESC
`;

// ── Consent by page type ──────────────────────────────────────────────────────

export const CONSENT_BY_PAGE_TYPE_QUERY = `
SELECT
  COALESCE(page_type_display, 'Unknown')                                             AS page_type,
  COUNT(DISTINCT CASE WHEN current_consent = 'accept_all' THEN email_hash END)      AS opt_in,
  COUNT(DISTINCT CASE WHEN current_consent = 'reject_all' THEN email_hash END)      AS opt_out,
  COUNT(DISTINCT CASE WHEN fl_consent_w_choice            THEN email_hash END)      AS total
FROM IDENTIFIER(:source)
${WHERE_FILTERS}
  AND page_type_display IS NOT NULL
GROUP BY 1
ORDER BY total DESC
LIMIT 20
`;

// ── Opt-in rate evolution (daily) ─────────────────────────────────────────────

export const OPT_IN_RATE_EVOLUTION_QUERY = `
SELECT
  CAST(CONVERT_TIMEZONE('UTC', 'Europe/Paris', event_timestamp) AS DATE)            AS day,
  CAST(
    COUNT(DISTINCT CASE WHEN current_consent = 'accept_all' THEN email_hash END) AS DOUBLE
  ) / NULLIF(COUNT(DISTINCT CASE WHEN fl_consent_w_choice THEN email_hash END), 0) AS consent_rate
FROM IDENTIFIER(:source)
WHERE (:member IS NULL OR member = :member)
  AND event_timestamp >= :startTs
  AND event_timestamp <  :endTs
GROUP BY 1
ORDER BY 1 ASC
`;
