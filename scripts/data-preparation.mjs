import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { parse } from "yaml";

import { loadDataAccessManifest } from "./data-access.mjs";

const namePattern = /^[a-z0-9][a-z0-9-]*$/;
const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const qualifiedIdentifierPattern = /^[A-Za-z0-9_-]+$/;
const modes = ["direct", "notebook", "pipeline"];
const refreshes = ["manual", "hourly", "daily"];

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
}

function text(value, label, { min = 2, max = 200 } = {}) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) {
    throw new Error(`${label} must contain between ${min} and ${max} characters.`);
  }
  return value.trim();
}

function parseFullName(value, project, label) {
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const parts = value.split(".");
  if (parts.length !== 3 || parts.some((part) => !qualifiedIdentifierPattern.test(part))) {
    throw new Error(`${label} must use the project.schema.object format.`);
  }
  if (parts[0] !== project) throw new Error(`${label} must belong to data project '${project}'.`);
  return { fullName: value, project: parts[0], schema: parts[1], object: parts[2] };
}

export function validateDataContract(value, filename, accessManifest) {
  assertObject(value, `Data contract '${filename}'`);
  if (value.version !== 1) throw new Error(`Data contract '${filename}' version must be 1.`);
  const name = value.name;
  if (typeof name !== "string" || !namePattern.test(name)) {
    throw new Error(`Data contract '${filename}' name must use lowercase letters, numbers and hyphens.`);
  }
  if (`${name}.yml` !== filename) throw new Error(`Data contract '${filename}' must be named '${name}.yml'.`);
  if (!modes.includes(value.mode)) throw new Error(`Data contract '${name}' mode must be one of: ${modes.join(", ")}.`);
  const source = parseFullName(value.source, accessManifest.project, `Data contract '${name}' source`);
  const output = parseFullName(value.output, accessManifest.project, `Data contract '${name}' output`);
  if (value.mode === "direct" && source.fullName !== output.fullName) {
    throw new Error(`Direct data contract '${name}' output must equal its source.`);
  }
  if (value.mode !== "direct" && source.fullName === output.fullName) {
    throw new Error(`Prepared data contract '${name}' output must differ from its source.`);
  }
  if (!Array.isArray(value.columns)) throw new Error(`Data contract '${name}' columns must be an array.`);
  const columns = value.columns.map((column) => {
    if (typeof column !== "string" || !identifierPattern.test(column)) {
      throw new Error(`Data contract '${name}' columns must be simple identifiers.`);
    }
    return column;
  });
  if (value.mode !== "direct" && columns.length === 0) {
    throw new Error(`Prepared data contract '${name}' requires at least one selected column.`);
  }
  if (new Set(columns).size !== columns.length) throw new Error(`Data contract '${name}' columns are duplicated.`);
  if (!Array.isArray(value.keys)) throw new Error(`Data contract '${name}' keys must be an array.`);
  const keys = value.keys.map((key) => {
    if (typeof key !== "string" || !identifierPattern.test(key)) {
      throw new Error(`Data contract '${name}' keys must be simple identifiers.`);
    }
    return key;
  });
  if (!keys.every((key) => columns.includes(key)) && value.mode !== "direct") {
    throw new Error(`Data contract '${name}' keys must be included in columns.`);
  }
  if (!refreshes.includes(value.refresh)) {
    throw new Error(`Data contract '${name}' refresh must be one of: ${refreshes.join(", ")}.`);
  }
  const freshnessHours = Number(value.freshnessHours);
  if (!Number.isInteger(freshnessHours) || freshnessHours < 1 || freshnessHours > 720) {
    throw new Error(`Data contract '${name}' freshnessHours must be between 1 and 720.`);
  }
  const appSource = accessManifest.sources.find((candidate) => candidate.name === value.appSource);
  if (!appSource || appSource.fullName !== output.fullName) {
    throw new Error(`Data contract '${name}' output must match app source '${value.appSource}'.`);
  }
  return {
    version: 1,
    name,
    mode: value.mode,
    appSource: value.appSource,
    source,
    output,
    columns,
    owner: text(value.owner, `Data contract '${name}' owner`, { max: 100 }),
    purpose: text(value.purpose, `Data contract '${name}' purpose`),
    grain: text(value.grain, `Data contract '${name}' grain`),
    keys,
    refresh: value.refresh,
    freshnessHours,
  };
}

export async function loadDataContracts(root, { allowPlaceholder = false } = {}) {
  const accessManifest = await loadDataAccessManifest(root, { allowPlaceholder });
  const directory = join(root, "data/contracts");
  const files = (await readdir(directory)).filter((file) => file.endsWith(".yml")).sort();
  if (files.length > 10) throw new Error("Data preparation is limited to 10 contracts per internal app.");
  const contracts = [];
  for (const file of files) {
    let value;
    try {
      value = parse(await readFile(join(directory, file), "utf8"));
    } catch (error) {
      throw new Error(`Unable to read data contract '${file}'.`, { cause: error });
    }
    contracts.push(validateDataContract(value, file, accessManifest));
  }
  return { project: accessManifest.project, contracts };
}

function yamlString(value) {
  return JSON.stringify(value);
}

function resourceKey(name) {
  return `prepare_${name.replaceAll("-", "_")}`;
}

function scheduleLines(contract) {
  if (contract.refresh === "manual") return [];
  const quartz = contract.refresh === "hourly" ? "0 0 * * * ?" : "0 0 6 * * ?";
  return [
    "      schedule:",
    `        quartz_cron_expression: ${yamlString(quartz)}`,
    "        timezone_id: Europe/Paris",
    "        pause_status: ${var.schedule_pause_status}",
  ];
}

export function renderDataPreparationBundle(contracts) {
  const prepared = contracts.filter((contract) => contract.mode !== "direct");
  if (prepared.length === 0) {
    return "# Generated by npm run data:prepare:render. Do not edit directly.\nresources: {}\n";
  }
  const lines = ["# Generated by npm run data:prepare:render. Do not edit directly.", "resources:"];
  const pipelines = prepared.filter((contract) => contract.mode === "pipeline");
  if (pipelines.length > 0) {
    lines.push("  pipelines:");
    for (const contract of pipelines) {
      const key = resourceKey(contract.name);
      lines.push(
        `    ${key}:`,
        `      name: ${yamlString(`\${bundle.name}-${contract.name}`)}`,
        `      catalog: ${yamlString(contract.output.project)}`,
        `      target: ${yamlString(contract.output.schema)}`,
        "      serverless: true",
        "      libraries:",
        "        - file:",
        `            path: ${yamlString(`./pipelines/${contract.name}.sql`)}`,
      );
    }
  }
  lines.push("  jobs:");
  for (const contract of prepared) {
    const key = resourceKey(contract.name);
    lines.push(`    ${key}:`, `      name: ${yamlString(`\${bundle.name}-${contract.name}`)}`, "      tasks:", "        - task_key: prepare");
    if (contract.mode === "notebook") {
      lines.push(
        "          notebook_task:",
        `            notebook_path: ${yamlString(`./notebooks/${contract.name}.sql`)}`,
        "            warehouse_id: ${var.sql_warehouse_id}",
      );
    } else {
      lines.push(
        "          pipeline_task:",
        `            pipeline_id: \${resources.pipelines.${key}.id}`,
        "            full_refresh: false",
      );
    }
    lines.push(...scheduleLines(contract));
  }
  return `${lines.join("\n")}\n`;
}

export async function renderDataPreparation({ root, check = false, allowPlaceholder = false }) {
  const { contracts } = await loadDataContracts(root, { allowPlaceholder });
  for (const contract of contracts.filter((candidate) => candidate.mode !== "direct")) {
    const codePath = join(root, "data", contract.mode === "notebook" ? "notebooks" : "pipelines", `${contract.name}.sql`);
    try {
      await readFile(codePath, "utf8");
    } catch (error) {
      throw new Error(`Missing preparation code ${codePath}.`, { cause: error });
    }
  }
  const path = join(root, "data/resources.generated.yml");
  const rendered = renderDataPreparationBundle(contracts);
  if (check) {
    const current = await readFile(path, "utf8");
    if (current !== rendered) throw new Error("Data preparation bundle is stale. Run npm run data:prepare:render.");
  } else {
    await writeFile(path, rendered, "utf8");
  }
  return contracts;
}

export { modes, namePattern, identifierPattern, refreshes, resourceKey };
