import { z } from "zod";

import {
  type ConsentByDeviceRow,
  type ConsentByMemberRow,
  type ConsentByPageTypeRow,
  type KpiHeader,
  type OptInByMonthRow,
  type OptInRateEvolutionRow,
  consentByDeviceSchema,
  consentByMemberSchema,
  consentByPageTypeSchema,
  kpiHeaderSchema,
  optInByMonthSchema,
  optInRateEvolutionSchema,
} from "@/features/consent-overview/contract";
import {
  CONSENT_BY_DEVICE_QUERY,
  CONSENT_BY_MEMBER_QUERY,
  CONSENT_BY_PAGE_TYPE_QUERY,
  KPI_HEADER_QUERY,
  OPT_IN_BY_MONTH_QUERY,
  OPT_IN_RATE_EVOLUTION_QUERY,
} from "@/features/consent-overview/server/queries";
import { quoteQualifiedIdentifier } from "@/lib/databricks/identifiers";
import type { SqlExecutor } from "@/lib/databricks/types";

const kpiRowSchema = z.object({
  contact_total: z.coerce.number(),
  contact_with_choice: z.coerce.number(),
  opt_in: z.coerce.number(),
  custom: z.coerce.number(),
  opt_out: z.coerce.number(),
  without_choice: z.coerce.number(),
  last_event_at: z.string().nullable(),
});

const byMonthRowSchema = z.object({
  month: z.string(),
  first_consent: z.coerce.number(),
  refresh: z.coerce.number(),
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
  day: z.string(),
  consent_rate: z.coerce.number().nullable(),
});

function defaultDateRange(): { startTs: string; endTs: string } {
  const now = new Date();
  const endTs = now.toISOString();
  const start = new Date(now);
  start.setMonth(start.getMonth() - 13);
  return { startTs: start.toISOString(), endTs };
}

export async function loadKpiHeader(
  executor: SqlExecutor,
  source: string,
  requestId?: string,
): Promise<KpiHeader> {
  const rows = await executor.query({
    name: "consent-overview-kpi",
    statement: KPI_HEADER_QUERY,
    parameters: { source: quoteQualifiedIdentifier(source) },
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

export async function loadOptInByMonth(
  executor: SqlExecutor,
  source: string,
  requestId?: string,
): Promise<OptInByMonthRow[]> {
  const { startTs, endTs } = defaultDateRange();
  const rows = await executor.query({
    name: "consent-overview-by-month",
    statement: OPT_IN_BY_MONTH_QUERY,
    parameters: { source: quoteQualifiedIdentifier(source), startTs, endTs },
    rowSchema: byMonthRowSchema,
    requestId,
    maxRows: 24,
  });
  return optInByMonthSchema.parse(
    rows.map((r) => ({ month: r.month, firstConsent: r.first_consent, refresh: r.refresh })),
  );
}

export async function loadConsentByMember(
  executor: SqlExecutor,
  source: string,
  requestId?: string,
): Promise<ConsentByMemberRow[]> {
  const rows = await executor.query({
    name: "consent-overview-by-member",
    statement: CONSENT_BY_MEMBER_QUERY,
    parameters: { source: quoteQualifiedIdentifier(source) },
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
  requestId?: string,
): Promise<ConsentByDeviceRow[]> {
  const rows = await executor.query({
    name: "consent-overview-by-device",
    statement: CONSENT_BY_DEVICE_QUERY,
    parameters: { source: quoteQualifiedIdentifier(source) },
    rowSchema: byDeviceRowSchema,
    requestId,
    maxRows: 20,
  });
  return consentByDeviceSchema.parse(
    rows.map((r) => ({
      deviceType: r.device_type,
      optIn: r.opt_in,
      optOut: r.opt_out,
      total: r.total,
      consentRate: r.total > 0 ? r.opt_in / r.total : 0,
    })),
  );
}

export async function loadConsentByPageType(
  executor: SqlExecutor,
  source: string,
  requestId?: string,
): Promise<ConsentByPageTypeRow[]> {
  const rows = await executor.query({
    name: "consent-overview-by-page-type",
    statement: CONSENT_BY_PAGE_TYPE_QUERY,
    parameters: { source: quoteQualifiedIdentifier(source) },
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
  requestId?: string,
): Promise<OptInRateEvolutionRow[]> {
  const { startTs, endTs } = defaultDateRange();
  const rows = await executor.query({
    name: "consent-overview-rate-evolution",
    statement: OPT_IN_RATE_EVOLUTION_QUERY,
    parameters: { source: quoteQualifiedIdentifier(source), startTs, endTs },
    rowSchema: rateEvolutionRowSchema,
    requestId,
    maxRows: 400,
  });
  return optInRateEvolutionSchema.parse(
    rows
      .filter((r) => r.consent_rate !== null)
      .map((r) => ({ day: r.day, consentRate: r.consent_rate as number })),
  );
}
