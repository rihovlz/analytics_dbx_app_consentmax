#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

function copyIfExists(from, to) {
  if (!existsSync(from)) return;
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

copyIfExists(".next/static", ".next/standalone/.next/static");
copyIfExists("public", ".next/standalone/public");
