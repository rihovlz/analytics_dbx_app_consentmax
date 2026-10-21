import type { ConsentOverviewResult } from "@/features/consent-overview/contract";
import {
  loadConsentByDevice,
  loadConsentByMember,
  loadConsentByPageType,
  loadKpiHeader,
  loadOptInByMonth,
  loadOptInRateEvolution,
} from "@/features/consent-overview/server/repository";
import { getServerConfig, type ServerConfig } from "@/lib/config/server-config";
import { getSqlExecutor } from "@/lib/databricks/sql";
import type { SqlExecutor } from "@/lib/databricks/types";

const SOURCE = "prd-consent.analytics.last_consent_event";

type Dependencies = { config?: ServerConfig; executor?: SqlExecutor };

// ── Demo fixtures ─────────────────────────────────────────────────────────────
// Values reflect actual prd-consent snapshot 2026-10-20 — explicitly synthetic.

function demoResult(): ConsentOverviewResult {
  return {
    status: "demo",
    kpi: {
      contactTotal: 24_600_000,
      contactWithChoice: 22_900_000,
      optIn: 13_948_207,
      custom: 108_005,
      optOut: 8_875_978,
      withoutChoice: 1_600_000,
      consentRate: 0.609,
      rejectRate: 0.388,
      customRate: 0.005,
      lastEventAt: "2026-10-20T23:59:56",
    },
    byMonth: [
      { month: "2025-10", firstConsent: 900_000, refresh: 400_000 },
      { month: "2025-11", firstConsent: 850_000, refresh: 380_000 },
      { month: "2025-12", firstConsent: 780_000, refresh: 350_000 },
      { month: "2026-01", firstConsent: 920_000, refresh: 420_000 },
      { month: "2026-02", firstConsent: 860_000, refresh: 390_000 },
      { month: "2026-03", firstConsent: 910_000, refresh: 410_000 },
      { month: "2026-04", firstConsent: 880_000, refresh: 400_000 },
      { month: "2026-05", firstConsent: 950_000, refresh: 430_000 },
      { month: "2026-06", firstConsent: 870_000, refresh: 395_000 },
      { month: "2026-07", firstConsent: 930_000, refresh: 415_000 },
      { month: "2026-08", firstConsent: 960_000, refresh: 440_000 },
      { month: "2026-09", firstConsent: 1_100_000, refresh: 500_000 },
      { month: "2026-10", firstConsent: 700_000, refresh: 320_000 },
    ],
    byMember: [
      { member: "LRM", optIn: 4_223_530, optOut: 2_800_000, custom: 12_000, total: 7_200_000, consentRate: 0.587 },
      { member: "BOU", optIn: 2_792_778, optOut: 1_900_000, custom: 8_000, total: 5_100_000, consentRate: 0.548 },
      { member: "DEC", optIn: 2_678_999, optOut: 1_300_000, custom: 10_000, total: 4_100_000, consentRate: 0.653 },
      { member: "AUC", optIn: 854_366,  optOut: 580_000,  custom: 3_000, total: 1_450_000, consentRate: 0.589 },
      { member: "KIA", optIn: 763_614,  optOut: 440_000,  custom: 2_500, total: 1_220_000, consentRate: 0.626 },
      { member: "ELD", optIn: 623_728,  optOut: 450_000,  custom: 2_000, total: 1_090_000, consentRate: 0.572 },
      { member: "ONY", optIn: 609_279,  optOut: 310_000,  custom: 2_000, total: 940_000,   consentRate: 0.648 },
      { member: "NOR", optIn: 465_935,  optOut: 380_000,  custom: 1_500, total: 860_000,   consentRate: 0.542 },
      { member: "JUL", optIn: 281_521,  optOut: 200_000,  custom: 1_000, total: 490_000,   consentRate: 0.574 },
      { member: "CHD", optIn: 225_015,  optOut: 130_000,  custom: 800,   total: 360_000,   consentRate: 0.625 },
      { member: "RGO", optIn: 123_440,  optOut: 110_000,  custom: 400,   total: 240_000,   consentRate: 0.514 },
      { member: "BZB", optIn: 92_482,   optOut: 72_000,   custom: 300,   total: 167_000,   consentRate: 0.554 },
      { member: "TAO", optIn: 79_651,   optOut: 98_000,   custom: 250,   total: 180_000,   consentRate: 0.442 },
      { member: "FLU", optIn: 43_986,   optOut: 32_000,   custom: 150,   total: 78_000,    consentRate: 0.564 },
      { member: "ALI", optIn: 27_436,   optOut: 25_000,   custom: 100,   total: 54_000,    consentRate: 0.508 },
      { member: "TSM", optIn: 7_155,    optOut: 5_000,    custom: 30,    total: 12_500,    consentRate: 0.572 },
      { member: "CEE", optIn: 1_273,    optOut: 400,      custom: 5,     total: 1_690,     consentRate: 0.753 },
      { member: "VLZ", optIn: 59,       optOut: 1_100,    custom: 0,     total: 1_180,     consentRate: 0.050 },
    ],
    byDevice: [
      { deviceType: "Desktop",    optIn: 8_000_000, optOut: 4_500_000, total: 13_200_000, consentRate: 0.606 },
      { deviceType: "Web mobile", optIn: 4_800_000, optOut: 3_600_000, total: 8_700_000,  consentRate: 0.552 },
      { deviceType: "App",        optIn: 900_000,   optOut: 380_000,   total: 1_380_000,  consentRate: 0.652 },
      { deviceType: "Kiosk",      optIn: 180_000,   optOut: 90_000,    total: 280_000,    consentRate: 0.643 },
      { deviceType: "DOOH",       optIn: 40_000,    optOut: 8_000,     total: 52_000,     consentRate: 0.769 },
    ],
    byPageType: [
      { pageType: "Account",              optIn: 5_600_000, optOut: 3_800_000, total: 9_600_000, consentRate: 0.583 },
      { pageType: "Homepage",             optIn: 2_100_000, optOut: 1_400_000, total: 3_700_000, consentRate: 0.568 },
      { pageType: "Order confirmation",   optIn: 649_700,   optOut: 671_800,   total: 1_400_000, consentRate: 0.464 },
      { pageType: "Product page",         optIn: 450_000,   optOut: 320_000,   total: 800_000,   consentRate: 0.563 },
      { pageType: "Other",                optIn: 300_000,   optOut: 200_000,   total: 530_000,   consentRate: 0.566 },
      { pageType: "Cart",                 optIn: 280_000,   optOut: 180_000,   total: 490_000,   consentRate: 0.571 },
      { pageType: "Checkout",             optIn: 260_000,   optOut: 160_000,   total: 450_000,   consentRate: 0.578 },
      { pageType: "Services",             optIn: 200_000,   optOut: 130_000,   total: 360_000,   consentRate: 0.556 },
      { pageType: "Product list",         optIn: 180_000,   optOut: 120_000,   total: 330_000,   consentRate: 0.545 },
      { pageType: "Commercial operations",optIn: 150_000,   optOut: 100_000,   total: 270_000,   consentRate: 0.556 },
      { pageType: "Search",               optIn: 90_000,    optOut: 65_000,    total: 170_000,   consentRate: 0.529 },
      { pageType: "Error",                optIn: 20_000,    optOut: 15_000,    total: 38_000,    consentRate: 0.526 },
    ],
    rateEvolution: Array.from({ length: 90 }, (_, i) => {
      const d = new Date("2026-07-23");
      d.setDate(d.getDate() + i);
      const base = 0.58 + Math.sin(i / 14) * 0.04 + (i > 60 ? 0.03 : 0);
      return { day: d.toISOString().slice(0, 10), consentRate: Math.min(0.85, Math.max(0.35, base)) };
    }),
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

export async function getConsentOverview(
  requestId?: string,
  dependencies: Dependencies = {},
): Promise<ConsentOverviewResult> {
  const config = dependencies.config ?? getServerConfig();
  if (config.mode === "demo") return demoResult();

  const executor = dependencies.executor ?? getSqlExecutor();

  const [kpi, byMonth, byMember, byDevice, byPageType, rateEvolution] = await Promise.all([
    loadKpiHeader(executor, SOURCE, requestId),
    loadOptInByMonth(executor, SOURCE, requestId),
    loadConsentByMember(executor, SOURCE, requestId),
    loadConsentByDevice(executor, SOURCE, requestId),
    loadConsentByPageType(executor, SOURCE, requestId),
    loadOptInRateEvolution(executor, SOURCE, requestId),
  ]);

  return { status: "ok", kpi, byMonth, byMember, byDevice, byPageType, rateEvolution };
}
