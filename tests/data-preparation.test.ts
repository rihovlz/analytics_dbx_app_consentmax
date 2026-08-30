import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import test from "node:test";
import { parse } from "yaml";

const fixtureFiles = [
  ".env.example",
  "app.yaml",
  "config/data-projects.json",
  "data/databricks.yml",
  "data/resources.generated.yml",
  "resources/data-access.generated.yml",
  "scripts/data-access.mjs",
  "scripts/data-preparation.mjs",
  "scripts/init-data.mjs",
  "scripts/render-data-preparation.mjs",
  "scripts/run-data-preparation.mjs",
];

async function prepareFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "data-preparation-"));
  for (const file of fixtureFiles) {
    const destination = join(root, file);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(file, destination);
  }
  for (const directory of ["data/contracts", "data/notebooks", "data/pipelines", "data/tests"] ) {
    await mkdir(join(root, directory), { recursive: true });
  }
  await writeFile(
    join(root, "config/data-access.json"),
    JSON.stringify({ project: "dev-dtm-media-pm", sources: [] }),
    "utf8",
  );
  await writeFile(
    join(root, "app.yaml"),
    "env:\n  - name: DATABRICKS_CATALOG\n    value: dev-dtm-media-pm\n",
    "utf8",
  );
  await writeFile(join(root, ".env.example"), "DATABRICKS_CATALOG=dev-dtm-media-pm\n", "utf8");
  await symlink(join(process.cwd(), "node_modules"), join(root, "node_modules"), "dir");
  return root;
}

test("direct data init adds no Databricks preparation resource", async () => {
  const root = await prepareFixture();
  execFile(
    root,
    [
      "scripts/init-data.mjs",
      "sales-source",
      "--non-interactive",
      "--mode", "direct",
      "--source", "dev-dtm-media-pm.analytics.sales",
      "--owner", "Analytics",
      "--purpose", "Read sales directly",
      "--grain", "Une ligne par vente",
      "--refresh", "daily",
      "--freshness-hours", "24",
    ],
  );
  assert.match(await readFile(join(root, "data/resources.generated.yml"), "utf8"), /resources: \{\}/);
  assert.equal(JSON.parse(await readFile(join(root, "config/data-access.json"), "utf8")).sources.length, 1);
});

test("data init creates a reviewed-column notebook job and runnable contract", async () => {
  const root = await prepareFixture();
  execFile(
    root,
    [
      "scripts/init-data.mjs",
      "daily-sales",
      "--non-interactive",
      "--mode", "notebook",
      "--source", "dev-dtm-media-pm.raw.sales",
      "--output", "dev-dtm-media-pm.analytics.daily_sales",
      "--columns", "sale_date,revenue",
      "--owner", "Analytics",
      "--purpose", "Prepare daily sales",
      "--grain", "Une ligne par jour",
      "--keys", "sale_date",
      "--refresh", "daily",
      "--freshness-hours", "24",
    ],
  );
  const notebook = await readFile(join(root, "data/notebooks/daily-sales.sql"), "utf8");
  const resources = await readFile(join(root, "data/resources.generated.yml"), "utf8");
  const access = JSON.parse(await readFile(join(root, "config/data-access.json"), "utf8"));
  assert.match(notebook, /CREATE OR REPLACE TABLE/);
  assert.doesNotMatch(notebook, /SELECT \*/);
  assert.match(resources, /notebook_task:/);
  assert.match(resources, /pause_status: \$\{var\.schedule_pause_status\}/);
  assert.equal(typeof parse(resources).resources.jobs.prepare_daily_sales, "object");
  assert.equal(access.sources[0].fullName, "dev-dtm-media-pm.analytics.daily_sales");

  const executable = join(root, "databricks");
  const log = join(root, "commands.log");
  await writeFile(
    executable,
    [
      "#!/bin/sh",
      "if [ \"$1 $2\" = \"auth describe\" ]; then",
      "  printf '  ✓ host: https://dbc.example.cloud.databricks.com (from profile)\\n'",
      "  exit 0",
      "fi",
      "printf '%s\\n' \"$*\" >> \"$DATABRICKS_TEST_LOG\"",
    ].join("\n"),
    "utf8",
  );
  await chmod(executable, 0o755);
  execFile(
    root,
    ["scripts/run-data-preparation.mjs", "daily-sales", "--profile", "analytics-dev", "--confirm"],
    { DATABRICKS_TEST_LOG: log, PATH: `${root}${delimiter}${process.env.PATH ?? ""}` },
  );
  assert.deepEqual((await readFile(log, "utf8")).trim().split("\n"), [
    "bundle validate --target dev --profile analytics-dev --var schedule_pause_status=PAUSED",
    "bundle deploy --target dev --profile analytics-dev --var schedule_pause_status=PAUSED",
    "bundle run prepare_daily_sales --target dev --profile analytics-dev --var schedule_pause_status=PAUSED",
  ]);
});

test("pipeline mode generates an optional Lakeflow materialized view", async () => {
  const root = await prepareFixture();
  execFile(
    root,
    [
      "scripts/init-data.mjs",
      "weekly-sales",
      "--non-interactive",
      "--mode", "pipeline",
      "--source", "dev-dtm-media-pm.raw.sales",
      "--output", "dev-dtm-media-pm.analytics.weekly_sales",
      "--columns", "week_id,revenue",
      "--owner", "Analytics",
      "--purpose", "Prepare weekly sales",
      "--grain", "Une ligne par semaine",
      "--keys", "week_id",
      "--refresh", "daily",
      "--freshness-hours", "24",
    ],
  );
  const pipeline = await readFile(join(root, "data/pipelines/weekly-sales.sql"), "utf8");
  const resources = parse(await readFile(join(root, "data/resources.generated.yml"), "utf8"));
  assert.match(pipeline, /CREATE OR REFRESH MATERIALIZED VIEW `weekly_sales`/);
  assert.equal(resources.resources.pipelines.prepare_weekly_sales.serverless, true);
  assert.equal(
    resources.resources.jobs.prepare_weekly_sales.tasks[0].pipeline_task.pipeline_id,
    "${resources.pipelines.prepare_weekly_sales.id}",
  );
});

function execFile(root: string, args: string[], environment: Record<string, string> = {}): void {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...environment },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}
