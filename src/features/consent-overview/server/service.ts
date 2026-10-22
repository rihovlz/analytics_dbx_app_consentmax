import type { ConsentOverviewResult, FilterParams } from "@/features/consent-overview/contract";
import {
  loadConsentByDevice,
  loadConsentByMember,
  loadConsentByPageType,
  loadKpiHeader,
  loadOptInByPeriod,
  loadOptInRateEvolution,
} from "@/features/consent-overview/server/repository";
import { getServerConfig, type ServerConfig } from "@/lib/config/server-config";
import { getSqlExecutor } from "@/lib/databricks/sql";
import type { SqlExecutor } from "@/lib/databricks/types";

const SOURCE = "prd-consent.analytics.last_consent_event";

const ALL_MEMBERS = [
  "LRM","BOU","DEC","AUC","KIA","ELD","ONY","NOR",
  "JUL","CHD","RGO","BZB","TAO","FLU","ALI","TSM","CEE","VLZ",
];

type Dependencies = { config?: ServerConfig; executor?: SqlExecutor };

// ── Demo fixtures ─────────────────────────────────────────────────────────────

function demoResult(filters: FilterParams): ConsentOverviewResult {
  const gran = filters.granularity ?? "month";
  const periods: ConsentOverviewResult["byPeriod"] =
    gran === "day"
      ? Array.from({ length: 30 }, (_, i) => {
          const d = new Date("2026-09-22"); d.setDate(d.getDate() + i);
          return { period: d.toISOString().slice(0, 10), firstConsent: 18000 + Math.round(Math.random() * 6000), reexposed: 8000 + Math.round(Math.random() * 3000) };
        })
      : gran === "week"
      ? Array.from({ length: 12 }, (_, i) => ({ period: `2026-${String(36 - i).padStart(2, "0")}`, firstConsent: 120000 + i * 5000, reexposed: 55000 + i * 2000 })).reverse()
      : [
          { period: "2025-10", firstConsent: 900_000, reexposed: 400_000 },
          { period: "2025-11", firstConsent: 850_000, reexposed: 380_000 },
          { period: "2025-12", firstConsent: 780_000, reexposed: 350_000 },
          { period: "2026-01", firstConsent: 920_000, reexposed: 420_000 },
          { period: "2026-02", firstConsent: 860_000, reexposed: 390_000 },
          { period: "2026-03", firstConsent: 910_000, reexposed: 410_000 },
          { period: "2026-04", firstConsent: 880_000, reexposed: 400_000 },
          { period: "2026-05", firstConsent: 950_000, reexposed: 430_000 },
          { period: "2026-06", firstConsent: 870_000, reexposed: 395_000 },
          { period: "2026-07", firstConsent: 930_000, reexposed: 415_000 },
          { period: "2026-08", firstConsent: 960_000, reexposed: 440_000 },
          { period: "2026-09", firstConsent: 1_100_000, reexposed: 500_000 },
          { period: "2026-10", firstConsent: 700_000, reexposed: 320_000 },
        ];

  return {
    status: "demo",
    filters: {
      member: filters.member ?? null,
      deviceType: filters.deviceType ?? null,
      startDate: filters.startDate ?? null,
      endDate: filters.endDate ?? null,
      granularity: gran,
      availableMembers: ALL_MEMBERS,
      availableDeviceTypes: ["Web mobile", "Desktop", "App", "Kiosk", "DOOH"],
    },
    kpi: {
      contactTotal: 24_600_000, contactWithChoice: 22_900_000,
      optIn: 13_948_207, custom: 108_005, optOut: 8_875_978, withoutChoice: 1_600_000,
      consentRate: 0.609, rejectRate: 0.388, customRate: 0.005,
      lastEventAt: "2026-10-20T23:59:56",
    },
    byPeriod: periods,
    byMember: [
      { member: "LRM", optIn: 4_223_530, optOut: 2_800_000, custom: 12_000, total: 7_200_000, consentRate: 0.587 },
      { member: "BOU", optIn: 2_792_778, optOut: 1_900_000, custom: 8_000,  total: 5_100_000, consentRate: 0.548 },
      { member: "DEC", optIn: 2_678_999, optOut: 1_300_000, custom: 10_000, total: 4_100_000, consentRate: 0.653 },
      { member: "AUC", optIn: 854_366,   optOut: 580_000,   custom: 3_000,  total: 1_450_000, consentRate: 0.589 },
      { member: "KIA", optIn: 763_614,   optOut: 440_000,   custom: 2_500,  total: 1_220_000, consentRate: 0.626 },
      { member: "ELD", optIn: 623_728,   optOut: 450_000,   custom: 2_000,  total: 1_090_000, consentRate: 0.572 },
      { member: "ONY", optIn: 609_279,   optOut: 310_000,   custom: 2_000,  total: 940_000,   consentRate: 0.648 },
      { member: "NOR", optIn: 465_935,   optOut: 380_000,   custom: 1_500,  total: 860_000,   consentRate: 0.542 },
      { member: "JUL", optIn: 281_521,   optOut: 200_000,   custom: 1_000,  total: 490_000,   consentRate: 0.574 },
      { member: "CHD", optIn: 225_015,   optOut: 130_000,   custom: 800,    total: 360_000,   consentRate: 0.625 },
      { member: "RGO", optIn: 123_440,   optOut: 110_000,   custom: 400,    total: 240_000,   consentRate: 0.514 },
      { member: "BZB", optIn: 92_482,    optOut: 72_000,    custom: 300,    total: 167_000,   consentRate: 0.554 },
      { member: "TAO", optIn: 79_651,    optOut: 98_000,    custom: 250,    total: 180_000,   consentRate: 0.442 },
      { member: "FLU", optIn: 43_986,    optOut: 32_000,    custom: 150,    total: 78_000,    consentRate: 0.564 },
      { member: "ALI", optIn: 27_436,    optOut: 25_000,    custom: 100,    total: 54_000,    consentRate: 0.508 },
      { member: "TSM", optIn: 7_155,     optOut: 5_000,     custom: 30,     total: 12_500,    consentRate: 0.572 },
      { member: "CEE", optIn: 1_273,     optOut: 400,       custom: 5,      total: 1_690,     consentRate: 0.753 },
      { member: "VLZ", optIn: 59,        optOut: 1_100,     custom: 0,      total: 1_180,     consentRate: 0.050 },
    ],
    byDevice: [
      { deviceType: "Web mobile", optIn: 8_302_732, optOut: 3_960_000, total: 12_600_000, consentRate: 0.659, shareOfTotal: 0.596 },
      { deviceType: "Desktop",    optIn: 3_772_381, optOut: 4_200_000, total: 7_980_000,  consentRate: 0.473, shareOfTotal: 0.271 },
      { deviceType: "App",        optIn: 1_758_468, optOut: 840_000,   total: 2_600_000,  consentRate: 0.676, shareOfTotal: 0.126 },
      { deviceType: "Kiosk",      optIn: 57_052,    optOut: 28_000,    total: 85_300,     consentRate: 0.669, shareOfTotal: 0.004 },
      { deviceType: "DOOH",       optIn: 415,       optOut: 90,        total: 505,        consentRate: 0.823, shareOfTotal: 0.000 },
    ],
    byPageType: [
      { pageType: "Account",               optIn: 5_600_000, optOut: 3_800_000, total: 9_600_000, consentRate: 0.583 },
      { pageType: "Homepage",              optIn: 2_100_000, optOut: 1_400_000, total: 3_700_000, consentRate: 0.568 },
      { pageType: "Order confirmation",    optIn: 649_700,   optOut: 671_800,   total: 1_400_000, consentRate: 0.464 },
      { pageType: "Product page",          optIn: 450_000,   optOut: 320_000,   total: 800_000,   consentRate: 0.563 },
      { pageType: "Other",                 optIn: 300_000,   optOut: 200_000,   total: 530_000,   consentRate: 0.566 },
      { pageType: "Cart",                  optIn: 280_000,   optOut: 180_000,   total: 490_000,   consentRate: 0.571 },
      { pageType: "Checkout",              optIn: 260_000,   optOut: 160_000,   total: 450_000,   consentRate: 0.578 },
      { pageType: "Services",              optIn: 200_000,   optOut: 130_000,   total: 360_000,   consentRate: 0.556 },
      { pageType: "Product list",          optIn: 180_000,   optOut: 120_000,   total: 330_000,   consentRate: 0.545 },
      { pageType: "Commercial operations", optIn: 150_000,   optOut: 100_000,   total: 270_000,   consentRate: 0.556 },
      { pageType: "Search",                optIn: 90_000,    optOut: 65_000,    total: 170_000,   consentRate: 0.529 },
      { pageType: "Error",                 optIn: 20_000,    optOut: 15_000,    total: 38_000,    consentRate: 0.526 },
    ],
    rateEvolution: Array.from({ length: 365 }, (_, i) => {
      const d = new Date("2025-10-22"); d.setDate(d.getDate() + i);
      const base = 0.55 + Math.sin(i / 30) * 0.04 + (i > 180 ? 0.06 : 0);
      return { day: d.toISOString().slice(0, 10), consentRate: Math.min(0.85, Math.max(0.30, base + (Math.random() - 0.5) * 0.04)) };
    }),
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

export async function getConsentOverview(
  filters: FilterParams,
  requestId?: string,
  dependencies: Dependencies = {},
): Promise<ConsentOverviewResult> {
  const config = dependencies.config ?? getServerConfig();
  if (config.mode === "demo") return demoResult(filters);

  const executor = dependencies.executor ?? getSqlExecutor();
  const gran = filters.granularity ?? "month";

  const [kpi, byPeriod, byMember, byDevice, byPageType, rateEvolution] = await Promise.all([
    loadKpiHeader(executor, SOURCE, filters, requestId),
    loadOptInByPeriod(executor, SOURCE, filters, requestId),
    loadConsentByMember(executor, SOURCE, filters, requestId),
    loadConsentByDevice(executor, SOURCE, filters, requestId),
    loadConsentByPageType(executor, SOURCE, filters, requestId),
    loadOptInRateEvolution(executor, SOURCE, filters, requestId),
  ]);

  return {
    status: "ok",
    filters: {
      member: filters.member ?? null,
      deviceType: filters.deviceType ?? null,
      startDate: filters.startDate ?? null,
      endDate: filters.endDate ?? null,
      granularity: gran,
      availableMembers: byMember.map((r) => r.member),
      availableDeviceTypes: byDevice.map((r) => r.deviceType),
    },
    kpi, byPeriod, byMember, byDevice, byPageType, rateEvolution,
  };
}
