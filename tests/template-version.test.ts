import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { parse } from "yaml";

test("declares the 1.0.0 baseline and the current 1.1.0 template", async () => {
  const manifest = parse(await readFile("template/manifest.yml", "utf8"));
  assert.equal(manifest.template.currentVersion, "1.1.0");
  assert.equal(manifest.versions["1.0.0"].sourceCommit, "05d914c6863c92304b1bc662e40c17e0f97b2c29");
  assert.equal(manifest.versions["1.1.0"].sourceCommit, "5df063bd0dc7b3664f1bf2cbe624119ddf5568ac");
  assert.equal(manifest.versions["1.1.0"].extends, "1.0.0");
});

test("verifies the source capabilities and exposes the 1.0.0 to 1.1.0 diff", () => {
  const status = JSON.parse(execFileSync(process.execPath, ["scripts/template-status.mjs", "--json"], { encoding: "utf8" }));
  assert.notEqual(status.instance.kind, "legacy");
  assert.equal(status.instance.effectiveVersion, "1.1.0");
  assert.equal(status.capabilities.every((capability: { ok: boolean }) => capability.ok), true);

  const upgrade = JSON.parse(execFileSync(
    process.execPath,
    ["scripts/template-status.mjs", "--diff", "--from", "1.0.0", "--to", "1.1.0", "--json"],
    { encoding: "utf8" },
  ));
  assert.deepEqual(
    upgrade.changes.map((change: { id: string }) => change.id),
    [
      "databricks-cli-host-output",
      "qualified-catalog-identifiers",
      "single-app-resource",
      "runtime-safe-build",
      "bundle-cli-compatibility",
      "clean-consumer-journey",
      "template-version-tracking",
    ],
  );
  assert.deepEqual(upgrade.validation, [
    "npm run template:status",
    "npm run template:check -- --to 1.1.0",
    "npm run app:doctor",
    "npm run check",
  ]);
});

test("rejects manifest paths that leave the application root", async () => {
  const root = await mkdtemp(join(tmpdir(), "template-manifest-invalid-"));
  for (const file of ["scripts/template-manifest.mjs", "scripts/template-status.mjs", "template/manifest.yml"]) {
    const destination = join(root, file);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(file, destination);
  }
  const manifestPath = join(root, "template/manifest.yml");
  const manifest = await readFile(manifestPath, "utf8");
  await writeFile(manifestPath, manifest.replace(
    "template/upgrades/1.0.0-to-1.1.0.yml",
    "../outside.yml",
  ), "utf8");
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "fixture" }), "utf8");
  await symlink(join(process.cwd(), "node_modules"), join(root, "node_modules"), "dir");

  const command = spawnSync(process.execPath, ["scripts/template-status.mjs", "--check"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(command.status, 1);
  assert.match(command.stderr, /Paths must stay inside the application root/);
});

test("reports a tracked 1.0.0 app and rejects missing 1.1.0 capabilities", async () => {
  const root = await mkdtemp(join(tmpdir(), "template-version-baseline-"));
  for (const file of ["scripts/template-manifest.mjs", "scripts/template-status.mjs", "template/manifest.yml"]) {
    const destination = join(root, file);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(file, destination);
  }
  for (const file of [
    "scripts/init-app.mjs",
    "scripts/app-guide.mjs",
    "scripts/new-feature.mjs",
    "config/data-access.json",
    "scripts/data-access.mjs",
    "resources/data-access.generated.yml",
    "data/databricks.yml",
    "scripts/init-data.mjs",
    "scripts/data-preparation.mjs",
    "src/components/app-shell/app-shell.tsx",
    "public/valiuz-logo-icon.svg",
    "public/favicon.svg",
    "app.yaml",
    "databricks.yml",
    "scripts/deploy.mjs",
  ]) {
    const destination = join(root, file);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, "", "utf8");
  }
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "baseline-app", scripts: {} }), "utf8");
  await writeFile(
    join(root, ".valiuz-template.yml"),
    [
      "schemaVersion: 1",
      "template:",
      "  id: valiuz/analytics_dbx_app_template",
      "  repository: https://github.com/valiuz/analytics_dbx_app_template",
      "  version: 1.0.0",
      "capabilities:",
      "  - guided-app-workflow",
      "  - declared-data-access",
      "  - optional-data-preparation",
      "  - valiuz-app-shell",
      "  - databricks-app-bundle",
      "appliedUpgrades: []",
      "",
    ].join("\n"),
    "utf8",
  );
  await symlink(join(process.cwd(), "node_modules"), join(root, "node_modules"), "dir");

  const status = JSON.parse(execFileSync(process.execPath, ["scripts/template-status.mjs", "--json"], {
    cwd: root,
    encoding: "utf8",
  }));
  assert.equal(status.instance.kind, "tracked");
  assert.equal(status.instance.version, "1.0.0");
  assert.equal(status.instance.behind, true);
  assert.deepEqual(status.upgrade, {
    from: "1.0.0",
    to: "1.1.0",
    path: "template/upgrades/1.0.0-to-1.1.0.yml",
  });

  const target = spawnSync(
    process.execPath,
    ["scripts/template-status.mjs", "--check", "--to", "1.1.0"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(target.status, 1);
  assert.match(target.stderr, /3 template capability check\(s\) failed/);
});
