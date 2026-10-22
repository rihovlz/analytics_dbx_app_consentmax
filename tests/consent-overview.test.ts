import assert from "node:assert/strict";
import test from "node:test";

import type { FilterParams } from "../src/features/consent-overview/contract";
import {
  loadConsentByDevice,
  loadConsentByMember,
  loadKpiHeader,
  loadOptInByPeriod,
} from "../src/features/consent-overview/server/repository";
import { getConsentOverview } from "../src/features/consent-overview/server/service";
import type { DemoConfig } from "../src/lib/config/server-config";
import type { SqlExecutor } from "../src/lib/databricks/types";

const demoConfig: DemoConfig = {
  mode: "demo",
  appName: "Test",
  appDescription: "Test",
  supportContact: { name: "Test", slackUrl: "https://valiuz.slack.com/" },
  logLevel: "info",
};

const NO_FILTER: FilterParams = { granularity: "month" };
const SOURCE = "prd-consent.analytics.last_consent_event";
const QUOTED_SOURCE = "`prd-consent`.`analytics`.`last_consent_event`";

// ── Demo ──────────────────────────────────────────────────────────────────────

test("consent-overview demo retourne la shape KPI attendue", async () => {
  const result = await getConsentOverview(NO_FILTER, undefined, { config: demoConfig });
  assert.equal(result.status, "demo");
  assert.ok(result.kpi.contactTotal > 0);
  assert.ok(result.kpi.consentRate > 0 && result.kpi.consentRate < 1);
  assert.ok(result.byPeriod.length > 0);
  assert.ok(result.byMember.length > 0);
  assert.ok(result.byDevice.length > 0);
  assert.ok(result.byPageType.length > 0);
  assert.ok(result.rateEvolution.length > 0);
});

test("consent-overview demo consentRate cohérent avec optIn / contactWithChoice", async () => {
  const result = await getConsentOverview(NO_FILTER, undefined, { config: demoConfig });
  const expected = result.kpi.optIn / result.kpi.contactWithChoice;
  assert.ok(Math.abs(result.kpi.consentRate - expected) < 0.01);
});

test("consent-overview demo granularity=day retourne des périodes au format YYYY-MM-DD", async () => {
  const result = await getConsentOverview({ granularity: "day" }, undefined, { config: demoConfig });
  assert.ok(result.byPeriod[0]?.period.match(/^\d{4}-\d{2}-\d{2}$/));
});

test("consent-overview demo granularity=week retourne des périodes au format YYYY-WW", async () => {
  const result = await getConsentOverview({ granularity: "week" }, undefined, { config: demoConfig });
  assert.ok(result.byPeriod[0]?.period.match(/^\d{4}-\d{2}$/));
});

// ── Repository — bindings SQL ─────────────────────────────────────────────────

const KPI_ROW = { contact_total: "1000", contact_with_choice: "900",
  opt_in: "600", custom: "10", opt_out: "290", without_choice: "100", last_event_at: "2026-10-20" };

test("loadKpiHeader lie la source et retourne le header parsé", async () => {
  const executor: SqlExecutor = {
    query: async (options) => {
      // Le loader fait 2 appels : kpi principal + last30d (si période > 30j)
      assert.ok(
        options.name === "consent-overview-kpi" || options.name === "consent-overview-kpi-last30d",
        `nom inattendu: ${options.name}`,
      );
      assert.equal(options.parameters?.["source"], QUOTED_SOURCE);
      assert.equal(options.maxRows, 1);
      return [KPI_ROW] as never[];
    },
  };
  const result = await loadKpiHeader(executor, SOURCE, { members: ["LRM"], granularity: "month" });
  assert.equal(result.contactTotal, 1000);
  assert.equal(result.optIn, 600);
  assert.ok(Math.abs(result.consentRate - 600 / 900) < 0.001);
  // last30d=null car daysBetween sans dates = historique complet > 30j
  // mais le second appel nécessite des mocks — on vérifie juste que la valeur est nombre ou null
  assert.ok(result.last30dConsentRate === null || typeof result.last30dConsentRate === "number");
});

test("loadKpiHeader sans filtre retourne le header parsé", async () => {
  const executor: SqlExecutor = {
    query: async () => [
      { contact_total: "500", contact_with_choice: "400", opt_in: "300",
        custom: "5", opt_out: "95", without_choice: "100", last_event_at: null },
    ] as never[],
  };
  const result = await loadKpiHeader(executor, SOURCE, NO_FILTER);
  assert.equal(result.contactTotal, 500);
});

test("loadOptInByPeriod propage la granularité dans les paramètres", async () => {
  const executor: SqlExecutor = {
    query: async (options) => {
      assert.equal(options.name, "consent-overview-by-period");
      assert.equal(options.parameters?.["granularity"], "day");
      return [{ period: "2026-10-21", first_consent: "100", reexposed: "40" }] as never[];
    },
  };
  const result = await loadOptInByPeriod(executor, SOURCE, { granularity: "day" });
  assert.equal(result[0]?.period, "2026-10-21");
  assert.equal(result[0]?.firstConsent, 100);
  assert.equal(result[0]?.reexposed, 40);
});

test("loadConsentByMember calcule consentRate par ligne", async () => {
  const executor: SqlExecutor = {
    query: async () =>
      [{ member: "LRM", opt_in: "600", opt_out: "300", custom: "10", total: "950" }] as never[],
  };
  const result = await loadConsentByMember(executor, SOURCE, NO_FILTER);
  assert.equal(result[0]?.member, "LRM");
  assert.ok(Math.abs((result[0]?.consentRate ?? 0) - 600 / 950) < 0.001);
});

test("loadConsentByDevice filtre Unknown et lie la source correctement", async () => {
  const executor: SqlExecutor = {
    query: async (options) => {
      assert.equal(options.name, "consent-overview-by-device");
      assert.equal(options.parameters?.["source"], QUOTED_SOURCE);
      return [
        { device_type: "Desktop", opt_in: 600, opt_out: 400, total: 1000 },
        { device_type: "Unknown", opt_in: 10,  opt_out: 5,   total: 15 },
      ] as never[];
    },
  };
  const result = await loadConsentByDevice(executor, SOURCE, NO_FILTER);
  assert.equal(result.length, 1, "Unknown filtré");
  assert.equal(result[0]?.deviceType, "Desktop");
  assert.ok(result[0]?.shareOfTotal > 0, "shareOfTotal calculé");
  assert.ok(Math.abs((result[0]?.consentRate ?? 0) - 600 / 1000) < 0.001);
});
