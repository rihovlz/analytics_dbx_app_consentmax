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
  CONSENT_BY_DEVICE_QUERY,
  CONSENT_BY_MEMBER_QUERY,
  CONSENT_BY_PAGE_TYPE_QUERY,
  KPI_HEADER_QUERY,
  OPT_IN_BY_PERIOD_QUERY,
  OPT_IN_RATE_EVOLUTION_QUERY,
} from "@/features/consent-overview/server/queries";
import { quoteQualifiedIdentifier } from "@/lib/databricks/identifiers";
import type { SqlExecutor } from "@/lib/databricks/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function periodWindow(
  filters: FilterParams,
): { startTs: string; endTs: string } {
  const now   = new Date();
  const endTs = (filters.endDate   ? new Date(`${filters.endDate}T23:59:59Z`)   : now).toISOString();
  const startTs = filters.startDate
    ? new Date(`${filters.startDate}T00:00:00Z`).toISOString()
    : new Date("2024-10-01T00:00:00Z").toISOString(); // début historique table
  return { startTs, endTs };
}

function baseParams(source: string, filters: FilterParams) {
  return {
    source: quoteQualifiedIdentifier(source),
    member: filters.member ?? null,
    deviceType: filters.deviceType ?? null,
    startTs: filters.startDate ? new Date(`${filters.startDate}T00:00:00Z`).toISOString() : null,
    endTs: filters.endDate ? new Date(`${filters.endDate}T23:59:59Z`).toISOString() : null,
  };
}

// ── Schémas intermédiaires SQL ────────────────────────────────────────────────

// AppKit peut retourner BigInt pour les SUM()/COUNT() et Date pour les colonnes DATE.
const coerceNum = z.preprocess((v) => (typeof v === "bigint" ? Number(v) : v), z.coerce.number());
const coerceDate = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v)),
  z.string(),
);

const kpiRowSchema = z.object({
  contact_total: coerceNum,
  contact_with_choice: coerceNum,
  opt_in: coerceNum,
  custom: coerceNum,
  opt_out: coerceNum,
  without_choice: coerceNum,
  last_event_at: z.string().nullable(),
});

const byPeriodRowSchema = z.object({
  period: coerceDate,
  first_consent: coerceNum,
  reexposed: coerceNum,
});

const byMemberRowSchema = z.object({
  member: z.string(),
  opt_in: coerceNum,
  opt_out: coerceNum,
  custom: coerceNum,
  total: coerceNum,
});

const byDeviceRowSchema = z.object({
  device_type: z.string(),
  opt_in: coerceNum,
  opt_out: coerceNum,
  total: coerceNum,
});

const byPageTypeRowSchema = z.object({
  page_type: z.string(),
  opt_in: coerceNum,
  opt_out: coerceNum,
  total: coerceNum,
});

const rateEvolutionRowSchema = z.object({
  // AppKit convertit DATE → Date JS — on accepte string | Date et on normalise
  day: z.preprocess(
    (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10)),
    z.string(),
  ),
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
  const rows = await executor.query({
    name: "consent-overview-kpi",
    statement: KPI_HEADER_QUERY,
    parameters: baseParams(source, filters),
    rowSchema: kpiRowSchema,
    requestId,
    maxRows: 1,
  });
  const row = rows[0];
  if (!row) throw new Error("consent-overview-kpi returned no rows");
  const withChoice = row.contact_with_choice || 1;
  return kpiHeaderSchema.parse({
    contactTotal: row.contact_total,
    contactWithChoice: row.contact_with_choice,
    optIn: row.opt_in,
    custom: row.custom,
    optOut: row.opt_out,
    withoutChoice: row.without_choice,
    consentRate: row.opt_in / withChoice,
    rejectRate: row.opt_out / withChoice,
    customRate: row.custom / withChoice,
    lastEventAt: row.last_event_at,
  });
}

export async function loadOptInByPeriod(
  executor: SqlExecutor,
  source: string,
  filters: FilterParams,
  requestId?: string,
): Promise<OptInByPeriodRow[]> {
  const gran = filters.granularity ?? "month";
  const { startTs, endTs } = periodWindow(filters);
  const rows = await executor.query({
    name: "consent-overview-by-period",
    statement: OPT_IN_BY_PERIOD_QUERY,
    parameters: { ...baseParams(source, filters), startTs, endTs, granularity: gran },
    rowSchema: byPeriodRowSchema,
    requestId,
    maxRows: 400,
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
  const rows = await executor.query({
    name: "consent-overview-by-member",
    statement: CONSENT_BY_MEMBER_QUERY,
    parameters: baseParams(source, filters),
    rowSchema: byMemberRowSchema,
    requestId,
    maxRows: 50,
  });
  return consentByMemberSchema.parse(
    rows.map((r) => ({
      member: r.member,
      optIn: r.opt_in,
      optOut: r.opt_out,
      custom: r.custom,
      total: r.total,
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
  const rows = await executor.query({
    name: "consent-overview-by-device",
    statement: CONSENT_BY_DEVICE_QUERY,
    parameters: baseParams(source, filters),
    rowSchema: byDeviceRowSchema,
    requestId,
    maxRows: 20,
  });
  const grandTotal = rows.reduce((s, r) => s + r.opt_in, 0) || 1;
  return consentByDeviceSchema.parse(
    rows
      .filter((r) => r.device_type !== "Unknown")
      .map((r) => ({
        deviceType: r.device_type,
        optIn: r.opt_in,
        optOut: r.opt_out,
        total: r.total,
        consentRate: r.total > 0 ? r.opt_in / r.total : 0,
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
  const rows = await executor.query({
    name: "consent-overview-by-page-type",
    statement: CONSENT_BY_PAGE_TYPE_QUERY,
    parameters: baseParams(source, filters),
    rowSchema: byPageTypeRowSchema,
    requestId,
    maxRows: 20,
  });
  return consentByPageTypeSchema.parse(
    rows.map((r) => ({
      pageType: r.page_type,
      optIn: r.opt_in,
      optOut: r.opt_out,
      total: r.total,
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
    name: "consent-overview-rate-evolution",
    statement: OPT_IN_RATE_EVOLUTION_QUERY,
    parameters: { ...baseParams(source, filters), startTs, endTs },
    rowSchema: rateEvolutionRowSchema,
    requestId,
    maxRows: 500,
  });
  return optInRateEvolutionSchema.parse(
    rows
      .filter((r) => r.consent_rate !== null)
      .map((r) => ({ day: r.day, consentRate: r.consent_rate as number })),
  );
}
