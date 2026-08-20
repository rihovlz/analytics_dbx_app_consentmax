#!/usr/bin/env node

import { spawnSync } from "node:child_process";

function parseTarget(argv) {
  const targetIndex = argv.indexOf("--target");
  if (targetIndex === -1) return "dev";
  const target = argv[targetIndex + 1];
  if (!target || target.startsWith("--")) throw new Error("--target requires a value.");
  return target;
}

function databricks(args) {
  const result = spawnSync("databricks", args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const target = parseTarget(process.argv.slice(2));
databricks(["bundle", "validate", "--target", target]);
databricks(["bundle", "deploy", "--target", target]);
databricks(["bundle", "run", "app", "--target", target]);
