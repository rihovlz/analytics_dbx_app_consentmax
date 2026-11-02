import { expect, test } from "@playwright/test";

test("ConsentMax conserve ses filtres, ses onglets et la langue FR/EN", async ({ page }) => {
  // These two existing services require SQL; keep this navigation test offline.
  await page.route("**/api/alliance-contribution", (route) => route.fulfill({ json: {
    status: "ok", members: ["LRM"], matrix: [{ collector: "LRM", recipient: "LRM", optIn: 10 }],
    byMember: [{ member: "LRM", self: 10, alliance: 0, total: 10, boosterRatio: 1, allianceShare: 0 }],
  } }));
  await page.route("**/api/missings", (route) => route.fulfill({ json: {
    status: "ok", globalUnknownPct: 0.2,
    rows: [{ member: "LRM", self: 10, unknown: 2, unknownPctSelf: 0.2,
      evolution30: null, evolution60: null, evolution90: null }],
    history: [{ day: "2026-10-01", member: "LRM", unknownPct: 0.2 }],
  } }));
  await page.goto("/");
  await expect(page).toHaveURL(/\/consent-overview$/);
  await expect(page.getByRole("region", { name: "Main KPIs", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Genie", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "All members", exact: true }).click();
  await page.getByRole("checkbox", { name: "LRM", exact: true }).check();
  await expect(page.getByRole("button", { name: "Apply", exact: true })).toBeEnabled();
  const filtered = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/consent-overview" && url.searchParams.get("members") === '["LRM"]';
  });
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  expect((await (await filtered).json()).filters.members).toEqual(["LRM"]);
  await expect(page.getByRole("button", { name: "Apply", exact: true })).toBeDisabled();

  await page.getByRole("link", { name: "Alliance contribution", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Opt-in — collecteurs × destinataires", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Opt-in — collectors × recipients", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Missings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Missing contacts", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Missing contacts", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "FR", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Contacts manquants", exact: true })).toBeVisible();
});

test("Self stats affiche le chargement puis une erreur sûre", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/consent-overview?*", async (route) => {
    await gate;
    await route.fulfill({ status: 503, json: { error: { message: "Données de test indisponibles." } } });
  });
  await page.goto("/consent-overview");
  await expect(page.getByText("Loading dashboard…", { exact: true })).toBeVisible();
  release();
  await expect(page.getByRole("alert")).toContainText("Données de test indisponibles.");
});
