#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Keep the existing commands as the implementation and public automation interface.
const commands = {
  init: { script: "init-app", file: "init-app.mjs", usage: "<nom> [--non-interactive] [--data-project <catalogue>] [options init-app]", detail: "Initialiser une nouvelle copie (fichiers locaux). Options complètes : npm run init-app -- --help." },
  guide: { script: "app:guide", file: "app-guide.mjs", usage: "[--non-interactive] [--audience <texte>] [--decision <texte>] [--success <texte>] [--capabilities analytics,genie]", detail: "Cadrer le besoin et synchroniser la spec et le brief." },
  data: { script: "data:init", file: "init-data.mjs", usage: "<nom> [--mode direct|notebook|pipeline] [--source catalogue.schema.table] [--non-interactive]", detail: "Déclarer une source ou générer sa préparation locale ; aucun SQL distant." },
  feature: { script: "feature:new", file: "new-feature.mjs", usage: "<slug> [--source <nom>] [--aggregation count|sum|avg] [--column <colonne>] [--demo-value <nombre>] [--non-interactive]", detail: "Générer une tranche KPI locale à relire." },
  dev: { script: "dev", usage: "", detail: "Démarrer le serveur local avec la configuration de l'app." },
  check: { script: "check", usage: "", detail: "Exécuter les validations locales et le build." },
  next: { script: "app:orchestrate", file: "app-orchestrate.mjs", usage: "[--json] [--skills-dir <dossier externe>]", detail: "Lire l'état actuel et proposer la prochaine étape ; n'exécute pas cette étape." },
  doctor: { script: "app:doctor", file: "app-doctor.mjs", usage: "", detail: "Diagnostiquer la configuration locale, sans correction automatique." },
  capabilities: { script: "app:capabilities", file: "app-capabilities.mjs", usage: "[--all] [--json]", detail: "Consulter les plugins, ressources et contrôles utiles, sans activation." },
  skills: { script: "app:skills", file: "app-skills.mjs", usage: "[--directory <dossier externe>] [--json] [--check]", detail: "Identifier les skills amont et contrôler une installation explicite, sans installer." },
};

const roles = {
  "data-analyst": "Je suis data analyst. Aide-moi à préciser la décision, les KPI, les filtres et la lecture des résultats.",
  "analytics-engineer": "Je suis analytics engineer. Aide-moi à préciser le grain, les définitions de métriques, les jointures et les tests de calcul.",
  "data-engineer": "Je suis data engineer. Aide-moi à préciser les sources, la fraîcheur et les volumes ; garder une lecture directe si elle suffit, sinon justifier une préparation bornée.",
};

export function creationPrompt({ role = "data-analyst", idea = "une app de suivi des commandes" } = {}) {
  if (!Object.hasOwn(roles, role)) throw new Error(`Profil inconnu. Choisir : ${Object.keys(roles).join(", ")}.`);
  if (!idea.trim()) throw new Error("Décrire le besoin avec --idea <texte>.");
  return [
    "Utilise create-analytics-dbx-app pour créer ou faire évoluer une app Valiuz dans ce projet.",
    roles[role],
    `Mon besoin : ${idea.trim()}`,
    "Commence par lire l'état du projet ; reprends une app existante sans la réinitialiser.",
    "Réutilise les réponses connues et pose au plus trois questions utiles à la fois.",
    "Pour une nouvelle app, réalise d'abord une petite tranche en démo avec des données synthétiques explicites.",
    "Propose seulement les capacités AppKit utiles et consulte les skills Databricks correspondants hors du code de l'app.",
    "Implémente la tranche, vérifie le calcul, les états chargement/vide/erreur et les contrôles locaux, puis indique les commandes exécutées et la prochaine étape.",
    "Les accès réels et toute publication ou mutation distante restent à confirmer pour leurs cibles précises.",
  ].join("\n");
}

function printHelp(command) {
  if (command && commands[command]) {
    const item = commands[command];
    process.stdout.write(`npm run app -- ${command} ${item.usage}\n${item.detail}\nCommande existante : npm run ${item.script}\n`);
    return;
  }
  if (command === "prompt") {
    process.stdout.write(`npm run app -- prompt [--role ${Object.keys(roles).join("|")}] [--idea <texte>] [--json]\nAffiche un prompt à copier dans votre assistant ; ne lance aucun agent et ne modifie rien.\n`);
    return;
  }
  if (command === "migrate") {
    process.stdout.write("npm run app -- migrate --app-dir <ancienne app> [--from <version>] [--to <version>] [--json]\nDepuis un checkout du template cible : inventaire local et guides ordonnés, sans modifier l'app.\n--from est nécessaire seulement si .valiuz-template.yml est absent.\n");
    return;
  }
  process.stdout.write([
    "Parcours Valiuz — npm run app -- <commande>",
    "",
    "Démarrer : prompt [--role data-analyst|analytics-engineer|data-engineer] [--idea <texte>]",
    "Reprendre : next [--json] (diagnostic en lecture seule)",
    "",
    "1. init <nom>     Initialiser une nouvelle copie, une seule fois",
    "2. guide          Cadrer utilisateurs, décision et succès",
    "3. data <nom>     Déclarer la source ; direct par défaut",
    "4. feature <slug> Générer un premier KPI simple",
    "5. dev / check    Ouvrir l'app / valider et construire",
    "",
    "Autres besoins : capabilities --all ; skills ; doctor",
    "Genie ou fichiers : suivre capabilities, sans imposer une tranche KPI.",
    "Migration : migrate --app-dir <ancienne app> (lecture seule, depuis le template cible)",
    "",
    "Aide : npm run app -- <commande> --help",
    "Guide et exemples par métier : docs/cli-workflow.md",
    "Les commandes historiques restent disponibles. Aucun déploiement n'est lancé par ce menu.",
    "",
  ].join("\n"));
}

export async function runApp(args, root = process.cwd()) {
  const [command, ...rest] = args;
  if (!command || ["help", "--help", "-h"].includes(command)) { printHelp(); return 0; }
  if (!Object.hasOwn(commands, command) && !["prompt", "migrate"].includes(command)) {
    throw new Error(`Commande inconnue : ${command}. Consulter npm run app -- --help.`);
  }
  if (rest[0] === "--help" || rest[0] === "-h") { printHelp(command); return 0; }
  if (command === "prompt") {
    const options = {};
    let json = false;
    for (let index = 0; index < rest.length; index += 1) {
      const arg = rest[index];
      if (arg === "--json") json = true;
      else if (["--role", "--idea"].includes(arg) && rest[index + 1] && !rest[index + 1].startsWith("--")) options[arg.slice(2)] = rest[++index];
      else throw new Error("Usage : npm run app -- prompt [--role <profil>] [--idea <texte>] [--json]");
    }
    const prompt = creationPrompt(options);
    process.stdout.write(`${json ? JSON.stringify({ schemaVersion: 1, readOnly: true, role: options.role ?? "data-analyst", prompt }, null, 2) : prompt}\n`);
    return 0;
  }
  if (command === "migrate") {
    const { runMigrationPlan } = await import("./app-migrate.mjs");
    await runMigrationPlan(rest);
    return 0;
  }
  const item = commands[command];
  const executable = item.file ? process.execPath : "npm";
  const forwarded = item.file ? [`scripts/${item.file}`, ...rest] : ["run", "--silent", item.script, "--", ...rest];
  const result = spawnSync(executable, forwarded, { cwd: root, stdio: "inherit" });
  if (result.error) throw new Error(`Impossible de lancer npm run ${item.script} : ${result.error.message}`);
  return result.status ?? (result.signal === "SIGINT" ? 130 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exitCode = await runApp(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
