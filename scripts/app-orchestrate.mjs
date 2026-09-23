#!/usr/bin/env node

import { stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { inspectApp } from "./app-doctor.mjs";
import { loadAppSpec } from "./app-spec.mjs";
import { capabilityPlan } from "./app-capabilities.mjs";
import { planAgentSkills } from "./app-skills.mjs";

const referenceRoot = ".agents/skills/create-analytics-dbx-app/references";
const stages = {
  bootstrap: { reference: "bootstrap.md", skills: [], action: "Initialiser uniquement une nouvelle copie du template." },
  framing: { reference: "product-discovery.md", skills: [], action: "Compléter le besoin et choisir les capacités utiles avec les informations déjà connues." },
  data: { reference: "data-discovery.md", skills: ["databricks-core", "databricks-data-discovery", "databricks-dbsql"], action: "Déclarer la source de la tranche ; une fixture de démo ne prouve aucun accès réel." },
  implementation: { reference: "delivery.md", skills: ["databricks-apps", "databricks-app-design", "databricks-dbsql"], action: "Construire la tranche demandée, puis relire le calcul, les routes et les états UI." },
  integration: { reference: "appkit-capabilities.md", skills: ["databricks-apps", "databricks-app-design"], action: "Examiner le code et les critères de la capacité demandée, puis intégrer ou tester ce qui manque." },
  repair: { reference: "delivery.md", skills: ["databricks-apps"], action: "Corriger le diagnostic dans le périmètre demandé, sans réinitialiser ni écraser une feature existante." },
  verification: { reference: "delivery.md", skills: ["databricks-apps", "databricks-app-design"], action: "Vérifier les critères de la tranche et les éventuelles intégrations restantes avant le handoff." },
};

async function isFile(root, file) {
  try { return (await stat(join(root, file))).isFile(); }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

export async function planCreation(root, options = {}) {
  const diagnostics = await inspectApp(root, options);
  const failure = diagnostics.find((item) => item.status === "fail");
  const recommended = diagnostics.find((item) => item.name === "Étape recommandée")?.next;
  const phaseByCommand = {
    "npm run init-app -- <nom>": "bootstrap",
    "npm run app:guide": "framing",
    "npm run data:init -- <nom>": "data",
    "npm run feature:new -- <slug>": "implementation",
    "npm run app:capabilities": "integration",
    "npm run check": "verification",
  };
  let phase = failure ? "repair" : phaseByCommand[recommended] ?? "repair";
  let spec;
  try { spec = await loadAppSpec(root, { allowPlaceholder: true }); }
  catch { /* The doctor already reports the invalid or absent specification. */ }

  const features = [];
  for (const feature of spec?.features ?? []) {
    const files = [
      `src/client/pages/${feature.slug}/page.tsx`,
      `src/server/routes/${feature.slug}/route.ts`,
      `src/features/${feature.slug}/server/service.ts`,
      `src/features/${feature.slug}/server/repository.ts`,
      `src/features/${feature.slug}/server/queries.ts`,
      `tests/${feature.slug}.test.ts`,
    ];
    const missing = [];
    for (const file of files) if (!await isFile(root, file)) missing.push(file);
    features.push({ slug: feature.slug, acceptance: feature.acceptance, status: missing.length ? "incomplete" : "present-unverified", missing });
  }
  const incomplete = features.some((feature) => feature.missing.length);
  if (incomplete && !failure && !["bootstrap", "framing"].includes(phase)) phase = "repair";
  const selected = capabilityPlan(spec?.capabilities ?? []);
  const neededNames = new Set(stages[phase].skills);
  if (["integration", "verification"].includes(phase)) {
    for (const capability of selected) for (const name of capability.skills) neededNames.add(name);
  }
  // Product skills use the core guidance. Reading it does not require authentication.
  if (neededNames.size) neededNames.add("databricks-core");
  let upstream;
  try {
    const plan = await planAgentSkills(root, { ...options, capabilityIds: spec?.capabilities ?? [] });
    const needed = plan.skills.filter((skill) => neededNames.has(skill.name));
    const missing = needed.filter((skill) => skill.status === "missing").map((skill) => skill.name);
    upstream = {
      reviewedRevision: plan.reviewedRevision,
      needed,
      // Only absent skills are install candidates. Never overwrite changed guidance to pass a check.
      missingInstall: missing.length ? { command: "databricks", args: ["aitools", "install", "--scope", "global", "--skills-only", "--skills", missing.join(",")] } : null,
    };
  } catch {
    upstream = { needed: [], missingInstall: null, warning: "Registre des skills indisponible ; consulter docs/appkit-maintenance.md." };
  }
  return {
    schemaVersion: 1,
    readOnly: true,
    phase,
    action: stages[phase].action,
    command: incomplete && !failure && phase === "repair" ? null : recommended,
    reference: `${referenceRoot}/${stages[phase].reference}`,
    checkpoint: { path: "docs/creation-progress.md", present: await isFile(root, "docs/creation-progress.md"), authoritative: false },
    known: spec ? { app: spec.app, capabilities: spec.capabilities } : null,
    features,
    integrationReview: selected.filter((item) => item.id !== "analytics").map(({ id, guide, stability, checks }) => ({ id, guide, stability, checks, status: "review-required" })),
    upstream,
    localSkills: phase === "verification" ? [
      ...(spec?.features.length ? ["validate-analytics-kpis"] : []),
      "test-analytics-app-e2e", "review-analytics-app-docs",
    ] : [],
    verification: { status: "not-run", commands: ["npm run check", "git diff --check"], note: "Ce plan ne lance aucun test. La présence des fichiers ne prouve ni le fonctionnement ni les accès distants." },
    diagnostics,
  };
}

async function main() {
  const options = {};
  let json = false;
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--json") json = true;
    else if (args[index] === "--skills-dir" && args[index + 1] && !args[index + 1].startsWith("--")) options.skillsDirectory = args[++index];
    else throw new Error("Usage: npm run app:orchestrate -- [--json] [--skills-dir <path>]");
  }
  const plan = await planCreation(process.cwd(), options);
  process.stdout.write(json ? `${JSON.stringify(plan, null, 2)}\n` : [
    `Reprise du parcours : ${plan.phase}`,
    plan.action,
    ...(plan.command ? [`Commande proposée : ${plan.command}`] : []),
    `Guide : ${plan.reference}`,
    `Notes de reprise : ${plan.checkpoint.present ? plan.checkpoint.path : "absentes"} (à confronter au code).`,
    ...plan.features.map((feature) => `${feature.slug}: ${feature.status}${feature.missing.length ? ` — absents : ${feature.missing.join(", ")}` : ""}`),
    ...plan.upstream.needed.map((skill) => `${skill.name}: ${skill.status}`),
    ...(plan.upstream.warning ? [plan.upstream.warning] : []),
    ...plan.integrationReview.map((item) => `${item.id}: intégration à examiner (${item.stability}) — ${item.guide}`),
    ...plan.diagnostics.filter((item) => item.status === "fail").map((item) => `${item.name}: ${item.detail}`),
    "Utiliser --json pour le plan complet et les éventuelles installations ciblées.",
    plan.verification.note,
    "",
  ].join("\n"));
  if (plan.diagnostics.some((item) => item.status === "fail") || plan.features.some((item) => item.missing.length)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
