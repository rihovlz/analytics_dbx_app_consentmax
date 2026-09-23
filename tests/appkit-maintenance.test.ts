import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "yaml";

test("AppKit and UI versions match the reviewed record and committed lockfile", async () => {
  const record = JSON.parse(await readFile("config/appkit-compatibility.json", "utf8"));
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
  assert.equal(record.packages["@databricks/appkit"], record.packages["@databricks/appkit-ui"]);
  for (const [name, version] of Object.entries(record.packages)) {
    assert.equal(pkg.dependencies[name], version);
    assert.equal(lock.packages[`node_modules/${name}`].version, version);
  }
  assert.match(record.skills.reviewedRevision, /^[a-f0-9]{40}$/);
  assert.ok(record.exceptions.every((item: { reason?: string; removeWhen?: string }) => item.reason && item.removeWhen));
});

test("weekly upstream review has read-only permissions and no auto-merge", async () => {
  const workflow = parse(await readFile(".github/workflows/upstream-check.yml", "utf8"));
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.equal(workflow.on.schedule.length, 1);
  const dependencies = parse(await readFile(".github/dependabot.yml", "utf8"));
  assert.equal(dependencies.updates[0].schedule.interval, "weekly");
  assert.deepEqual(dependencies.updates[0].groups.appkit.patterns, ["@databricks/appkit", "@databricks/appkit-ui"]);
});
