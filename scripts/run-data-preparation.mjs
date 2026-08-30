#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { stdout } from "node:process";

import { loadDataContracts, renderDataPreparation, resourceKey } from "./data-preparation.mjs";

function parseOptions(argv) {
  const options = { dataset: undefined, target: "dev", profile: undefined, confirm: false, activateSchedule: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--") && !options.dataset) {
      options.dataset = value;
      continue;
    }
    if (value === "--confirm" || value === "--activate-schedule") {
      options[value === "--confirm" ? "confirm" : "activateSchedule"] = true;
      continue;
    }
    if (!["--dataset", "--target", "--profile"].includes(value)) throw new Error(`Unknown option: ${value}`);
    const supplied = argv[index + 1];
    if (!supplied || supplied.startsWith("--")) throw new Error(`${value} requires a value.`);
    options[value.slice(2)] = supplied;
    index += 1;
  }
  return options;
}

function runDatabricks(args, cwd = process.cwd()) {
  const result = spawnSync("databricks", args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function workspaceHost(target, profile) {
  if (target === "prod") {
    const match = readFileSync("data/databricks.yml", "utf8").match(/host:\s*(https:\/\/\S+)/);
    if (!match) throw new Error("Unable to determine the production workspace host.");
    return match[1];
  }
  const result = spawnSync("databricks", ["auth", "describe", ...(profile ? ["--profile", profile] : [])], {
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) throw new Error("Unable to determine the Databricks workspace.");
  const match = result.stdout.match(/^\s*(?:✓\s*)?host:\s+(https:\/\/\S+)/im);
  if (!match) throw new Error("Databricks authentication did not report a workspace host.");
  return match[1];
}

const options = parseOptions(process.argv.slice(2));
if (!options.dataset) throw new Error("Provide the data contract to prepare.");
if (!["dev", "prod"].includes(options.target)) throw new Error("Data preparation target must be dev or prod.");
await renderDataPreparation({ root: process.cwd(), check: true });
const { project, contracts } = await loadDataContracts(process.cwd());
const contract = contracts.find((candidate) => candidate.name === options.dataset);
if (!contract) throw new Error(`Unknown data contract '${options.dataset}'.`);
if (contract.mode === "direct") throw new Error(`Data contract '${contract.name}' is direct and has nothing to run.`);
const host = workspaceHost(options.target, options.profile);
const schedulePauseStatus = options.activateSchedule ? "UNPAUSED" : "PAUSED";
stdout.write(
  [
    "Remote data preparation:",
    `Workspace: ${host}`,
    `Profile: ${options.profile ?? "environment authentication"}`,
    `Target: ${options.target}`,
    `Dataset: ${contract.name} (${contract.mode})`,
    `Source: ${contract.source.fullName}`,
    `Output: ${contract.output.fullName}`,
    `Project: ${project}`,
    `Schedule: ${contract.refresh} (${schedulePauseStatus})`,
  ].join("\n") + "\n",
);
if (!options.confirm) {
  stdout.write("No remote change made. Review the SQL, then rerun with --confirm.\n");
  process.exit(2);
}
const profileArgs = options.profile ? ["--profile", options.profile] : [];
const variableArgs = ["--var", `schedule_pause_status=${schedulePauseStatus}`];
const common = ["--target", options.target, ...profileArgs, ...variableArgs];
runDatabricks(["bundle", "validate", ...common], "data");
runDatabricks(["bundle", "deploy", ...common], "data");
runDatabricks(["bundle", "run", resourceKey(contract.name), ...common], "data");
stdout.write(`Prepared '${contract.output.fullName}'. The app can now validate and bind this output.\n`);
