import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { parse } from "yaml";

const fixtureFiles = [
  "config/data-projects.json",
  "scripts/app-guide.mjs",
  "scripts/app-spec.mjs",
  "scripts/app-capabilities.mjs",
  "config/appkit-capabilities.json",
  "scripts/data-access.mjs",
  "scripts/new-feature.mjs",
  "scripts/feature-comparison-template.mjs",
  "src/components/app-shell/app-nav.tsx",
  "src/client/routes.tsx",
  "src/server/routes.ts",
];

async function prepareFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "app-guidance-"));
  for (const file of fixtureFiles) {
    const destination = join(root, file);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(file, destination);
  }
  await mkdir(join(root, "config"), { recursive: true });
  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(
    join(root, "config/app-spec.yml"),
    "version: 1\napp:\n  name: __PACKAGE_NAME__\n  type: dashboard\n  audience: À confirmer\n  decision: À confirmer\n  success: À confirmer\nfeatures: []\n",
    "utf8",
  );
  await writeFile(
    join(root, "docs/product-brief.md"),
    "# Brief produit\n\n## Objectif et utilisateurs\n\n- Type : dashboard\n- Utilisateurs : À confirmer\n- Décision à faciliter : À confirmer\n- Critère de succès : À confirmer\n\n## KPI, sources et fonctionnalités\n\nÀ confirmer avec la première tranche verticale.\n\n## Accès, confidentialité et exploitation\n\nÀ confirmer avant le premier accès à des données réelles.\n\n## Backlog\n\nConstruire et faire valider une tranche à la fois.\n",
    "utf8",
  );
  await writeFile(
    join(root, "config/data-access.json"),
    JSON.stringify({
      project: "dev-dtm-media-pm",
      sources: [
        {
          name: "sales-source",
          fullName: "dev-dtm-media-pm.analytics.sales_daily",
          purpose: "Daily sales dashboard",
        },
      ],
    }),
    "utf8",
  );
  await symlink(join(process.cwd(), "node_modules"), join(root, "node_modules"), "dir");
  return root;
}

test("app guide rejects an unsupported app type", async () => {
  const root = await prepareFixture();
  const result = spawnSync(
    process.execPath,
    ["scripts/app-guide.mjs", "--non-interactive", "--type", "portal"],
    { cwd: root, encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /App type/);
});

test("comparison generation is opt-in, preserves metadata and rejects injected columns before writing", async () => {
  const root = await prepareFixture();
  const args = ["scripts/new-feature.mjs", "sales-comparison", "--non-interactive", "--source", "sales-source", "--aggregation", "sum", "--column", "amount", "--date-column", "order_date", "--breakdown-column", "channel"];
  const before = await readFile(join(root, "config/app-spec.yml"), "utf8");
  const rejected = spawnSync(process.execPath, [...args.slice(0, -1), "channel`); DROP TABLE sales;--"], { cwd: root, encoding: "utf8" });
  assert.notEqual(rejected.status, 0);
  assert.equal(await readFile(join(root, "config/app-spec.yml"), "utf8"), before);
  execFileSync(process.execPath, args, { cwd: root });
  execFileSync(process.execPath, ["scripts/app-guide.mjs", "--non-interactive"], { cwd: root });
  const spec = parse(await readFile(join(root, "config/app-spec.yml"), "utf8"));
  assert.deepEqual(spec.features[0].comparison, { dateColumn: "order_date", breakdownColumn: "channel" });
  assert.match(await readFile(join(root, "docs/product-brief.md"), "utf8"), /colonne DATE `order_date`/);
  const query = await readFile(join(root, "src/features/sales-comparison/server/queries.ts"), "utf8");
  assert.equal((query.match(/IDENTIFIER\(\?\)/g) ?? []).length, 2);
  assert.match(query, /CAST\(\? AS DATE\)/);
  assert.match(query, /LIMIT 1001/);
  assert.match(await readFile(join(root, "src/features/sales-comparison/sales-comparison-card.tsx"), "utf8"), /showWaterfall=\{true\}/);
});

test("app guide and feature generator create one complete vertical slice", async () => {
  const root = await prepareFixture();
  execFileSync(
    process.execPath,
    [
      "scripts/app-guide.mjs",
      "--non-interactive",
      "--type", "cockpit",
      "--capabilities", "genie",
      "--audience", "Responsable commercial",
      "--decision", "Suivre les ventes",
      "--success", "Le KPI est revu chaque semaine",
    ],
    { cwd: root },
  );
  execFileSync(
    process.execPath,
    [
      "scripts/new-feature.mjs",
      "daily-sales",
      "--non-interactive",
      "--title", "Ventes quotidiennes",
      "--question", "Quel chiffre suivre aujourd’hui ?",
      "--source", "sales-source",
      "--aggregation", "sum",
      "--column", "revenue",
      "--label", "Chiffre d’affaires",
      "--unit", "EUR",
      "--demo-value", "1200",
      "--acceptance", "La valeur correspond au contrôle métier quotidien.",
    ],
    { cwd: root },
  );

  const spec = await readFile(join(root, "config/app-spec.yml"), "utf8");
  const query = await readFile(join(root, "src/features/daily-sales/server/queries.ts"), "utf8");
  const repository = await readFile(join(root, "src/features/daily-sales/server/repository.ts"), "utf8");
  const navigation = await readFile(join(root, "src/components/app-shell/app-nav.tsx"), "utf8");
  assert.match(spec, /slug: daily-sales/);
  assert.deepEqual(parse(spec).capabilities, ["genie", "analytics"]);
  assert.match(query, /SUM\(`revenue`\)/);
  assert.match(repository, /parameters: \[quoteQualifiedIdentifier\(source\)\]/);
  assert.match(
    await readFile(join(root, "tests/daily-sales.test.ts"), "utf8"),
    /`dev-dtm-media-pm`\.`analytics`\.`sales_daily`/,
  );
  assert.match(navigation, /Ventes quotidiennes/);
  assert.match(await readFile(join(root, "tests/daily-sales.test.ts"), "utf8"), /deterministic demo value/);
  const removeAnalytics = spawnSync(process.execPath, ["scripts/app-guide.mjs", "--non-interactive", "--capabilities", "genie"], { cwd: root, encoding: "utf8" });
  assert.notEqual(removeAnalytics.status, 0);
  assert.match(removeAnalytics.stderr, /Existing KPI features require the analytics capability/);
  assert.equal(await readFile(join(root, "config/app-spec.yml"), "utf8"), spec);
});

test("a Genie-only app keeps its capabilities across guide runs without changing runtime resources", async () => {
  const root = await prepareFixture();
  const before = await readFile(join(root, "config/data-access.json"), "utf8");
  const run = (args: string[]) => execFileSync(process.execPath, ["scripts/app-guide.mjs", "--non-interactive", ...args], { cwd: root, encoding: "utf8" });
  const output = run(["--type", "assistant", "--capabilities", "genie"]);
  assert.doesNotMatch(output, /feature:new/);
  run(["--audience", "Équipe commerciale"]);
  const plan = JSON.parse(execFileSync(process.execPath, ["scripts/app-capabilities.mjs", "--json"], { cwd: root, encoding: "utf8" }));
  assert.deepEqual(plan.capabilities.map((item: { id: string }) => item.id), ["genie"]);
  assert.equal(plan.activatesPlugins, false);
  assert.equal(plan.capabilities[0].availability, "adapter");
  assert.equal(await readFile(join(root, "config/data-access.json"), "utf8"), before);
  const brief = await readFile(join(root, "docs/product-brief.md"), "utf8");
  assert.match(brief, /\*\*genie\*\*/);
  assert.match(brief, /Équipe commerciale/);
  execFileSync(process.execPath, ["scripts/app-guide.mjs", "--check"], { cwd: root });
});

test("invalid capability choices fail before changing the spec or brief", async () => {
  const root = await prepareFixture();
  const paths = ["config/app-spec.yml", "docs/product-brief.md"];
  const before = await Promise.all(paths.map((file) => readFile(join(root, file), "utf8")));
  for (const choice of ["unknown", "genie,genie", "analytics,,files", "analytics;echo secret"]) {
    const result = spawnSync(process.execPath, ["scripts/app-guide.mjs", "--non-interactive", "--capabilities", choice], { cwd: root, encoding: "utf8" });
    assert.notEqual(result.status, 0);
  }
  assert.deepEqual(await Promise.all(paths.map((file) => readFile(join(root, file), "utf8"))), before);
});

test("optional and beta capabilities produce a proposal and never generate a runtime plugin", async () => {
  const root = await prepareFixture();
  const before = await readFile(join(root, "src/server/routes.ts"), "utf8");
  execFileSync(process.execPath, ["scripts/app-guide.mjs", "--non-interactive", "--type", "workflow", "--capabilities", "files,serving,agents"], { cwd: root });
  const plan = JSON.parse(execFileSync(process.execPath, ["scripts/app-capabilities.mjs", "--json"], { cwd: root, encoding: "utf8" }));
  assert.equal(plan.activatesPlugins, false);
  assert.equal(plan.capabilities.every((item: { availability: string }) => item.availability === "optional"), true);
  assert.equal(plan.capabilities.find((item: { id: string }) => item.id === "agents").stability, "beta");
  assert.equal(await readFile(join(root, "src/server/routes.ts"), "utf8"), before);
  assert.match(await readFile(join(root, "docs/product-brief.md"), "utf8"), /décision explicite requise/);
});
