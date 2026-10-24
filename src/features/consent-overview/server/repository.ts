import { z } from "zod";

import {
  type ConsentByDeviceRow,
  type ConsentByMemberRow,
  type ConsentByPageTypeRow,
  type FilterParams,
  type KpiHeader,
  type OptInByPeriodRow,
  type OptInRateEvolutionRow,
  consentByDeviceSchema,
  consentByMemberSchema,
  consentByPageTypeSchema,
  kpiHeaderSchema,
  optInByPeriodSchema,
  optInRateEvolutionSchema,
} from "@/features/consent-overview/contract";
import {
  consentByDeviceQuery,
  consentByMemberQuery,
  consentByPageTypeQuery,
  kpiHeaderQuery,
  optInByPeriodQuery,
  optInRateEvolutionQuery,
} from "@/features/consent-overview/server/queries";
import { quoteQualifiedIdentifier } from "@/lib/databricks/identifiers";
import type { SqlExecutor } from "@/lib/databricks/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function periodWindow(filters: FilterParams): { startTs: string; endTs: string } {
  const now     = new Date();
  const endTs   = (filters.endDate   ? new Date(`${filters.endDate}T23:59:59Z`)   : now).toISOString();
  const startTs = filters.startDate
    ? new Date(`${filters.startDate}T00:00:00Z`).toISOString()
    : new Date("2024-10-01T00:00:00Z").toISOString();
  return { startTs, endTs };
}

/** Retourne les startTs/endTs des 30 derniers jours (indépendant des filtres date). */
function last30DaysWindow(): { startTs: string; endTs: string } {
  const now = new Date();
  const s   = new Date(now); s.setDate(s.getDate() - 30);
  return { startTs: s.toISOString(), endTs: now.toISOString() };
}

/** Nombre de jours entre deux dates ISO. */
function daysBetween(startDate?: string, endDate?: string): number {
  const s = startDate ? new Date(startDate) : new Date("2024-10-01");
  const e = endDate   ? new Date(endDate)   : new Date();
  return Math.round((e.getTime() - s.getTime()) / 86_400_000);
}

function baseParams(source: string, filters: FilterParams, ts: { startTs: string; endTs: string }) {
  return {
    source: quoteQualifiedIdentifier(source),
    startTs: ts.startTs,
    endTs:   ts.endTs,
  };
}

function filterOpts(filters: FilterParams) {
  return { members: filters.members, deviceTypes: filters.deviceTypes };
}

// ── Schémas SQL ───────────────────────────────────────────────────────────────

const coerceNum  = z.preprocess((v) => (typeof v === "bigint" ? Number(v) : v), z.coerce.number());
const coerceDate = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v)),
  z.string(),
);

const kpiRowSchema = z.object({
  contact_total:        coerceNum,
  contact_with_choice:  coerceNum,
  opt_in:               coerceNum,
  custom:               coerceNum,
  opt_out:              coerceNum,
  without_choice:       coerceNum,
  last_event_at:        z.preprocess(
    (v) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v)),
    z.string().nullable(),
  ),
});

// Même schéma que kpiRowSchema — on réutilise kpiRowSchema pour last30d

const byPeriodRowSchema = z.object({
  period:        coerceDate,
  first_consent: coerceNum,
  reexposed:     coerceNum,
});

const byMemberRowSchema = z.object({
  member:  z.string(),
  opt_in:  coerceNum,
  opt_out: coerceNum,
  custom:  coerceNum,
  total:   coerceNum,
});

const byDeviceRowSchema = z.object({
  device_type: z.string(),
  opt_in:      coerceNum,
  opt_out:     coerceNum,
  total:       coerceNum,
});

const byPageTypeRowSchema = z.object({
  page_type: z.string(),
  opt_in:    coerceNum,
  opt_out:   coerceNum,
  total:     coerceNum,
});

const rateEvolutionRowSchema = z.object({
  day: coerceDate,
  consent_rate: z.preprocess((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }, z.number().nullable()),
});

// ── Loaders ───────────────────────────────────────────────────────────────────

export async function loadKpiHeader(
  executor: SqlExecutor,
  source: string,
  filters: FilterParams,
  requestId?: string,
): Promise<KpiHeader> {
  const ts   = periodWindow(filters);
  const fo   = filterOpts(filters);
  const rows = await executor.query({
    name:       "consent-overview-kpi",
    statement:  kpiHeaderQuery(fo),
    parameters: baseParams(source, filters, ts),
    rowSchema:  kpiRowSchema,
    requestId,
    maxRows:    1,
  });
  const row = rows[0];
  if (!row) throw new Error("consent-overview-kpi returned no rows");
  const wc = row.contact_with_choice || 1;

  // KPI last 30 days — uniquement si la période choisie > 30 jours
  let last30dConsentRate: number | null = null;
  let last30dRejectRate:  number | null = null;
  let last30dCustomRate:  number | null = null;

  const days = daysBetween(filters.startDate, filters.endDate);
  if (days > 30) {
    const w30 = last30DaysWindow();
    const r30 = await executor.query({
      name: "consent-overview-kpi-last30d",
      statement: kpiHeaderQuery(fo),
      parameters: { ...baseParams(source, filters, w30) },
      rowSchema:  kpiRowSchema,
      requestId,
      maxRows:    1,
    });
    const row30 = r30[0];
    const wc30  = row30?.contact_with_choice ?? 0;
    if (row30 && wc30 > 0) {
      last30dConsentRate = row30.opt_in  / wc30;
      last30dRejectRate  = row30.opt_out / wc30;
      last30dCustomRate  = row30.custom  / wc30;
    }
  }

  return kpiHeaderSchema.parse({
    contactTotal:        row.contact_total,
    contactWithChoice:   row.contact_with_choice,
    optIn:               row.opt_in,
    custom:              row.custom,
    optOut:              row.opt_out,
    withoutChoice:       row.without_choice,
    consentRate:         row.opt_in  / wc,
    rejectRate:          row.opt_out / wc,
    customRate:          row.custom  / wc,
    lastEventAt:         row.last_event_at,
    last30dConsentRate,
    last30dRejectRate,
    last30dCustomRate,
  });
}

export async function loadOptInByPeriod(
  executor: SqlExecutor,
  source: string,
  filters: FilterParams,
  requestId?: string,
): Promise<OptInByPeriodRow[]> {
  const { startTs, endTs } = periodWindow(filters);
  const rows = await executor.query({
    name:       "consent-overview-by-period",
    statement:  optInByPeriodQuery(filterOpts(filters)),
    parameters: { source: quoteQualifiedIdentifier(source), startTs, endTs, granularity: filters.granularity ?? "month" },
    rowSchema:  byPeriodRowSchema,
    requestId,
    maxRows:    800,
  });
  return optInByPeriodSchema.parse(
    rows.map((r) => ({ period: r.period, firstConsent: r.first_consent, reexposed: r.reexposed })),
  );
}

export async function loadConsentByMember(
  executor: SqlExecutor,
  source: string,
  filters: FilterParams,
  requestId?: string,
): Promise<ConsentByMemberRow[]> {
  const ts   = periodWindow(filters);
  const rows = await executor.query({
    name:       "consent-overview-by-member",
    statement:  consentByMemberQuery(filterOpts(filters)),
    parameters: baseParams(source, filters, ts),
    rowSchema:  byMemberRowSchema,
    requestId,
    maxRows:    50,
  });
  return consentByMemberSchema.parse(
    rows.map((r) => ({
      member:      r.member,
      optIn:       r.opt_in,
      optOut:      r.opt_out,
      custom:      r.custom,
      total:       r.total,
      consentRate: r.total > 0 ? r.opt_in / r.total : 0,
    })),
  );
}

export async function loadConsentByDevice(
  executor: SqlExecutor,
  source: string,
  filters: FilterParams,
  requestId?: string,
): Promise<ConsentByDeviceRow[]> {
  const ts   = periodWindow(filters);
  const rows = await executor.query({
    name:       "consent-overview-by-device",
    statement:  consentByDeviceQuery(filterOpts(filters)),
    parameters: baseParams(source, filters, ts),
    rowSchema:  byDeviceRowSchema,
    requestId,
    maxRows:    20,
  });
  const grandTotal = rows.reduce((s, r) => s + r.opt_in, 0) || 1;
  return consentByDeviceSchema.parse(
    rows
      .filter((r) => r.device_type !== "Unknown")
      .map((r) => ({
        deviceType:   r.device_type,
        optIn:        r.opt_in,
        optOut:       r.opt_out,
        total:        r.total,
        consentRate:  r.total > 0 ? r.opt_in / r.total : 0,
        shareOfTotal: r.opt_in / grandTotal,
      })),
  );
}

export async function loadConsentByPageType(
  executor: SqlExecutor,
  source: string,
  filters: FilterParams,
  requestId?: string,
): Promise<ConsentByPageTypeRow[]> {
  const ts   = periodWindow(filters);
  const rows = await executor.query({
    name:       "consent-overview-by-page-type",
    statement:  consentByPageTypeQuery(filterOpts(filters)),
    parameters: baseParams(source, filters, ts),
    rowSchema:  byPageTypeRowSchema,
    requestId,
    maxRows:    20,
  });
  return consentByPageTypeSchema.parse(
    rows.map((r) => ({
      pageType:    r.page_type,
      optIn:       r.opt_in,
      optOut:      r.opt_out,
      total:       r.total,
      consentRate: r.total > 0 ? r.opt_in / r.total : 0,
    })),
  );
}

export async function loadOptInRateEvolution(
  executor: SqlExecutor,
  source: string,
  filters: FilterParams,
  requestId?: string,
): Promise<OptInRateEvolutionRow[]> {
  const { startTs, endTs } = periodWindow(filters);
  const rows = await executor.query({
    name:       "consent-overview-rate-evolution",
    statement:  optInRateEvolutionQuery(filterOpts(filters)),
    parameters: { source: quoteQualifiedIdentifier(source), startTs, endTs },
    rowSchema:  rateEvolutionRowSchema,
    requestId,
    maxRows:    800,
  });
  return optInRateEvolutionSchema.parse(
    rows
      .filter((r) => r.consent_rate !== null)
      .map((r) => ({ day: r.day, consentRate: r.consent_rate as number })),
  );
}
