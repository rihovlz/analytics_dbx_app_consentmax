import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { copyTrackedFiles, linkRepositoryNodeModules } from "../scripts/repository-fixture";

type Plan = {
  phase: string;
  readOnly: boolean;
  command: string | null;
  checkpoint: { present: boolean; authoritative: boolean };
  features: Array<{ slug: string; status: string; missing: string[] }>;
  verification: { status: string };
  integrationReview: Array<{ id: string; stability: string; status: string }>;
  upstream: { needed: Array<{ name: string; status: string }>; missingInstall: { command: string; args: string[] } | null };
};

test("quick app trials can create nested fixtures through shared dependencies", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "orchestrator-linked-deps-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const nested = join(root, "nested");
  await mkdir(nested);
  await linkRepositoryNodeModules(process.cwd(), root);
  await linkRepositoryNodeModules(root, nested);
  assert.equal(await realpath(join(nested, "node_modules")), await realpath(join(process.cwd(), "node_modules")));
});

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "orchestrator-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await copyTrackedFiles(process.cwd(), root, [
    "scripts/app-orchestrate.mjs",
    ".agents/skills/create-analytics-dbx-app/references/orchestration.md",
  ]);
  await linkRepositoryNodeModules(process.cwd(), root);
  const run = (script: string, args: string[] = []) => execFileSync(process.execPath, [`scripts/${script}.mjs`, ...args], {
    cwd: root, encoding: "utf8", env: { ...process.env, PATH: "" },
  });
  // Rebuild the synthetic starting state even when these tests run inside an initialized consumer app.
  const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  await writeFile(join(root, "package.json"), JSON.stringify({ ...packageJson, name: "__PACKAGE_NAME__" }));
  const currentAccess = JSON.parse(await readFile(join(root, "config/data-access.json"), "utf8"));
  const project = currentAccess.project === "__DATABRICKS_CATALOG__" ? "dev-dtm-media-pm" : currentAccess.project;
  await writeFile(join(root, "config/data-access.json"), JSON.stringify({ project: currentAccess.project, sources: [] }));
  await writeFile(join(root, "config/app-spec.yml"), "version: 1\napp:\n  name: __PACKAGE_NAME__\n  type: dashboard\n  audience: À confirmer\n  decision: À confirmer\n  success: À confirmer\ncapabilities: [analytics]\nfeatures: []\n");
  await rm(join(root, ".valiuz-template.yml"), { force: true });
  await rm(join(root, "data/contracts"), { recursive: true, force: true });
  await mkdir(join(root, "data/contracts"), { recursive: true });
  run("app-guide", ["--non-interactive"]);
  run("render-data-access", ["--allow-placeholder"]);
  run("render-data-preparation", ["--allow-placeholder"]);
  const plan = (args: string[] = []) => JSON.parse(run("app-orchestrate", ["--json", ...args])) as Plan;
  const init = () => run("init-app", ["mini-analytics", "--non-interactive", "--data-project", project]);
  const frame = (capabilities = "analytics") => run("app-guide", ["--non-interactive", "--capabilities", capabilities,
    "--audience", "Responsable commercial", "--decision", "Suivre les commandes", "--success", "Afficher le total de démonstration"]);
  const source = () => run("init-data", ["orders", "--non-interactive", "--mode", "direct",
    "--source", `${project}.demo.orders`, "--purpose", "Fixture synthétique sans table distante"]);
  return { root, run, plan, init, frame, source };
}

test("orchestration resumes a generated app without mistaking file presence or notes for passing tests", async (t) => {
  const f = await fixture(t);
  assert.equal(f.plan().phase, "bootstrap");
  f.init();
  assert.equal(f.plan().phase, "framing");
  f.frame();
  assert.equal(f.plan().phase, "data");
  f.source();
  assert.equal(f.plan().phase, "implementation");
  f.run("new-feature", ["orders-total", "--non-interactive", "--source", "orders", "--title", "Commandes",
    "--question", "Combien de commandes ?", "--aggregation", "count", "--demo-value", "42"]);
  await writeFile(join(f.root, "docs/creation-progress.md"), "Ancienne note : tous les tests passent.\n");
  const files = ["config/app-spec.yml", "docs/product-brief.md", "docs/creation-progress.md", "src/features/orders-total/server/queries.ts"];
  const before = await Promise.all(files.map((file) => readFile(join(f.root, file), "utf8")));
  const resumed = f.plan();
  assert.equal(resumed.phase, "verification");
  assert.equal(resumed.verification.status, "not-run");
  assert.deepEqual(resumed.checkpoint, { path: "docs/creation-progress.md", present: true, authoritative: false });
  assert.equal(resumed.features[0].status, "present-unverified");
  assert.deepEqual(f.plan(), resumed);
  assert.deepEqual(await Promise.all(files.map((file) => readFile(join(f.root, file), "utf8"))), before);

  await rm(join(f.root, "src/features/orders-total/server/repository.ts"));
  const broken = spawnSync(process.execPath, ["scripts/app-orchestrate.mjs", "--json"], { cwd: f.root, encoding: "utf8", env: { ...process.env, PATH: "" } });
  assert.equal(broken.status, 1);
  const repair = JSON.parse(broken.stdout) as Plan;
  assert.equal(repair.phase, "repair");
  assert.equal(repair.command, null);
  assert.ok(repair.features[0].missing.includes("src/features/orders-total/server/repository.ts"));
});

test("non-SQL and beta requests route to integration without requiring a KPI or activating resources", async (t) => {
  const f = await fixture(t);
  f.init();
  const before = await readFile(join(f.root, "app.yaml"), "utf8");
  f.frame("genie,agents");
  const plan = f.plan();
  assert.equal(plan.phase, "integration");
  assert.deepEqual(plan.features, []);
  assert.equal(plan.integrationReview.find((item) => item.id === "agents")?.stability, "beta");
  assert.ok(plan.integrationReview.every((item) => item.status === "review-required"));
  assert.equal(plan.readOnly, true);
  assert.equal(plan.upstream.missingInstall, null);
  assert.ok(plan.upstream.needed.every((item) => item.status === "unchecked"));
  assert.equal(await readFile(join(f.root, "app.yaml"), "utf8"), before);
});

test("skill setup proposes only missing skills for the current phase and never runs the installer", async (t) => {
  const f = await fixture(t);
  f.init();
  f.frame("files");
  const plan = f.plan(["--skills-dir", join(f.root, "absent external directory")]);
  assert.deepEqual(plan.upstream.needed.map((item) => item.name).sort(), ["databricks-app-design", "databricks-apps", "databricks-core"]);
  assert.ok(plan.upstream.needed.every((item) => item.status === "missing"));
  assert.equal(plan.upstream.missingInstall?.command, "databricks");
  assert.ok(plan.upstream.missingInstall?.args.includes("--skills-only"));
  assert.ok(!plan.upstream.missingInstall?.args.join(" ").includes("databricks-dabs"));
  assert.equal(plan.readOnly, true);
  // PATH is empty throughout this fixture: no installed CLI or workspace is needed.
  const directory = join(f.root, "external-skills");
  for (const name of ["databricks-apps", "databricks-core"]) await mkdir(join(directory, name), { recursive: true });
  const changed = "---\nname: databricks-apps\ndescription: Local changed guidance\n---\nChanged.\n";
  await writeFile(join(directory, "databricks-apps/SKILL.md"), changed);
  await writeFile(join(directory, "databricks-core/SKILL.md"), "invalid frontmatter");
  const reviewed = f.plan(["--skills-dir", directory]);
  assert.equal(reviewed.upstream.needed.find((item) => item.name === "databricks-apps")?.status, "changed");
  assert.equal(reviewed.upstream.needed.find((item) => item.name === "databricks-core")?.status, "invalid");
  assert.equal(reviewed.upstream.missingInstall?.args.at(-1), "databricks-app-design");
  assert.equal(await readFile(join(directory, "databricks-apps/SKILL.md"), "utf8"), changed);
});

test("an invalid specification reports repair instead of proposing initialization", async (t) => {
  const f = await fixture(t);
  f.init();
  await writeFile(join(f.root, "config/app-spec.yml"), "version: invalid\n");
  const output = spawnSync(process.execPath, ["scripts/app-orchestrate.mjs", "--json"], { cwd: f.root, encoding: "utf8", env: { ...process.env, PATH: "" } });
  assert.equal(output.status, 1);
  assert.equal((JSON.parse(output.stdout) as Plan).phase, "repair");
});
