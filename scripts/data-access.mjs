import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import dataProjects from "../config/data-projects.json" with { type: "json" };

const PROJECT_PLACEHOLDER = "__DATABRICKS_CATALOG__";
const identifierPattern = /^[A-Za-z0-9_-]+$/;
const sourceNamePattern = /^[a-z0-9][a-z0-9-]*$/;

function yamlString(value) {
  return JSON.stringify(value);
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function assertKnownKeys(value, allowed, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new Error(`${label} contains unsupported field '${unknown[0]}'.`);
  }
}

function readJson(text, path) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Unable to parse ${path} as JSON.`, { cause: error });
  }
}

function validateFullName(fullName, project) {
  const parts = fullName.split(".");
  if (parts.length !== 3 || parts.some((part) => !identifierPattern.test(part))) {
    throw new Error(`Source '${fullName}' must use the project.schema.object format.`);
  }
  if (parts[0] !== project) {
    throw new Error(`Source '${fullName}' must belong to data project '${project}'.`);
  }
}

export function validateDataAccessManifest(value, { allowPlaceholder = false, requireSources = false } = {}) {
  assertObject(value, "Data access manifest");
  const project = value.project;
  if (typeof project !== "string") throw new Error("Data access project must be a string.");
  const projectAllowed = dataProjects.allowed.includes(project);
  if (!projectAllowed && !(allowPlaceholder && project === PROJECT_PLACEHOLDER)) {
    throw new Error(`Data project must be one of: ${dataProjects.allowed.join(", ")}.`);
  }
  if (!Array.isArray(value.sources)) throw new Error("Data access sources must be an array.");
  if (requireSources && value.sources.length === 0) {
    throw new Error("Register at least one table or view in config/data-access.json before deployment.");
  }
  if (value.sources.length > 50) throw new Error("Data access is limited to 50 declared sources.");

  const names = new Set();
  const fullNames = new Set();
  const sources = value.sources.map((source, index) => {
    assertObject(source, `Source ${index + 1}`);
    const { name, fullName, purpose } = source;
    if (typeof name !== "string" || !sourceNamePattern.test(name)) {
      throw new Error(`Source ${index + 1} name must use lowercase letters, numbers and hyphens.`);
    }
    if (names.has(name)) throw new Error(`Source name '${name}' is duplicated.`);
    names.add(name);
    if (typeof fullName !== "string") throw new Error(`Source '${name}' fullName must be a string.`);
    const sourceProject = source.project ?? project;
    if (source.project !== undefined && (typeof source.project !== "string" || !dataProjects.allowed.includes(source.project))) {
      throw new Error(`Source '${name}' project must be an approved data project.`);
    }
    validateFullName(fullName, sourceProject);
    if (fullNames.has(fullName)) throw new Error(`Source '${fullName}' is duplicated.`);
    fullNames.add(fullName);
    if (typeof purpose !== "string" || purpose.trim().length < 3 || purpose.length > 200) {
      throw new Error(`Source '${name}' purpose must contain between 3 and 200 characters.`);
    }
    return { name, fullName, purpose: purpose.trim(), ...(source.project !== undefined ? { project: source.project } : {}) };
  });

  let personalState;
  if (value.personalState !== undefined) {
    assertObject(value.personalState, "Personal state");
    assertKnownKeys(value.personalState, ["analyses", "preferences"], "Personal state");
    personalState = {};
    for (const [kind, table] of [["analyses", "saved_analyses_v1"], ["preferences", "user_preferences_v1"]]) {
      const fullName = value.personalState[kind];
      if (typeof fullName !== "string") throw new Error(`Missing personal state table: ${kind}.`);
      validateFullName(fullName, project);
      if (fullName.split(".")[2] !== table || fullNames.has(fullName)) {
        throw new Error(`Personal state ${kind} must use a dedicated ${table} table.`);
      }
      personalState[kind] = fullName;
    }
    if (personalState.analyses.split(".")[1] !== personalState.preferences.split(".")[1]) {
      throw new Error("Personal state tables must use one dedicated schema.");
    }
  }
  return { project, sources, ...(personalState ? { personalState } : {}) };
}

export async function loadDataAccessManifest(root, options) {
  const manifestPath = join(root, "config/data-access.json");
  let content;
  try {
    content = await readFile(manifestPath, "utf8");
  } catch (error) {
    throw new Error(`Unable to read ${manifestPath}.`, { cause: error });
  }
  const parsed = readJson(content, manifestPath);
  return validateDataAccessManifest(parsed, options);
}

export function renderDataAccessBundle(manifest) {
  const lines = [
    "# Generated by npm run data:access:render. Do not edit directly.",
    "resources:",
    "  apps:",
    "    app:",
    "      name: ${var.app_name}",
    "      description: ${var.app_description}",
    "      compute_size: MEDIUM",
    "      permissions:",
    "        - group_name: ${var.can_manage_group}",
    "          level: CAN_MANAGE",
    "        - group_name: ${var.can_use_group}",
    "          level: CAN_USE",
    "      resources:",
    "        - name: sql-warehouse",
    "          sql_warehouse:",
    "            id: ${var.sql_warehouse_id}",
    "            permission: CAN_USE",
  ];

  for (const source of manifest.sources) {
    lines.push(
      `        - name: ${yamlString(`data-${source.name}`)}`,
      "          uc_securable:",
      `            securable_full_name: ${yamlString(source.fullName)}`,
      "            securable_type: TABLE",
      "            permission: SELECT",
    );
  }
  for (const [kind, fullName] of Object.entries(manifest.personalState ?? {})) {
    // An Apps MODIFY binding also grants SELECT; do not bind the same table twice.
    lines.push(
      `        - name: ${yamlString(`user-state-${kind}`)}`,
      "          uc_securable:",
      `            securable_full_name: ${yamlString(fullName)}`,
      "            securable_type: TABLE",
      "            permission: MODIFY",
    );
  }
  return `${lines.join("\n")}\n`;
}

async function validateProjectReference(root, file, pattern, project) {
  let content;
  try {
    content = await readFile(join(root, file), "utf8");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return;
    throw error;
  }
  const match = content.match(pattern);
  if (!match) throw new Error(`Unable to locate the data project in ${file}.`);
  if (match[1] !== project) {
    throw new Error(`${file} data project '${match[1]}' must match '${project}' from config/data-access.json.`);
  }
}

export async function renderDataAccess({ root, check = false, allowPlaceholder = false }) {
  const manifest = await loadDataAccessManifest(root, { allowPlaceholder });
  await validateProjectReference(
    root,
    "app.yaml",
    /name:\s*DATABRICKS_CATALOG\s*\n\s*value:\s*"?([^"\s]+)"?/,
    manifest.project,
  );
  await validateProjectReference(
    root,
    ".env.example",
    /^DATABRICKS_CATALOG=([^\s]+)$/m,
    manifest.project,
  );
  const metadataPath = join(root, "config/appkit-resources.generated.json");
  const metadata = JSON.stringify({
    schemaVersion: 1,
    warehouse: { binding: "sql-warehouse", environmentVariable: "DATABRICKS_SQL_WAREHOUSE_ID", appkitEnvironmentVariable: "DATABRICKS_WAREHOUSE_ID", permission: "CAN_USE" },
    project: manifest.project,
    sources: manifest.sources.map((source) => ({ fullName: source.fullName, permission: "SELECT" })),
    personalState: Object.entries(manifest.personalState ?? {}).map(([kind, fullName]) => ({ kind, fullName, permission: "MODIFY" })),
  }, null, 2) + "\n";
  if (check) {
    const existing = await readFile(metadataPath, "utf8").catch(() => "");
    if (existing !== metadata) throw new Error("AppKit resource metadata is stale. Run npm run data:access:render.");
  } else await writeFile(metadataPath, metadata, "utf8");
  const outputPath = join(root, "resources/data-access.generated.yml");
  const rendered = renderDataAccessBundle(manifest);
  if (check) {
    let existing;
    try {
      existing = await readFile(outputPath, "utf8");
    } catch (error) {
      throw new Error(`Missing generated bundle file ${outputPath}.`, { cause: error });
    }
    if (existing !== rendered) {
      throw new Error("Data access bundle is stale. Run npm run data:access:render and commit the result.");
    }
    return manifest;
  }
  await writeFile(outputPath, rendered, "utf8");
  return manifest;
}

export { PROJECT_PLACEHOLDER };
