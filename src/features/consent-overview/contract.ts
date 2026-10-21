import { z } from "zod";

// ── KPI header ────────────────────────────────────────────────────────────────

export const kpiHeaderSchema = z.object({
  contactTotal: z.coerce.number(),
  contactWithChoice: z.coerce.number(),
  optIn: z.coerce.number(),
  custom: z.coerce.number(),
  optOut: z.coerce.number(),
  withoutChoice: z.coerce.number(),
  consentRate: z.coerce.number(),  // opt-in / contact_with_choice  [0-1]
  rejectRate: z.coerce.number(),
  customRate: z.coerce.number(),
  lastEventAt: z.string().nullable(),
});

export type KpiHeader = z.infer<typeof kpiHeaderSchema>;

// ── Opt-in by month ───────────────────────────────────────────────────────────

export const optInByMonthRowSchema = z.object({
  month: z.string(),             // "YYYY-MM"
  firstConsent: z.coerce.number(),
  refresh: z.coerce.number(),
});

export const optInByMonthSchema = z.array(optInByMonthRowSchema);
export type OptInByMonthRow = z.infer<typeof optInByMonthRowSchema>;

// ── Consent rate by member ────────────────────────────────────────────────────

export const consentByMemberRowSchema = z.object({
  member: z.string(),
  optIn: z.coerce.number(),
  optOut: z.coerce.number(),
  custom: z.coerce.number(),
  total: z.coerce.number(),
  consentRate: z.coerce.number(),
});

export const consentByMemberSchema = z.array(consentByMemberRowSchema);
export type ConsentByMemberRow = z.infer<typeof consentByMemberRowSchema>;

// ── Opt-in by device ──────────────────────────────────────────────────────────

export const consentByDeviceRowSchema = z.object({
  deviceType: z.string(),        // "Desktop" | "Web mobile" | "App" | "Kiosk" | "DOOH" | "Unknown"
  optIn: z.coerce.number(),
  optOut: z.coerce.number(),
  total: z.coerce.number(),
  consentRate: z.coerce.number(),
});

export const consentByDeviceSchema = z.array(consentByDeviceRowSchema);
export type ConsentByDeviceRow = z.infer<typeof consentByDeviceRowSchema>;

// ── Opt-in rate by page type ──────────────────────────────────────────────────

export const consentByPageTypeRowSchema = z.object({
  pageType: z.string(),
  optIn: z.coerce.number(),
  optOut: z.coerce.number(),
  total: z.coerce.number(),
  consentRate: z.coerce.number(),
});

export const consentByPageTypeSchema = z.array(consentByPageTypeRowSchema);
export type ConsentByPageTypeRow = z.infer<typeof consentByPageTypeRowSchema>;

// ── Opt-in rate evolution (daily) ─────────────────────────────────────────────

export const optInRateEvolutionRowSchema = z.object({
  day: z.string(),               // "YYYY-MM-DD"
  consentRate: z.coerce.number(),
});

export const optInRateEvolutionSchema = z.array(optInRateEvolutionRowSchema);
export type OptInRateEvolutionRow = z.infer<typeof optInRateEvolutionRowSchema>;

// ── Aggregate response ────────────────────────────────────────────────────────

export const consentOverviewSchema = z.object({
  status: z.enum(["demo", "ok"]),
  kpi: kpiHeaderSchema,
  byMonth: optInByMonthSchema,
  byMember: consentByMemberSchema,
  byDevice: consentByDeviceSchema,
  byPageType: consentByPageTypeSchema,
  rateEvolution: optInRateEvolutionSchema,
});

export type ConsentOverviewResult = z.infer<typeof consentOverviewSchema>;
