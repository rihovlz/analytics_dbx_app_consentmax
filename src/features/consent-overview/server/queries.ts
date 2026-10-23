// Toutes les requêtes utilisent IDENTIFIER(:source) — aucune interpolation utilisateur.
// device_type_agg issu de la définition Looker Studio (vérifié 2026-10-21).

// ── Helpers ───────────────────────────────────────────────────────────────────

export const DEVICE_TYPE_EXPR = `CASE
    WHEN LOWER(channel)     IN ('app')                   THEN 'App'
    WHEN LOWER(channel)     IN ('kiosk')                 THEN 'Kiosk'
    WHEN LOWER(channel)     IN ('dooh')                  THEN 'DOOH'
    WHEN LOWER(device_type) IN ('m', 'mobile', 'tablet') THEN 'Web mobile'
    WHEN LOWER(device_type) IN ('d', 'desktop')          THEN 'Desktop'
    ELSE 'Unknown'
  END`;

// Valeurs autorisées pour les filtres IN (jamais d'interpolation utilisateur non validée)
const ALLOWED_MEMBERS = new Set([
  "LRM","BOU","DEC","AUC","KIA","ELD","ONY","NOR",
  "JUL","CHD","RGO","BZB","TAO","FLU","ALI","TSM","CEE","VLZ",
]);
const ALLOWED_DEVICES = new Set(["Web mobile","Desktop","App","Kiosk","DOOH","Unknown"]);

/** Construit une clause IN validée. Retourne "1=1" si aucune valeur valide. */
export function buildInClause(expr: string, values: string[], allowed: Set<string>): string {
  const safe = values.filter((v) => allowed.has(v));
  if (safe.length === 0) return "1=1";
  const list = safe.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
  return `(${expr}) IN (${list})`;
}

/** Construit WHERE_FILTERS avec les clauses IN dynamiques validées. */
export function buildWhereFilters(opts: {
  members?: string[];
  deviceTypes?: string[];
  includeTimestamp?: boolean; // true = ajoute startTs/endTs via params nommés
}): string {
  const parts: string[] = [];
  if (opts.members && opts.members.length > 0) {
    parts.push(buildInClause("member", opts.members, ALLOWED_MEMBERS));
  }
  if (opts.deviceTypes && opts.deviceTypes.length > 0) {
    parts.push(buildInClause(DEVICE_TYPE_EXPR, opts.deviceTypes, ALLOWED_DEVICES));
  }
  if (opts.includeTimestamp !== false) {
    parts.push("(:startTs IS NULL OR event_timestamp >= :startTs)");
    parts.push("(:endTs   IS NULL OR event_timestamp <  :endTs)");
  }
  return parts.length > 0 ? `WHERE ${parts.join("\n  AND ")}` : ""
;
}

// ── Builders de query ─────────────────────────────────────────────────────────
// Chaque fonction reçoit les filtres validés et retourne le SQL.

type FilterOpts = { members?: string[]; deviceTypes?: string[] };

export function kpiHeaderQuery(f: FilterOpts): string {
  const w = buildWhereFilters({ ...f, includeTimestamp: true });
  return `SELECT
  COUNT(DISTINCT email_hash)                                                          AS contact_total,
  COUNT(DISTINCT CASE WHEN fl_consent_w_choice             THEN email_hash END)       AS contact_with_choice,
  COUNT(DISTINCT CASE WHEN current_consent = 'accept_all'    THEN email_hash END)     AS opt_in,
  COUNT(DISTINCT CASE WHEN current_consent = 'custom_choices' THEN email_hash END)    AS custom,
  COUNT(DISTINCT CASE WHEN current_consent = 'reject_all'    THEN email_hash END)     AS opt_out,
  COUNT(DISTINCT CASE WHEN NOT fl_consent_w_choice OR fl_consent_w_choice IS NULL
                       THEN email_hash END)                                            AS without_choice,
  MAX(CONVERT_TIMEZONE('UTC', 'Europe/Paris', event_timestamp))                        AS last_event_at
FROM IDENTIFIER(:source)
${w}`;
}

export function optInByPeriodQuery(f: FilterOpts): string {
  const memberClause   = f.members && f.members.length > 0
    ? `AND ${buildInClause("member", f.members, ALLOWED_MEMBERS)}` : "";
  const deviceClause   = f.deviceTypes && f.deviceTypes.length > 0
    ? `AND ${buildInClause(DEVICE_TYPE_EXPR, f.deviceTypes, ALLOWED_DEVICES)}` : "";
  return `SELECT
  CASE
    WHEN :granularity = 'day'
      THEN CAST(CONVERT_TIMEZONE('UTC', 'Europe/Paris', event_timestamp) AS DATE)
    WHEN :granularity = 'week'
      THEN CONCAT(
        YEAR(CONVERT_TIMEZONE('UTC', 'Europe/Paris', event_timestamp)), '-W',
        LPAD(WEEKOFYEAR(CONVERT_TIMEZONE('UTC', 'Europe/Paris', event_timestamp)), 2, '0')
      )
    ELSE DATE_FORMAT(CONVERT_TIMEZONE('UTC', 'Europe/Paris', event_timestamp), 'yyyy-MM')
  END                                                                                  AS period,
  SUM(CASE WHEN fl_first_consent = true  THEN 1 ELSE 0 END)                           AS first_consent,
  SUM(CASE WHEN fl_first_consent = false THEN 1 ELSE 0 END)                           AS reexposed
FROM IDENTIFIER(:source)
WHERE current_consent = 'accept_all'
  AND event_timestamp >= :startTs
  AND event_timestamp <  :endTs
  ${memberClause}
  ${deviceClause}
GROUP BY 1
ORDER BY 1 ASC`;
}

export function consentByMemberQuery(f: FilterOpts): string {
  const w = buildWhereFilters({ ...f, includeTimestamp: true });
  return `SELECT
  member,
  COUNT(DISTINCT CASE WHEN current_consent = 'accept_all'     THEN email_hash END)   AS opt_in,
  COUNT(DISTINCT CASE WHEN current_consent = 'reject_all'     THEN email_hash END)   AS opt_out,
  COUNT(DISTINCT CASE WHEN current_consent = 'custom_choices' THEN email_hash END)   AS custom,
  COUNT(DISTINCT CASE WHEN fl_consent_w_choice                THEN email_hash END)   AS total
FROM IDENTIFIER(:source)
${w}
GROUP BY 1
ORDER BY opt_in DESC`;
}

export function consentByDeviceQuery(f: FilterOpts): string {
  const w = buildWhereFilters({ ...f, includeTimestamp: true });
  return `SELECT
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
${w}
GROUP BY 1
ORDER BY total DESC`;
}

export function consentByPageTypeQuery(f: FilterOpts): string {
  const w = buildWhereFilters({ ...f, includeTimestamp: true });
  return `SELECT
  COALESCE(page_type_display, 'Unknown')                                             AS page_type,
  COUNT(DISTINCT CASE WHEN current_consent = 'accept_all' THEN email_hash END)      AS opt_in,
  COUNT(DISTINCT CASE WHEN current_consent = 'reject_all' THEN email_hash END)      AS opt_out,
  COUNT(DISTINCT CASE WHEN fl_consent_w_choice            THEN email_hash END)      AS total
FROM IDENTIFIER(:source)
${w}
  AND page_type_display IS NOT NULL
GROUP BY 1
ORDER BY total DESC
LIMIT 20`;
}

export function optInRateEvolutionQuery(f: FilterOpts): string {
  const memberClause = f.members && f.members.length > 0
    ? `AND ${buildInClause("member", f.members, ALLOWED_MEMBERS)}` : "";
  const deviceClause = f.deviceTypes && f.deviceTypes.length > 0
    ? `AND ${buildInClause(DEVICE_TYPE_EXPR, f.deviceTypes, ALLOWED_DEVICES)}` : "";
  return `SELECT
  CAST(CONVERT_TIMEZONE('UTC', 'Europe/Paris', event_timestamp) AS DATE)            AS day,
  CAST(
    COUNT(DISTINCT CASE WHEN current_consent = 'accept_all' THEN email_hash END) AS DOUBLE
  ) / NULLIF(COUNT(DISTINCT CASE WHEN fl_consent_w_choice THEN email_hash END), 0) AS consent_rate
FROM IDENTIFIER(:source)
WHERE event_timestamp >= :startTs
  AND event_timestamp <  :endTs
  ${memberClause}
  ${deviceClause}
GROUP BY 1
ORDER BY 1 ASC`;
}
