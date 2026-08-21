#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { appTypes, loadAppSpec, renderProductBrief, syncProductBrief, writeAppSpec } from "./app-spec.mjs";
import { loadDataAccessManifest } from "./data-access.mjs";

function parseOptions(argv) {
  const options = { nonInteractive: false, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--non-interactive" || flag === "--check") {
      options[flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = true;
      continue;
    }
    if (!["--type", "--audience", "--decision", "--success"].includes(flag)) {
      throw new Error(`Unknown option: ${flag}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
    options[flag.slice(2)] = value;
    index += 1;
  }
  return options;
}

const root = process.cwd();
const options = parseOptions(process.argv.slice(2));
const current = await loadAppSpec(root, { allowPlaceholder: true });

if (options.check) {
  const access = await loadDataAccessManifest(root, { allowPlaceholder: true });
  for (const feature of current.features) {
    if (!access.sources.some((source) => source.name === feature.source)) {
      throw new Error(`Feature '${feature.slug}' uses undeclared source '${feature.source}'.`);
    }
  }
  const expected = renderProductBrief(current);
  const actual = await readFile(join(root, "docs/product-brief.md"), "utf8");
  if (actual !== expected) {
    throw new Error("Product brief is stale. Run npm run app:guide -- --non-interactive.");
  }
  stdout.write(`Validated app specification with ${current.features.length} feature(s).\n`);
  process.exit(0);
}

const prompts = [
  ["type", "Type d’app", current.app.type],
  ["audience", "Qui utilise l’app ?", current.app.audience],
  ["decision", "Quelle décision doit-elle faciliter ?", current.app.decision],
  ["success", "Comment saura-t-on que la V1 est utile ?", current.app.success],
];
const answers = {};
const readline = options.nonInteractive ? undefined : createInterface({ input: stdin, output: stdout });
try {
  for (const [key, label, fallback] of prompts) {
    answers[key] = options[key] ?? (readline ? (await readline.question(`${label} [${fallback}]: `)).trim() || fallback : fallback);
  }
} finally {
  readline?.close();
}

if (!appTypes.includes(answers.type)) {
  throw new Error(`App type must be one of: ${appTypes.join(", ")}.`);
}

const next = await writeAppSpec(root, { ...current, app: { ...current.app, ...answers } });
await syncProductBrief(root, next);
stdout.write("App specification and product brief are synchronized. Next: npm run feature:new -- <slug>.\n");
