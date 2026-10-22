import { z } from "zod";

// ── Paramètres de filtre (query string) ───────────────────────────────────────

export const GRANULARITIES = ["day", "week", "month"] as const;
export type Granularity = (typeof GRANULARITIES)[number];

export const filterParamsSchema = z.object({
  // membres sélectionnés — tableau JSON encodé en query string, undefined = tous
  members: z.preprocess(
    (v) => { try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return v; } },
    z.array(z.string()).optional(),
  ),
  // devices sélectionnés — tableau JSON encodé en query string, undefined = tous
  deviceTypes: z.preprocess(
    (v) => { try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return v; } },
    z.array(z.string()).optional(),
  ),
  startDate: z.string().optional(),    // "YYYY-MM-DD"
  endDate: z.string().optional(),      // "YYYY-MM-DD"
  granularity: z.enum(GRANULARITIES).optional().default("month"),
});
export type FilterParams = z.infer<typeof filterParamsSchema>;

// ── KPI header ────────────────────────────────────────────────────────────────

export const kpiHeaderSchema = z.object({
  contactTotal: z.coerce.number(),
  contactWithChoice: z.coerce.number(),
  optIn: z.coerce.number(),
  custom: z.coerce.number(),
  optOut: z.coerce.number(),
  withoutChoice: z.coerce.number(),
  consentRate: z.coerce.number(),
  rejectRate: z.coerce.number(),
  customRate: z.coerce.number(),
  lastEventAt: z.string().nullable(),
  // Taux sur les 30 derniers jours — null si période < 30j ou données insuffisantes
  last30dConsentRate: z.coerce.number().nullable(),
  last30dRejectRate: z.coerce.number().nullable(),
  last30dCustomRate: z.coerce.number().nullable(),
});
export type KpiHeader = z.infer<typeof kpiHeaderSchema>;

// ── Opt-in by période (day / week / month) ────────────────────────────────────

export const optInByPeriodRowSchema = z.object({
  period: z.string(),          // "YYYY-MM-DD" | "YYYY-Www" | "YYYY-MM"
  firstConsent: z.coerce.number(),
  reexposed: z.coerce.number(),
});
export const optInByPeriodSchema = z.array(optInByPeriodRowSchema);
export type OptInByPeriodRow = z.infer<typeof optInByPeriodRowSchema>;

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
  deviceType: z.string(),
  optIn: z.coerce.number(),
  optOut: z.coerce.number(),
  total: z.coerce.number(),
  consentRate: z.coerce.number(),
  shareOfTotal: z.coerce.number(),   // part du volume total toutes devices confondues
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
  day: z.string(),
  consentRate: z.coerce.number(),
});
export const optInRateEvolutionSchema = z.array(optInRateEvolutionRowSchema);
export type OptInRateEvolutionRow = z.infer<typeof optInRateEvolutionRowSchema>;

// ── Réponse agrégée ───────────────────────────────────────────────────────────

export const consentOverviewSchema = z.object({
  status: z.enum(["demo", "ok"]),
  filters: z.object({
    members: z.array(z.string()),
    deviceTypes: z.array(z.string()),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    granularity: z.enum(GRANULARITIES),
    availableMembers: z.array(z.string()),
    availableDeviceTypes: z.array(z.string()),
  }),
  kpi: kpiHeaderSchema,
  byPeriod: optInByPeriodSchema,
  byMember: consentByMemberSchema,
  byDevice: consentByDeviceSchema,
  byPageType: consentByPageTypeSchema,
  rateEvolution: optInRateEvolutionSchema,
});
export type ConsentOverviewResult = z.infer<typeof consentOverviewSchema>;
