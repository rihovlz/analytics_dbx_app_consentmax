#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { copyTrackedFiles, findRepositoryRoot, linkRepositoryNodeModules } from "./repository-fixture";

const execFileAsync = promisify(execFile);
const fixtureAppName = "ci-bundle-app";
const fixtureSourceName = "data-bundle-source";
const fixtureRepositoryUrl = "https://github.com/valiuz/analytics_dbx_app_ci_fixture";

type CommandResult = {
  stdout: string;
  stderr: string;
};

type MockWorkspace = {
  server: Server;
  host: string;
  unhandledRequests: string[];
};

function asRecord(value: unknown, label: string): Record<string, unknown> {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object.`);
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string): unknown[] {
  assert.ok(Array.isArray(value), `${label} must be an array.`);
  return value;
}

export function assertBundleContract(value: unknown, target: "dev" | "prod"): void {
  const output = asRecord(value, "CLI output");
  const bundle = asRecord(output.bundle, "bundle");
  assert.equal(bundle.name, fixtureAppName);
  assert.equal(bundle.target, target);
  assert.equal(bundle.mode, target === "dev" ? "development" : "production");

  const resources = asRecord(output.resources, "resources");
  const apps = asRecord(resources.apps, "resources.apps");
  assert.deepEqual(Object.keys(apps), ["app"], "The rendered bundle must contain exactly one app resource.");
  const app = asRecord(apps.app, "resources.apps.app");
  assert.equal(app.name, fixtureAppName);

  const appResources = asArray(app.resources, "resources.apps.app.resources").map((resource, index) =>
    asRecord(resource, `resources.apps.app.resources[${index}]`),
  );
  assert.deepEqual(
    appResources.map((resource) => resource.name),
    ["sql-warehouse", fixtureSourceName],
    "The app must keep its warehouse and generated Unity Catalog binding.",
  );
  const dataBinding = asRecord(appResources[1].uc_securable, "Unity Catalog binding");
  assert.equal(dataBinding.securable_full_name, "dev-dtm-operating.analytics.bundle_source");
  assert.equal(dataBinding.permission, "SELECT");

  if (target === "dev") {
    assert.equal(app.source_code_path, "/Workspace/Users/ci@example.com/.bundle/ci-bundle-app/dev/files");
    assert.equal(app.git_repository, undefined);
    assert.equal(app.git_source, undefined);
    return;
  }

  const gitRepository = asRecord(app.git_repository, "resources.apps.app.git_repository");
  const gitSource = asRecord(app.git_source, "resources.apps.app.git_source");
  assert.equal(gitRepository.provider, "gitHub");
  assert.equal(gitRepository.url, fixtureRepositoryUrl);
  assert.equal(gitSource.commit, "0000000000000000000000000000000000000000");
}

function assertDataBundleContract(value: unknown, target: "dev" | "prod"): void {
  const output = asRecord(value, "data CLI output");
  const bundle = asRecord(output.bundle, "data bundle");
  assert.equal(bundle.name, `${fixtureAppName}-data`);
  assert.equal(bundle.target, target);

  const resources = asRecord(output.resources, "data resources");
  const jobs = asRecord(resources.jobs, "data resources.jobs");
  assert.deepEqual(Object.keys(jobs), ["prepare_bundle_source"]);
  const job = asRecord(jobs.prepare_bundle_source, "bounded replay job");
  assert.equal(job.max_concurrent_runs, 1);
  const parameters = asArray(job.parameters, "bounded replay job parameters").map((parameter, index) =>
    asRecord(parameter, `bounded replay job parameters[${index}]`),
  );
  assert.deepEqual(
    parameters.map((parameter) => parameter.name),
    ["replay_start_date", "replay_end_date", "deployment_fingerprint"],
  );
  assert.match(String(parameters[2].default), /^[0-9a-f]{64}$/);
  const tasks = asArray(job.tasks, "bounded replay job tasks").map((task, index) =>
    asRecord(task, `bounded replay job tasks[${index}]`),
  );
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].timeout_seconds, 3_600);
  assert.equal(typeof tasks[0].notebook_task, "object");
}

async function runCommand(
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv },
): Promise<CommandResult> {
  try {
    const result = await execFileAsync(command, args, {
      cwd: options.cwd,
      env: options.env,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      timeout: 60_000,
    });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string };
    const details = [failure.stderr, failure.stdout].filter(Boolean).join("\n").trim();
    throw new Error(`Command failed: ${command} ${args.join(" ")}${details ? `\n${details}` : ""}`, {
      cause: error,
    });
  }
}

async function startMockWorkspace(): Promise<MockWorkspace> {
  const unhandledRequests: string[] = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    response.setHeader("content-type", "application/json");

    if (request.method === "GET" && url.pathname === "/.well-known/databricks-config") {
      response.end("{}");
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/2.0/preview/scim/v2/Me") {
      response.end(JSON.stringify({ id: "1", userName: "ci@example.com", displayName: "CI", active: true }));
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/2.0/workspace/get-status") {
      response.end(JSON.stringify({ path: url.searchParams.get("path"), object_type: "DIRECTORY" }));
      return;
    }

    unhandledRequests.push(`${request.method ?? "UNKNOWN"} ${url.pathname}`);
    response.statusCode = 404;
    response.end(JSON.stringify({ error_code: "NOT_FOUND", message: "Unhandled CI mock request" }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object", "Unable to start the local Databricks mock.");
  return { server, host: `http://127.0.0.1:${address.port}`, unhandledRequests };
}

async function closeServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

function isolatedCliEnvironment(configFile: string, host: string): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const name of [
    "DATABRICKS_ACCOUNT_ID",
    "DATABRICKS_CLIENT_ID",
    "DATABRICKS_CLIENT_SECRET",
    "DATABRICKS_CONFIG_PROFILE",
    "DATABRICKS_HOST",
    "DATABRICKS_TOKEN",
  ]) {
    delete environment[name];
  }
  return {
    ...environment,
    DATABRICKS_AUTH_TYPE: "pat",
    DATABRICKS_CONFIG_FILE: configFile,
    DATABRICKS_HOST: host,
    DATABRICKS_TOKEN: "ci-placeholder",
  };
}

async function initializeFixture(fixtureRoot: string, host: string): Promise<void> {
  const initialized = await runCommand(
    process.execPath,
    [
      "scripts/init-app.mjs",
      fixtureAppName,
      "--non-interactive",
      "--description", "CI bundle compatibility fixture",
      "--support-name", "Analytics",
      "--support-slack-url", "https://valiuz.slack.com",
      "--host", host,
      "--data-project", "dev-dtm-operating",
      "--schema", "ci_bundle_app",
      "--repository-url", fixtureRepositoryUrl,
      "--can-use-group", "analytics-users",
      "--can-manage-group", "analytics-admins",
    ],
    { cwd: fixtureRoot },
  );
  process.stdout.write(initialized.stdout);

  const source = await runCommand(
    process.execPath,
    [
      "scripts/init-data.mjs",
      "bundle-source",
      "--non-interactive",
      "--mode", "notebook",
      "--source", "dev-dtm-operating.raw.bundle_source",
      "--output", "dev-dtm-operating.analytics.bundle_source",
      "--columns", "event_date,entity_id,value",
      "--keys", "event_date,entity_id",
      "--purpose", "Validate the generated data binding",
      "--owner", "Analytics",
      "--grain", "One synthetic row per date and entity",
      "--refresh", "daily",
      "--timeout-minutes", "60",
      "--replay-strategy", "bounded-replace",
      "--date-column", "event_date",
      "--default-lookback-days", "7",
      "--max-replay-days", "31",
      "--finalization-lag-days", "1",
      "--required-history-days", "365",
      "--output-retention-days", "365",
      "--source-retention-days", "730",
    ],
    { cwd: fixtureRoot },
  );
  process.stdout.write(source.stdout);
}

export async function validateBundleCliCompatibility(): Promise<void> {
  const sourceRoot = await findRepositoryRoot();
  const fixtureRoot = await mkdtemp(join(tmpdir(), "databricks-bundle-cli-"));
  const mockWorkspace = await startMockWorkspace();

  try {
    await copyTrackedFiles(sourceRoot, fixtureRoot);
    await linkRepositoryNodeModules(sourceRoot, fixtureRoot);
    await initializeFixture(fixtureRoot, mockWorkspace.host);
    const configFile = join(fixtureRoot, ".databrickscfg");
    await writeFile(configFile, "", "utf8");
    const cli = process.env.DATABRICKS_CLI_PATH || "databricks";
    const cliEnvironment = isolatedCliEnvironment(configFile, mockWorkspace.host);
    const version = await runCommand(cli, ["version", "--output", "json"], {
      cwd: fixtureRoot,
      env: cliEnvironment,
    });
    const versionOutput = asRecord(JSON.parse(version.stdout), "Databricks CLI version");
    assert.equal(typeof versionOutput.Version, "string");

    for (const target of ["dev", "prod"] as const) {
      const result = await runCommand(cli, ["bundle", "validate", "--target", target, "--output", "json"], {
        cwd: fixtureRoot,
        env: cliEnvironment,
      });
      if (result.stderr) process.stderr.write(result.stderr);
      assertBundleContract(JSON.parse(result.stdout), target);

      const dataResult = await runCommand(cli, ["bundle", "validate", "--target", target, "--output", "json"], {
        cwd: join(fixtureRoot, "data"),
        env: cliEnvironment,
      });
      if (dataResult.stderr) process.stderr.write(dataResult.stderr);
      assertDataBundleContract(JSON.parse(dataResult.stdout), target);
    }

    assert.deepEqual(mockWorkspace.unhandledRequests, [], "The CLI called an endpoint missing from the local mock.");
    process.stdout.write(`Databricks CLI ${versionOutput.Version} validated the initialized dev and prod bundles.\n`);
  } finally {
    await closeServer(mockWorkspace.server);
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await validateBundleCliCompatibility();
