import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: "reduce" }); });

test("périodes, filtre commun, décomposition et tableau accessible", async ({ page }) => {
  await page.goto("/visualizations");
  const comparison = page.getByRole("region", { name: "Comparer deux périodes", exact: true });
  await expect(comparison.getByRole("heading", { name: "Décomposition de l’écart" })).toBeVisible();
  await expect(comparison.getByText("1 sept. 2026 – 14 sept. 2026 · 14 jours", { exact: true })).toBeVisible();
  await expect(comparison.getByText("18 août 2026 – 31 août 2026 · 14 jours", { exact: true })).toBeVisible();
  const details = comparison.getByText("Voir toutes les contributions", { exact: true });
  await details.focus();
  await page.keyboard.press("Enter");
  await expect(comparison.getByRole("table", { name: /Contributions exactes/ })).toContainText("Application");
  await comparison.getByLabel("Segment commun aux deux périodes").selectOption('"Web"');
  await comparison.getByRole("button", { name: "Comparer les périodes" }).click();
  await expect(comparison.getByRole("status").filter({ hasText: "Segment : Web" })).toBeVisible();
  await comparison.getByText("Voir toutes les contributions", { exact: true }).click();
  await expect(comparison.getByRole("table", { name: /Contributions exactes/ })).toContainText("Web");
  await expect(comparison.getByRole("table", { name: /Contributions exactes/ })).not.toContainText("Magasin");
  await comparison.getByLabel("Comparer avec").selectOption("previous-year");
  await comparison.getByRole("button", { name: "Comparer les périodes" }).click();
  await expect(comparison.getByText("1 sept. 2025 – 14 sept. 2025 · 14 jours", { exact: true })).toBeVisible();
  await comparison.getByText("Voir les valeurs par jour", { exact: true }).click();
  await expect(comparison.getByRole("table", { name: /Comparaison quotidienne/ })).toContainText("14 sept. 2025");
});

test("référence personnalisée, périodes partielles et absence de données", async ({ page }) => {
  await page.goto("/visualizations");
  const comparison = page.getByRole("region", { name: "Comparer deux périodes", exact: true });
  await expect(comparison.getByRole("heading", { name: "Décomposition de l’écart" })).toBeVisible();
  await comparison.getByLabel("Comparer avec").selectOption("custom");
  await comparison.getByLabel("Début de la référence").fill("2026-08-01");
  await comparison.getByLabel("Fin de la référence").fill("2026-08-07");
  await comparison.getByRole("button", { name: "Comparer les périodes" }).click();
  await expect(comparison.getByText(/durées différentes/)).toBeVisible();
  await expect(comparison.getByText("1 août 2026 – 7 août 2026 · 7 jours", { exact: true })).toBeVisible();
  await comparison.getByLabel("Comparer avec").selectOption("previous-period");
  await comparison.getByLabel("Début de la période analysée").fill("2026-09-19");
  await comparison.getByLabel("Fin de la période analysée").fill("2026-09-22");
  await comparison.getByRole("button", { name: "Comparer les périodes" }).click();
  await expect(comparison.getByText(/Période partielle/)).toBeVisible();
  await comparison.getByLabel("Début de la période analysée").fill("2023-09-01");
  await comparison.getByLabel("Fin de la période analysée").fill("2023-09-14");
  await comparison.getByRole("button", { name: "Comparer les périodes" }).click();
  await expect(comparison.getByText("Aucune donnée sur ces périodes", { exact: true })).toBeVisible();
  await expect(comparison.getByRole("heading", { name: "Décomposition de l’écart" })).toHaveCount(0);
});

test("chargement, erreur sûre et reprise explicite", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/period-comparison/demo?*", async (route) => {
    await gate;
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "SQL_QUERY_FAILED", message: "Les données sont indisponibles.", requestId: "comparison-e2e" } }) });
  });
  await page.goto("/visualizations");
  await expect(page.getByRole("status").filter({ hasText: "Comparaison des périodes…" })).toBeVisible();
  release();
  await expect(page.getByRole("alert").filter({ hasText: "Comparaison indisponible" })).toContainText("comparison-e2e");
  await page.unroute("**/api/period-comparison/demo?*");
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Décomposition de l’écart" })).toBeVisible();
});

test("un ancien résultat ne remplace pas la sélection suivante", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let held = false;
  await page.route("**/api/period-comparison/demo?*", async (route) => {
    if (!held) { held = true; await gate; }
    await route.continue();
  });
  await page.goto("/visualizations");
  await expect(page.getByRole("status").filter({ hasText: "Comparaison des périodes…" })).toBeVisible();
  await page.getByLabel("Comparer avec").selectOption("previous-year");
  await page.getByRole("button", { name: "Comparer les périodes" }).click();
  await expect(page.getByText("1 sept. 2025 – 14 sept. 2025 · 14 jours", { exact: true })).toBeVisible();
  release();
  await expect(page.getByText("18 août 2026 – 31 août 2026 · 14 jours", { exact: true })).toHaveCount(0);
});

test("thèmes, mobile et contrôle des contributions au clavier", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/visualizations");
  const comparison = page.getByRole("region", { name: "Comparer deux périodes", exact: true });
  await expect(comparison.getByRole("heading", { name: "Décomposition de l’écart" })).toBeVisible();
  await comparison.screenshot({ path: "test-results/comparison-desktop-light.png" });
  await page.getByRole("button", { name: "Thème sombre", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const series = comparison.getByRole("figure", { name: /^Évolution comparée\./ });
  const amounts = series.locator(".recharts-cartesian-axis-tick-value").filter({ hasText: "€" });
  await expect(amounts.first()).toBeVisible();
  await expect.poll(() => amounts.evaluateAll((labels) =>
    labels.flatMap((label) => {
      const svg = label.closest("svg")!.getBoundingClientRect();
      const bounds = label.getBoundingClientRect();
      return bounds.left >= svg.left - 1 && bounds.right <= svg.right + 1 ? [] : [{ text: label.textContent, left: bounds.left - svg.left, right: bounds.right - svg.right }];
    }),
  )).toEqual([]);
  await comparison.getByText("Voir toutes les contributions", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(comparison.getByRole("table", { name: /Contributions exactes/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await comparison.screenshot({ path: "test-results/comparison-mobile-dark.png" });
});
