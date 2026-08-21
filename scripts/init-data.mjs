#!/usr/bin/env node

import { access, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { stringify } from "yaml";

import { loadDataAccessManifest, renderDataAccess, validateDataAccessManifest } from "./data-access.mjs";
import {
  identifierPattern,
  modes,
  namePattern,
  refreshes,
  renderDataPreparation,
  validateDataContract,
} from "./data-preparation.mjs";

function parseOptions(argv) {
  const options = { nonInteractive: false, name: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--") && !options.name) {
      options.name = value;
      continue;
    }
    if (value === "--non-interactive") {
      options.nonInteractive = true;
      continue;
    }
    if (!["--mode", "--source", "--output", "--columns", "--owner", "--purpose", "--grain", "--keys", "--refresh", "--freshness-hours", "--app-source"].includes(value)) {
      throw new Error(`Unknown option: ${value}`);
    }
    const supplied = argv[index + 1];
    if (!supplied || supplied.startsWith("--")) throw new Error(`${value} requires a value.`);
    options[value.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = supplied;
    index += 1;
  }
  return options;
}

function qualifiedParts(value, project, label) {
  const parts = value?.split(".") ?? [];
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) {
    throw new Error(`${label} must use the project.schema.object format.`);
  }
  if (parts[0] !== project) throw new Error(`${label} must belong to data project '${project}'.`);
  return parts;
}

function list(value) {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function quotedFullName(fullName) {
  return fullName.split(".").map((part) => `\`${part}\``).join(".");
}

function renderPreparationCode(contract) {
  const selected = contract.columns.map((column) => `  \`${column}\``).join(",\n");
  if (contract.mode === "notebook") {
    return `-- Databricks notebook source\n-- Starter generated from data/contracts/${contract.name}.yml. Review before the first run.\nCREATE OR REPLACE TABLE ${quotedFullName(contract.output)} AS\nSELECT\n${selected}\nFROM ${quotedFullName(contract.source)};\n`;
  }
  const outputName = contract.output.split(".")[2];
  return `-- Starter generated from data/contracts/${contract.name}.yml. Review before the first run.\nCREATE OR REFRESH MATERIALIZED VIEW \`${outputName}\` AS\nSELECT\n${selected}\nFROM ${quotedFullName(contract.source)};\n`;
}

function renderQualityQueries(contract) {
  const output = quotedFullName(contract.output);
  const keyCheck = contract.keys.length
    ? `\n-- This query must return no row.\nSELECT ${contract.keys.map((key) => `\`${key}\``).join(", ")}, COUNT(*) AS duplicate_count\nFROM ${output}\nGROUP BY ${contract.keys.map((key) => `\`${key}\``).join(", ")}\nHAVING COUNT(*) > 1\nLIMIT 100;\n`
    : "\n-- Add a bounded uniqueness query when the business grain has a stable key.\n";
  return `-- Aggregated checks only; do not commit customer rows or notebook outputs.\nSELECT COUNT(*) AS row_count FROM ${output};\n${keyCheck}`;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const root = process.cwd();
const options = parseOptions(process.argv.slice(2));
if (!options.name || !namePattern.test(options.name)) {
  throw new Error("Provide a data contract name using lowercase letters, numbers and hyphens.");
}
const contractPath = join(root, "data/contracts", `${options.name}.yml`);
if (await exists(contractPath)) throw new Error(`Data contract '${options.name}' already exists.`);
const accessManifest = await loadDataAccessManifest(root, { allowPlaceholder: true });
const prompts = [
  ["mode", "Mode (direct, notebook, pipeline)", "direct"],
  ["source", "Table ou vue source (projet.schema.objet)", undefined],
  ["output", "Table consommée par l’app (vide = source en mode direct)", undefined],
  ["columns", "Colonnes conservées, séparées par des virgules", ""],
  ["owner", "Propriétaire de la donnée", "Analytics"],
  ["purpose", "Finalité pour l’app", `Alimenter ${options.name}`],
  ["grain", "Grain d’une ligne", "À confirmer"],
  ["keys", "Clés attendues, séparées par des virgules", ""],
  ["refresh", "Rafraîchissement (manual, hourly, daily)", "manual"],
  ["freshnessHours", "Fraîcheur maximale en heures", "24"],
  ["appSource", "Nom court utilisé par l’app", options.name],
];
const answers = {};
const readline = options.nonInteractive ? undefined : createInterface({ input: stdin, output: stdout });
try {
  for (const [key, label, fallback] of prompts) {
    answers[key] = options[key] ?? (readline ? (await readline.question(`${label}${fallback !== undefined ? ` [${fallback}]` : ""}: `)).trim() || fallback : fallback);
  }
} finally {
  readline?.close();
}
if (!modes.includes(answers.mode)) throw new Error(`Mode must be one of: ${modes.join(", ")}.`);
if (!answers.source) throw new Error("A source is required.");
qualifiedParts(answers.source, accessManifest.project, "Source");
answers.output = answers.output || (answers.mode === "direct" ? answers.source : undefined);
if (!answers.output) throw new Error("Prepared modes require an output table.");
qualifiedParts(answers.output, accessManifest.project, "Output");
if (!refreshes.includes(answers.refresh)) throw new Error(`Refresh must be one of: ${refreshes.join(", ")}.`);
const columns = list(answers.columns);
if (columns.some((column) => !identifierPattern.test(column))) throw new Error("Columns must be simple identifiers.");
const keys = list(answers.keys);
if (keys.some((key) => !identifierPattern.test(key))) throw new Error("Keys must be simple identifiers.");
let appSource = accessManifest.sources.find((source) => source.fullName === answers.output);
if (!appSource) {
  if (!namePattern.test(answers.appSource)) throw new Error("App source name must use lowercase letters, numbers and hyphens.");
  if (accessManifest.sources.some((source) => source.name === answers.appSource)) {
    throw new Error(`App source name '${answers.appSource}' already refers to another object.`);
  }
  appSource = { name: answers.appSource, fullName: answers.output, purpose: answers.purpose };
}
const nextAccessManifest = validateDataAccessManifest(
  { ...accessManifest, sources: [...accessManifest.sources.filter((source) => source.name !== appSource.name), appSource] },
  { allowPlaceholder: true },
);
const rawContract = {
  version: 1,
  name: options.name,
  mode: answers.mode,
  appSource: appSource.name,
  source: answers.source,
  output: answers.output,
  columns,
  owner: answers.owner,
  purpose: answers.purpose,
  grain: answers.grain,
  keys,
  refresh: answers.refresh,
  freshnessHours: Number(answers.freshnessHours),
};
validateDataContract(rawContract, `${options.name}.yml`, nextAccessManifest);
const codePath = answers.mode === "direct" ? undefined : join(root, "data", answers.mode === "notebook" ? "notebooks" : "pipelines", `${options.name}.sql`);
if (codePath && await exists(codePath)) throw new Error(`Refusing to overwrite ${codePath}.`);
const testPath = answers.mode === "direct" ? undefined : join(root, "data/tests", `${options.name}.sql`);
if (testPath && await exists(testPath)) throw new Error(`Refusing to overwrite ${testPath}.`);
await writeFile(join(root, "config/data-access.json"), `${JSON.stringify(nextAccessManifest, null, 2)}\n`, "utf8");
await writeFile(contractPath, stringify(rawContract, { lineWidth: 120 }), "utf8");
if (codePath) {
  await writeFile(codePath, renderPreparationCode(rawContract), "utf8");
  await writeFile(testPath, renderQualityQueries(rawContract), "utf8");
}
await renderDataAccess({ root, allowPlaceholder: true });
await renderDataPreparation({ root, allowPlaceholder: true });
stdout.write(
  answers.mode === "direct"
    ? `Registered direct source '${appSource.name}'. Next: npm run feature:new -- <slug>.\n`
    : `Created ${answers.mode} starter '${options.name}'. Review its SQL before npm run data:prepare.\n`,
);
