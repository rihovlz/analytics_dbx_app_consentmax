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
      "--catalog", "analytics_dev",
      "--schema", "sample_app",
      "--host", "https://dbc.example.cloud.databricks.com",
      "--repository-url", "https://github.com/example/sample-app",
      "--can-use-group", "analysts",
      "--can-manage-group", "app-admins",
    ],
    { cwd: root },
  );

  const operationalFiles = files.filter((file) => file !== "scripts/init-app.mjs");
  const rendered = await Promise.all(operationalFiles.map((file) => readFile(join(root, file), "utf8")));
  assert.doesNotMatch(rendered.join("\n"), /__[A-Z][A-Z_]+__/);
  assert.match(rendered.join("\n"), /sample-app/);
  JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
});
