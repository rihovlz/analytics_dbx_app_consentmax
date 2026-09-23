#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { copyTrackedFiles, findRepositoryRoot } from "./repository-fixture";

const execFileAsync = promisify(execFile);
const fixtureAppName = "ci-journey-app";
const fixtureSourceName = "journey-source";
const fixtureFeatureSlug = "journey-kpi";

function asRecord(value: unknown, label: string): Record<string, unknown> {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object.`);
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string): unknown[] {
  assert.ok(Array.isArray(value), `${label} must be an array.`);
  return value;
}

export function assertTemplateJourneyDoctor(value: unknown): void {
  const results = asArray(value, "app:doctor output").map((item, index) =>
    asRecord(item, `app:doctor output[${index}]`),
  );
  const failures = results.filter((item) => item.status === "fail");
  assert.deepEqual(failures, [], "app:doctor must not report a failing check after the journey.");

  for (const name of ["Initialisation", "Version du template", "Cadrage", "Accès aux données", "Features et sources"]) {
    const item = results.find((candidate) => candidate.name === name);
    assert.equal(item?.status, "pass", `app:doctor must pass '${name}'.`);
  }

  const recommendation = results.find((item) => item.name === "Étape recommandée");
  assert.equal(recommendation?.status, "pass");
  assert.equal(recommendation?.next, "npm run check");
}

function fixtureEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    CI: "true",
    npm_config_audit: "false",
    npm_config_fund: "false",
  };
  for (const name of [
    "DATABRICKS_ACCOUNT_ID",
    "DATABRICKS_APP_NAME",
    "DATABRICKS_CLIENT_ID",
    "DATABRICKS_CLIENT_SECRET",
    "DATABRICKS_CONFIG_PROFILE",
    "DATABRICKS_HOST",
    "DATABRICKS_TOKEN",
    "GIT_INDEX_FILE",
  ]) {
    delete environment[name];
  }
  return environment;
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  process.stdout.write(`\n> ${command} ${args.join(" ")}\n`);
  const child = spawn(command, args, { cwd, env: environment, stdio: "inherit" });
  const status = await new Promise<number>((accept, reject) => {
    child.once("error", reject);
    child.once("close", (code) => accept(code ?? 1));
  });
  if (status !== 0) throw new Error(`Command failed with status ${status}: ${command} ${args.join(" ")}`);
}

async function initializeCleanGitCheckout(fixtureRoot: string, environment: NodeJS.ProcessEnv): Promise<void> {
  await runCommand("git", ["init", "--quiet", "--initial-branch=main"], fixtureRoot, environment);
  await runCommand("git", ["add", "--all"], fixtureRoot, environment);
  await runCommand(
    "git",
    [
      "-c", "user.name=Template Journey CI",
      "-c", "user.email=template-journey@example.invalid",
      "commit", "--quiet", "--message", "Template fixture",
    ],
    fixtureRoot,
    environment,
  );
}

async function initializeApp(fixtureRoot: string, environment: NodeJS.ProcessEnv): Promise<void> {
  await runCommand(
    process.execPath,
    [
      "scripts/init-app.mjs",
      fixtureAppName,
      "--non-interactive",
      "--description", "CI consumer journey",
      "--support-name", "Analytics",
      "--support-slack-url", "https://valiuz.slack.com",
      "--host", "https://dbc.example.cloud.databricks.com",
      "--data-project", "dev-dtm-operating",
      "--schema", "ci_journey",
      "--repository-url", "https://github.com/valiuz/ci_journey_app",
      "--can-use-group", "analytics-users",
      "--can-manage-group", "analytics-admins",
    ],
    fixtureRoot,
    environment,
  );
  await runCommand(
    process.execPath,
    [
      "scripts/app-guide.mjs",
      "--non-interactive",
      "--type", "cockpit",
      "--audience", "Responsable analytics",
      "--decision", "Suivre la qualité du parcours template",
      "--success", "Le parcours local passe en CI",
    ],
    fixtureRoot,
    environment,
  );
  await runCommand(
    process.execPath,
    [
      "scripts/init-data.mjs",
      fixtureSourceName,
      "--non-interactive",
      "--mode", "direct",
      "--source", "dev-dtm-operating.analytics.journey_source",
      "--owner", "Analytics",
      "--purpose", "Valider le parcours consommateur",
      "--grain", "Une ligne synthétique",
      "--refresh", "manual",
    ],
    fixtureRoot,
    environment,
  );
  await runCommand(
    process.execPath,
    [
      "scripts/new-feature.mjs",
      fixtureFeatureSlug,
      "--non-interactive",
      "--title", "Qualité du parcours",
      "--question", "Le parcours généré est-il valide ?",
      "--source", fixtureSourceName,
      "--aggregation", "sum",
      "--column", "amount",
      "--label", "Valeur de contrôle",
      "--unit", "points",
      "--demo-value", "42",
      "--acceptance", "Le contrôle local complet réussit.",
    ],
    fixtureRoot,
    environment,
  );
  await runCommand(process.execPath, ["scripts/init-user-state.mjs", "--schema", "ci_user_state"], fixtureRoot, environment);
}

async function inspectGeneratedApp(fixtureRoot: string, environment: NodeJS.ProcessEnv): Promise<void> {
  const templateStatus = await execFileAsync(process.execPath, ["scripts/template-status.mjs", "--json"], {
    cwd: fixtureRoot,
    env: environment,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  const template = asRecord(JSON.parse(templateStatus.stdout), "template:status output");
  const templateContract = asRecord(template.template, "template:status template");
  const instance = asRecord(template.instance, "template:status instance");
  assert.equal(instance.kind, "tracked");
  assert.equal(instance.version, templateContract.currentVersion);
  assert.equal(instance.behind, false);
  assert.deepEqual(
    asArray(template.capabilities, "template:status capabilities")
      .map((item, index) => asRecord(item, `template:status capabilities[${index}]`))
      .filter((item) => item.ok !== true),
    [],
  );

  const doctor = await execFileAsync(process.execPath, ["scripts/app-doctor.mjs", "--json"], {
    cwd: fixtureRoot,
    env: environment,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  assertTemplateJourneyDoctor(JSON.parse(doctor.stdout));

  const packageJson = asRecord(JSON.parse(await readFile(join(fixtureRoot, "package.json"), "utf8")), "package.json");
  assert.equal(packageJson.name, fixtureAppName);
  assert.match(await readFile(join(fixtureRoot, "config/app-spec.yml"), "utf8"), /slug: journey-kpi/);
  assert.match(await readFile(join(fixtureRoot, "config/data-access.json"), "utf8"), /"name": "journey-source"/);
  assert.match(
    await readFile(join(fixtureRoot, "src/features/journey-kpi/server/queries.ts"), "utf8"),
    /SUM\(`amount`\)/,
  );
  assert.match(
    await readFile(join(fixtureRoot, ".valiuz-template.yml"), "utf8"),
    new RegExp(`version: ${String(templateContract.currentVersion).replaceAll(".", "\\.")}`),
  );
  process.stdout.write("template:status, app:doctor and the generated vertical slice satisfy the journey contract.\n");
}

export async function validateTemplateJourney(): Promise<void> {
  assert.equal(
    Number(process.versions.node.split(".")[0]),
    22,
    `The template journey requires Node.js 22; received ${process.versions.node}.`,
  );
  const sourceRoot = await findRepositoryRoot();
  const fixtureRoot = await mkdtemp(join(tmpdir(), "analytics-template-journey-"));
  const environment = fixtureEnvironment();

  try {
    process.stdout.write(`Creating a clean template checkout in ${fixtureRoot}.\n`);
    await copyTrackedFiles(sourceRoot, fixtureRoot, ["config/genie-spaces.json"]);
    await initializeCleanGitCheckout(fixtureRoot, environment);
    await runCommand("npm", ["ci", "--no-audit", "--no-fund"], fixtureRoot, environment);
    await initializeApp(fixtureRoot, environment);
    await inspectGeneratedApp(fixtureRoot, environment);
    await runCommand("npm", ["run", "check"], fixtureRoot, environment);
    process.stdout.write("\nThe clean template consumer journey passed.\n");
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await validateTemplateJourney();
