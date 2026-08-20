#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const positionalName = args.find((arg, index) => !arg.startsWith("--") && (index === 0 || !args[index - 1].startsWith("--")));
const nonInteractive = args.includes("--non-interactive");

function inferRepositoryUrl() {
  try {
    const remote = execFileSync("git", ["config", "--get", "remote.origin.url"], { encoding: "utf8" }).trim();
    if (remote.startsWith("git@github.com:")) return `https://github.com/${remote.slice("git@github.com:".length).replace(/\.git$/, "")}`;
    return remote.replace(/\.git$/, "");
  } catch {
    return "https://github.com/your-org/your-repository";
  }
}

function slug(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapePlaceholderValue(value) {
  if (value.includes("\n") || value.includes("\r")) throw new Error("Values must stay on one line.");
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

const prompts = [
  ["name", positionalName ?? option("name"), "Application name", "my-databricks-app"],
  ["description", option("description"), "Description", "Analytics Databricks App"],
  ["warehouse", option("warehouse"), "SQL Warehouse ID", "replace-me"],
  ["catalog", option("catalog"), "Default catalog", "replace_me"],
  ["schema", option("schema"), "Default schema", "app"],
  ["host", option("host"), "Production workspace URL", "https://your-workspace.cloud.databricks.com"],
  ["canUseGroup", option("can-use-group"), "CAN_USE group", "users"],
  ["canManageGroup", option("can-manage-group"), "CAN_MANAGE group", "admins"],
];

const answers = {};
const readline = nonInteractive ? undefined : createInterface({ input: stdin, output: stdout });
try {
  for (const [key, supplied, label, fallback] of prompts) {
    answers[key] = supplied ?? (readline ? (await readline.question(`${label} [${fallback}]: `)).trim() || fallback : fallback);
  }
} finally {
  readline?.close();
}

answers.name = slug(answers.name);
if (!answers.name) throw new Error("Application name must contain at least one letter or number.");
for (const key of ["catalog", "schema"]) {
  if (!/^[A-Za-z0-9_-]+$/.test(answers[key])) throw new Error(`${key} must contain only letters, numbers, '_' or '-'.`);
}

const replacements = {
  __PACKAGE_NAME__: answers.name,
  __APP_NAME__: answers.name,
  __APP_DESCRIPTION__: answers.description,
  __DATABRICKS_WAREHOUSE_ID__: answers.warehouse,
  __DATABRICKS_CATALOG__: answers.catalog,
  __DATABRICKS_SCHEMA__: answers.schema,
  __DATABRICKS_HOST__: answers.host,
  __GIT_REPOSITORY_URL__: option("repository-url") ?? inferRepositoryUrl(),
  __CAN_USE_GROUP__: answers.canUseGroup,
  __CAN_MANAGE_GROUP__: answers.canManageGroup,
  __DATABRICKS_PROD_ROOT_PATH__: `/Workspace/Shared/.bundle/${answers.name}/prod`,
};

const files = [
  "package.json",
  "package-lock.json",
  ".env.example",
  "app.yaml",
  "databricks.yml",
  ".github/workflows/deploy.yml",
];
for (const file of files) {
  let content = await readFile(file, "utf8");
  for (const [placeholder, rawValue] of Object.entries(replacements)) {
    content = content.replaceAll(placeholder, escapePlaceholderValue(rawValue));
  }
  await writeFile(file, content);
}

stdout.write(`Initialized ${answers.name}. Review .env.example and databricks.yml before deployment.\n`);
