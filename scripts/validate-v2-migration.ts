#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parse, stringify } from "yaml";
import { findRepositoryRoot } from "./repository-fixture";

// This is a disposable acceptance fixture, never an in-place migration tool.
const baseline = "8b779bcb363a7c57bdea12342964601d0acdfef4";
const root = await findRepositoryRoot();
const fixture = await mkdtemp(join(tmpdir(), "valiuz-v15-migration-"));
const environment = { ...process.env, APP_MODE: "demo", CI: "true" };
for (const key of Object.keys(environment)) {
  if (key.startsWith("DATABRICKS_") || key.startsWith("USER_STATE_") || key === "GIT_INDEX_FILE") delete environment[key as keyof typeof environment];
}
function run(command: string, args: string[]) {
  process.stdout.write(`> ${command} ${args.join(" ")}\n`);
  return execFileSync(command, args, { cwd: fixture, env: environment, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
}
async function copyCurrent(file: string) {
  await mkdir(dirname(join(fixture, file)), { recursive: true });
  await cp(join(root, file), join(fixture, file));
}
try {
  const archive = execFileSync("git", ["archive", baseline], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
  execFileSync("tar", ["-x", "-C", fixture], { input: archive });
  run("git", ["init", "--quiet"]);
  run("git", ["add", "."]);
  await symlink(join(root, "node_modules"), join(fixture, "node_modules"), "dir");
  run(process.execPath, ["scripts/init-app.mjs", "migration-app", "--non-interactive", "--data-project", "dev-dtm-operating",
    "--schema", "analytics", "--support-name", "Équipe Métier", "--support-slack-url", "https://valiuz.slack.com/archives/business"]);
  run(process.execPath, ["scripts/init-data.mjs", "sales", "--mode", "direct", "--source", "dev-dtm-operating.analytics.sales", "--non-interactive"]);
  run(process.execPath, ["scripts/new-feature.mjs", "sales-kpi", "--source", "sales", "--aggregation", "sum", "--column", "amount", "--demo-value", "73", "--non-interactive"]);
  run(process.execPath, ["scripts/init-user-state.mjs", "--schema", "migration_state"]);
  const oldState = parse(await readFile(join(fixture, ".valiuz-template.yml"), "utf8"));
  assert.equal(oldState.template.version, "1.5.0");
  const preservedPaths = [
    "src/features/sales-kpi/server/queries.ts", "src/features/sales-kpi/server/repository.ts", "src/features/sales-kpi/server/service.ts",
    "config/data-access.json", "config/genie-spaces.json", "config/app-spec.yml", "app.yaml", ".env.example",
    "public/valiuz-logo-icon.svg", "public/favicon.svg",
  ];
  const before = await Promise.all(preservedPaths.map((file) => readFile(join(fixture, file), "utf8")));
  const customCss = "\n/* Business brand customization */\n.business-panel { border-radius: 19px; }\n";
  const oldCss = await readFile(join(fixture, "src/app/globals.css"), "utf8");
  const oldNav = await readFile(join(fixture, "src/components/app-shell/app-nav.tsx"), "utf8");
  // Apply only the template-owned files named by the guide. Preserve app configuration and business source.
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
  const templatePaths = /^(src\/(client|server|shared|lib)\/|scripts\/|template\/|tests\/|e2e\/|\.github\/|\.agents\/|docs\/|AGENTS\.md$|vite\.config\.ts$|index\.html$|tsconfig\.json$|eslint\.config\.mjs$|playwright\.config\.ts$|config\/appkit-(compatibility|capabilities)\.json$)/;
  for (const file of files.filter((file) => templatePaths.test(file))) {
    if (["docs/product-brief.md", ...preservedPaths].includes(file)) continue;
    await copyCurrent(file);
  }
  await copyCurrent("src/components/app-shell/app-header.tsx");
  await copyCurrent("src/features/user-state/server/runtime.ts");
  await copyCurrent("src/features/user-state/server/request.ts");
  // Remove only the framework poison imports; all feature logic remains byte-equivalent otherwise.
  for (const file of files.filter((file) => file.startsWith("src/features/") && file.endsWith(".ts"))) {
    const path = join(fixture, file);
    const text = await readFile(path, "utf8");
    await writeFile(path, text.replace('import "server-only";\n\n', ""));
  }
  await writeFile(join(fixture, "src/client/globals.css"), oldCss + customCss);
  await writeFile(join(fixture, "src/components/app-shell/app-nav.tsx"), oldNav
    .replace('import { usePathname } from "next/navigation";', 'import { Link, useLocation } from "react-router-dom";')
    .replace("const pathname = usePathname();", "const { pathname } = useLocation();")
    .replace("<a\n", "<Link\n").replace("href={link.href}", "to={link.href}").replace("</a>", "</Link>"));
  await mkdir(join(fixture, "src/client/pages/sales-kpi"), { recursive: true });
  await rename(join(fixture, "src/app/sales-kpi/page.tsx"), join(fixture, "src/client/pages/sales-kpi/page.tsx"));
  await mkdir(join(fixture, "src/server/routes/sales-kpi"), { recursive: true });
  const api = await readFile(join(fixture, "src/app/api/sales-kpi/route.ts"), "utf8");
  await writeFile(join(fixture, "src/server/routes/sales-kpi/route.ts"), api.replace('export const dynamic = "force-dynamic";\n\n', ""));
  for (const file of ["src/app", "src/instrumentation.ts", "next.config.mjs", "next-env.d.ts", "scripts/prepare-standalone.mjs"]) {
    await rm(join(fixture, file), { recursive: true, force: true });
  }
  const clientRoutes = join(fixture, "src/client/routes.tsx");
  await writeFile(clientRoutes, (await readFile(clientRoutes, "utf8"))
    .replace("// feature:new inserts imports", 'const SalesKpiPage = lazy(() => import("./pages/sales-kpi/page"));\n// feature:new inserts imports')
    .replace("  // feature:new inserts routes", '  { path: "/sales-kpi", element: <SalesKpiPage /> },\n  // feature:new inserts routes'));
  const serverRoutes = join(fixture, "src/server/routes.ts");
  await writeFile(serverRoutes, (await readFile(serverRoutes, "utf8"))
    .replace("// feature:new inserts imports", 'import { GET as getSalesKpi } from "./routes/sales-kpi/route";\n// feature:new inserts imports')
    .replace("  // feature:new inserts routes", '  app.get("/api/sales-kpi", expressRoute(getSalesKpi));\n  // feature:new inserts routes'));
  const pkg = JSON.parse(await readFile(join(fixture, "package.json"), "utf8"));
  const currentPkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  Object.assign(pkg, { scripts: currentPkg.scripts, dependencies: currentPkg.dependencies, devDependencies: currentPkg.devDependencies });
  await writeFile(join(fixture, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  // Regenerate only this disposable fixture's lockfile from the reviewed dependency set.
  await copyCurrent("package-lock.json");
  const lock = JSON.parse(await readFile(join(fixture, "package-lock.json"), "utf8"));
  lock.name = pkg.name; lock.packages[""].name = pkg.name;
  await writeFile(join(fixture, "package-lock.json"), JSON.stringify(lock, null, 2) + "\n");
  run(process.execPath, ["scripts/render-data-access.mjs"]);
  run(process.execPath, ["scripts/template-status.mjs", "--check", "--to", "2.0.0"]);
  oldState.template.version = "2.0.0";
  oldState.capabilities.push("appkit-native-runtime", "upstream-compatibility", "guided-appkit-capabilities");
  oldState.appliedUpgrades.push("1.5.0-to-2.0.0");
  await writeFile(join(fixture, ".valiuz-template.yml"), stringify(oldState));
  const after = await Promise.all(preservedPaths.map((file) => readFile(join(fixture, file), "utf8")));
  assert.deepEqual(after, before, "Business queries, sources, tables and branding configuration must survive migration");
  run(process.execPath, ["scripts/app-guide.mjs", "--non-interactive"]);
  const migratedSpec = parse(await readFile(join(fixture, "config/app-spec.yml"), "utf8"));
  const originalSpec = parse(before[preservedPaths.indexOf("config/app-spec.yml")]);
  assert.deepEqual(migratedSpec.app, originalSpec.app);
  assert.deepEqual(migratedSpec.features, originalSpec.features);
  assert.deepEqual(migratedSpec.capabilities, ["analytics"]);
  run(process.execPath, ["scripts/app-guide.mjs", "--check"]);
  assert.ok((await readFile(join(fixture, "src/client/globals.css"), "utf8")).endsWith(customCss));
  assert.match(await readFile(join(fixture, "src/components/app-shell/app-nav.tsx"), "utf8"), /sales-kpi/);
  for (const script of ["typecheck", "lint", "build"]) process.stdout.write(run("npm", ["run", script]));
  process.stdout.write(run(process.execPath, ["--import", "tsx", "--test", "tests/sales-kpi.test.ts"]));
  process.stdout.write("Initialized 1.5 business fixture migrated to 2.0 with contracts and customizations preserved.\n");
} finally { await rm(fixture, { recursive: true, force: true }); }
