import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

const files = [
  "package.json",
  "package-lock.json",
  ".env.example",
  "app.yaml",
  "databricks.yml",
  "config/data-access.json",
  "config/data-projects.json",
  "resources/data-access.generated.yml",
  "scripts/data-access.mjs",
  "scripts/init-app.mjs",
  ".github/workflows/deploy.yml",
];

test("bootstrap replaces all operational placeholders and keeps JSON valid", async () => {
  const root = await mkdtemp(join(tmpdir(), "databricks-app-init-"));
  for (const file of files) {
    const destination = join(root, file);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(file, destination);
  }

  execFileSync(
    process.execPath,
    [
      "scripts/init-app.mjs",
      "sample-app",
      "--non-interactive",
      "--description", "Sample analytics app",
      "--warehouse", "warehouse-123",
      "--data-project", "dev-dtm-media-pm",
      "--schema", "sample_app",
      "--host", "https://dbc.example.cloud.databricks.com",
      "--repository-url", "https://github.com/example/sample-app",
      "--can-use-group", "analysts",
      "--can-manage-group", "app-admins",
    ],
    { cwd: root },
  );

  const operationalFiles = files.filter((file) => !file.startsWith("scripts/"));
  const rendered = await Promise.all(operationalFiles.map((file) => readFile(join(root, file), "utf8")));
  const renderedText = rendered.join("\n");
  assert.doesNotMatch(renderedText, /__[A-Z][A-Z_]+__/);
  assert.doesNotMatch(renderedText, /3070470996474403\.3\.gcp\.databricks\.com/);
  assert.doesNotMatch(renderedText, /ab362e9710498a08/);
  assert.match(renderedText, /sample-app/);
  assert.match(renderedText, /https:\/\/dbc\.example\.cloud\.databricks\.com/);
  assert.match(renderedText, /warehouse-123/);
  assert.match(renderedText, /dev-dtm-media-pm/);
  JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
});

test("bootstrap uses the shared Valiuz workspace and SQL warehouse defaults", async () => {
  const root = await mkdtemp(join(tmpdir(), "databricks-app-defaults-"));
  for (const file of files) {
    const destination = join(root, file);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(file, destination);
  }

  execFileSync(
    process.execPath,
    [
      "scripts/init-app.mjs",
      "sample-app",
      "--non-interactive",
      "--schema", "sample_app",
    ],
    { cwd: root },
  );

  const environment = await readFile(join(root, ".env.example"), "utf8");
  const bundle = await readFile(join(root, "databricks.yml"), "utf8");
  const dataResources = await readFile(join(root, "resources/data-access.generated.yml"), "utf8");
  const renderedText = `${environment}\n${bundle}\n${dataResources}`;
  assert.match(renderedText, /https:\/\/3070470996474403\.3\.gcp\.databricks\.com/);
  assert.match(renderedText, /ab362e9710498a08/);
  assert.match(environment, /DATABRICKS_CONFIG_PROFILE=valiuz-analytics-dev/);
  assert.match(environment, /DATABRICKS_CATALOG=dev-dtm-operating/);
  assert.match(dataResources, /permission: CAN_USE/);
});

test("bootstrap rejects a data project outside the Valiuz allowlist", async () => {
  const root = await mkdtemp(join(tmpdir(), "databricks-app-invalid-project-"));
  for (const file of files) {
    const destination = join(root, file);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(file, destination);
  }

  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        [
          "scripts/init-app.mjs",
          "sample-app",
          "--non-interactive",
          "--data-project", "unmanaged-project",
          "--schema", "sample_app",
        ],
        { cwd: root, stdio: "pipe" },
      ),
    /Command failed/,
  );
});
