import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

const fixtureFiles = [
  "config/data-projects.json",
  "scripts/app-guide.mjs",
  "scripts/app-spec.mjs",
  "scripts/data-access.mjs",
  "scripts/new-feature.mjs",
  "src/components/app-shell/app-nav.tsx",
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

test("app guide and feature generator create one complete vertical slice", async () => {
  const root = await prepareFixture();
  execFileSync(
    process.execPath,
    [
      "scripts/app-guide.mjs",
      "--non-interactive",
      "--type", "cockpit",
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
  assert.match(query, /SUM\(`revenue`\)/);
  assert.match(repository, /parameters: \[quoteQualifiedIdentifier\(source\)\]/);
  assert.match(
    await readFile(join(root, "tests/daily-sales.test.ts"), "utf8"),
    /`dev-dtm-media-pm`\.`analytics`\.`sales_daily`/,
  );
  assert.match(navigation, /Ventes quotidiennes/);
  assert.match(await readFile(join(root, "tests/daily-sales.test.ts"), "utf8"), /deterministic demo value/);
});
