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
  granularity: FilterParams["granularity"],
): { startTs: string; endTs: string } {
  const now = new Date();
  const endTs = (filters.endDate ? new Date(`${filters.endDate}T23:59:59Z`) : now).toISOString();
  if (filters.startDate) return { startTs: new Date(`${filters.startDate}T00:00:00Z`).toISOString(), endTs };
  const start = new Date(now);
  if (granularity === "day") start.setDate(start.getDate() - 30);
  else if (granularity === "week") start.setDate(start.getDate() - 84); // 12 semaines
  else start.setMonth(start.getMonth() - 12); // 12 mois max → ~365 jours pour l'évolution
  return { startTs: start.toISOString(), endTs };
}

function baseParams(source: string, filters: FilterParams) {
  return {
    source: quoteQualifiedIdentifier(source),
    member: filters.member ?? null,
    startTs: filters.startDate ? new Date(`${filters.startDate}T00:00:00Z`).toISOString() : null,
    endTs: filters.endDate ? new Date(`${filters.endDate}T23:59:59Z`).toISOString() : null,
  };
}

// ── Schémas intermédiaires SQL ────────────────────────────────────────────────

const kpiRowSchema = z.object({
  contact_total: z.coerce.number(),
  contact_with_choice: z.coerce.number(),
  opt_in: z.coerce.number(),
  custom: z.coerce.number(),
  opt_out: z.coerce.number(),
  without_choice: z.coerce.number(),
  last_event_at: z.string().nullable(),
});

const byPeriodRowSchema = z.object({
  // AppKit peut convertir DATE → Date JS si granularity=day
  period: z.preprocess(
    (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v)),
    z.string(),
  ),
  first_consent: z.coerce.number(),
  reexposed: z.coerce.number(),
});

const byMemberRowSchema = z.object({
  member: z.string(),
  opt_in: z.coerce.number(),
  opt_out: z.coerce.number(),
  custom: z.coerce.number(),
  total: z.coerce.number(),
});

const byDeviceRowSchema = z.object({
  device_type: z.string(),
  opt_in: z.coerce.number(),
  opt_out: z.coerce.number(),
  total: z.coerce.number(),
});

const byPageTypeRowSchema = z.object({
  page_type: z.string(),
  opt_in: z.coerce.number(),
  opt_out: z.coerce.number(),
  total: z.coerce.number(),
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
  const { startTs, endTs } = periodWindow(filters, gran);
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
  const { startTs, endTs } = periodWindow(filters, "day");
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
