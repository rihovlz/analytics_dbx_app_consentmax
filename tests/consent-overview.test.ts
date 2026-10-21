import assert from "node:assert/strict";
import test from "node:test";

import {
  loadConsentByDevice,
  loadConsentByMember,
  loadKpiHeader,
  loadOptInByMonth,
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

// ── Demo mode ─────────────────────────────────────────────────────────────────

test("consent-overview demo returns expected KPI shape", async () => {
  const result = await getConsentOverview(undefined, { config: demoConfig });
  assert.equal(result.status, "demo");
  assert.ok(result.kpi.contactTotal > 0, "contactTotal > 0");
  assert.ok(result.kpi.optIn > 0, "optIn > 0");
  assert.ok(result.kpi.consentRate > 0 && result.kpi.consentRate < 1, "consentRate in (0,1)");
  assert.ok(result.byMonth.length > 0, "byMonth non vide");
  assert.ok(result.byMember.length > 0, "byMember non vide");
  assert.ok(result.byDevice.length > 0, "byDevice non vide");
  assert.ok(result.byPageType.length > 0, "byPageType non vide");
  assert.ok(result.rateEvolution.length > 0, "rateEvolution non vide");
});

test("consent-overview demo consentRate coherent with optIn / contactWithChoice", async () => {
  const result = await getConsentOverview(undefined, { config: demoConfig });
  const expected = result.kpi.optIn / result.kpi.contactWithChoice;
  assert.ok(Math.abs(result.kpi.consentRate - expected) < 0.01, "consentRate cohérent");
});

// ── Repository — SQL bindings (fake executor) ─────────────────────────────────

const SOURCE = "dev-consent.analytics.last_consent_event";
const QUOTED_SOURCE = "`dev-consent`.`analytics`.`last_consent_event`";

test("loadKpiHeader binds correct source and returns parsed header", async () => {
  const executor: SqlExecutor = {
    query: async (options) => {
      assert.equal(options.name, "consent-overview-kpi");
      assert.equal(options.parameters?.["source"], QUOTED_SOURCE);
      assert.equal(options.maxRows, 1);
      return [
        {
          contact_total: "1000",
          contact_with_choice: "900",
          opt_in: "600",
          custom: "10",
          opt_out: "290",
          without_choice: "100",
          last_event_at: "2026-10-20",
        },
      ] as never[];
    },
  };
  const result = await loadKpiHeader(executor, SOURCE);
  assert.equal(result.contactTotal, 1000);
  assert.equal(result.optIn, 600);
  assert.ok(Math.abs(result.consentRate - 600 / 900) < 0.001, "consentRate = opt_in / contact_with_choice");
});

test("loadOptInByMonth binds source and maps snake_case to camelCase", async () => {
  const executor: SqlExecutor = {
    query: async (options) => {
      assert.equal(options.name, "consent-overview-by-month");
      assert.equal(options.parameters?.["source"], QUOTED_SOURCE);
      return [{ month: "2026-10", first_consent: "100", refresh: "40" }] as never[];
    },
  };
  const result = await loadOptInByMonth(executor, SOURCE);
  assert.equal(result[0]?.month, "2026-10");
  assert.equal(result[0]?.firstConsent, 100);
  assert.equal(result[0]?.refresh, 40);
});

test("loadConsentByMember computes consentRate per row", async () => {
  const executor: SqlExecutor = {
    query: async () =>
      [{ member: "LRM", opt_in: "600", opt_out: "300", custom: "10", total: "950" }] as never[],
  };
  const result = await loadConsentByMember(executor, SOURCE);
  assert.equal(result[0]?.member, "LRM");
  assert.ok(Math.abs((result[0]?.consentRate ?? 0) - 600 / 950) < 0.001);
});

test("loadConsentByDevice applies device_type_agg logic via SQL (verifies binding only)", async () => {
  const executor: SqlExecutor = {
    query: async (options) => {
      assert.equal(options.name, "consent-overview-by-device");
      return [{ device_type: "Desktop", opt_in: "500", opt_out: "400", total: "950" }] as never[];
    },
  };
  const result = await loadConsentByDevice(executor, SOURCE);
  assert.equal(result[0]?.deviceType, "Desktop");
  assert.ok(Math.abs((result[0]?.consentRate ?? 0) - 500 / 950) < 0.001);
});
