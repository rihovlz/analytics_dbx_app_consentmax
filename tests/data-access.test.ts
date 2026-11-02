import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { parse } from "yaml";

import { parseDataAccessManifest } from "../src/lib/config/data-access";

const supportFiles = [
  "config/data-projects.json",
  "scripts/data-access.mjs",
  "scripts/render-data-access.mjs",
];

test("validates a source inside an approved data project", () => {
  const manifest = parseDataAccessManifest({
    project: "dev-dtm-insight-sharing",
    sources: [
      {
        name: "shared-insights",
        fullName: "dev-dtm-insight-sharing.analytics.shared_insights",
        purpose: "Shared insight dashboard",
      },
    ],
  }, true);

  assert.equal(manifest.project, "dev-dtm-insight-sharing");
  assert.equal(manifest.sources.length, 1);
});

test("rejects a source from another project", () => {
  assert.throws(
    () =>
      parseDataAccessManifest({
        project: "dev-dtm-myvaliuz",
        sources: [
          {
            name: "foreign-source",
            fullName: "dev-dtm-media-pm.analytics.foreign_source",
            purpose: "Invalid cross-project source",
          },
        ],
      }),
    /Invalid data access manifest/,
  );
});

test("cross-project reads require an explicit approved project matching the source", () => {
  const source = { name: "missing-contacts", project: "prd-dtm-core-enrichment",
    fullName: "prd-dtm-core-enrichment.analytics.optin_missing_contacts", purpose: "Missing contacts" };
  const manifest = { project: "prd-consent", sources: [source] };
  assert.equal(parseDataAccessManifest(manifest).sources[0].project, source.project);
  for (const project of [undefined, "unknown-project", "prd-consent"]) {
    assert.throws(() => parseDataAccessManifest({ ...manifest, sources: [{ ...source, project }] }), /Invalid data access manifest/);
  }
  assert.throws(() => parseDataAccessManifest({ ...manifest,
    personalState: { analyses: "prd-dtm-core-enrichment.state.saved_analyses_v1",
      preferences: "prd-dtm-core-enrichment.state.user_preferences_v1" },
  }), /Invalid data access manifest/);
});

test("renders least-privilege Unity Catalog app resources and detects drift", async () => {
  const root = await mkdtemp(join(tmpdir(), "databricks-data-access-"));
  for (const file of supportFiles) {
    const destination = join(root, file);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(file, destination);
  }
  await mkdir(join(root, "resources"), { recursive: true });
  await writeFile(
    join(root, "config/data-access.json"),
    JSON.stringify({
      project: "dev-dtm-media-pm",
      sources: [
        {
          name: "campaign-performance",
          fullName: "dev-dtm-media-pm.analytics.campaign_performance",
          purpose: "Campaign cockpit",
        },
        {
          name: "missing-contacts",
          project: "prd-dtm-core-enrichment",
          fullName: "prd-dtm-core-enrichment.analytics.optin_missing_contacts",
          purpose: "Missing contacts",
        },
      ],
    }),
    "utf8",
  );

  execFileSync(process.execPath, ["scripts/render-data-access.mjs"], { cwd: root });
  const rendered = await readFile(join(root, "resources/data-access.generated.yml"), "utf8");
  assert.match(rendered, /name: \$\{var\.app_name\}/);
  assert.match(rendered, /level: CAN_MANAGE/);
  assert.equal(parse(rendered).resources.apps.app.user_api_scopes, undefined);
  assert.doesNotMatch(rendered, /genie|CAN_RUN/);
  assert.match(rendered, /uc_securable:/);
  assert.match(rendered, /dev-dtm-media-pm\.analytics\.campaign_performance/);
  assert.match(rendered, /permission: SELECT/);
  execFileSync(process.execPath, ["scripts/render-data-access.mjs", "--check"], { cwd: root });

  const metadataPath = join(root, "config/appkit-resources.generated.json");
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  assert.deepEqual(metadata.sources, [
    { fullName: "dev-dtm-media-pm.analytics.campaign_performance", permission: "SELECT" },
    { fullName: "prd-dtm-core-enrichment.analytics.optin_missing_contacts", permission: "SELECT" },
  ]);
  const bindings = parse(rendered).resources.apps.app.resources;
  assert.equal(bindings[2].uc_securable.securable_full_name, metadata.sources[1].fullName);
  assert.equal(bindings[2].uc_securable.permission, "SELECT");
  assert.equal(metadata.warehouse.binding, "sql-warehouse");
  assert.equal(metadata.genie, undefined);
  metadata.sources[0].permission = "MODIFY";
  await writeFile(metadataPath, JSON.stringify(metadata), "utf8");
  assert.throws(
    () => execFileSync(process.execPath, ["scripts/render-data-access.mjs", "--check"], { cwd: root, stdio: "pipe" }),
    /AppKit resource metadata is stale/,
  );
  execFileSync(process.execPath, ["scripts/render-data-access.mjs"], { cwd: root });

  await writeFile(join(root, "resources/data-access.generated.yml"), "stale\n", "utf8");
  assert.throws(
    () => execFileSync(process.execPath, ["scripts/render-data-access.mjs", "--check"], { cwd: root, stdio: "pipe" }),
    /Command failed/,
  );
  const accessPath = join(root, "config/data-access.json");
  const access = JSON.parse(await readFile(accessPath, "utf8"));
  for (const project of [undefined, "unknown-project", "prd-consent"]) {
    access.sources[1].project = project;
    await writeFile(accessPath, JSON.stringify(access));
    assert.throws(() => execFileSync(process.execPath, ["scripts/render-data-access.mjs"], { cwd: root, stdio: "pipe" }));
  }
});


test("defines the app resource in one included bundle file", async () => {
  const bundle = parse(await readFile("databricks.yml", "utf8"));
  const generated = parse(await readFile("resources/data-access.generated.yml", "utf8"));

  assert.equal(bundle.resources?.apps?.app, undefined);
  assert.equal(generated.resources.apps.app.name, "${var.app_name}");
  assert.equal(generated.resources.apps.app.compute_size, "MEDIUM");
  assert.equal(generated.resources.apps.app.user_api_scopes, undefined);
  assert.equal(generated.resources.apps.app.permissions.length, 2);
  assert.ok(generated.resources.apps.app.resources.every((resource: { genie_space?: unknown }) => !resource.genie_space));
});
