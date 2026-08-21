# Agent Guide

Operational instructions for coding agents working from this Databricks Apps template.

## Start Here

Read `README.md`, then the relevant runbook: `docs/architecture.md` for boundaries, `docs/databricks.md` for identity
and SQL, and `docs/deployment.md` for remote changes. Inspect `git status --short --branch` before editing and preserve
unrelated work.

## Architecture and Boundaries

```text
src/app + src/components
  → src/features/<feature>/server/service.ts
  → src/features/<feature>/server/repository.ts
  → src/lib/databricks/SqlExecutor
  → Databricks SQL / Unity Catalog
```

- Add a page in `src/app/<route>/page.tsx`.
- Add shared neutral UI in `src/components`; keep business UI inside its feature.
- Add business orchestration in `src/features/<feature>/server/service.ts`.
- Add SQL and row contracts in that feature’s `queries.ts` and `repository.ts`.
- Add generic platform behavior only in `src/lib`; it must not contain business vocabulary, table names or KPIs.
- UI/client modules must never import environment config, Databricks clients or server repositories.
- API routes use `withApiRoute`; do not invent a second response/error envelope.
- Keep `/health` shallow. Put remote connectivity checks in a distinct endpoint.

Avoid speculative abstractions. Extract a generic helper only when two real features share the same stable need.

## Databricks and Data Rules

- Local real-data development uses a named Databricks CLI OAuth U2M profile. A PAT is a legacy fallback permitted only
  in an ignored `.env.local`. Runtime auth uses credentials injected by Databricks Apps.
- Never commit or log tokens, client secrets, `.env` files, query results with sensitive rows, or customer identifiers.
- Do not interpolate user input into SQL. Use driver parameters and validate result rows with Zod.
- Keep each query named, bounded by a timeout and row limit, and isolated in a repository.
- Verify Unity Catalog privileges are minimal: `USE CATALOG`, `USE SCHEMA`, plus object-level access.
- The data project is the Unity Catalog catalog and must be declared in `config/data-projects.json`. The initial Valiuz
  allowlist is `dev-dtm-operating`, `dev-dtm-media-pm`, `dev-dtm-myvaliuz` and `dev-dtm-insight-sharing`.
- Register every table or view in `config/data-access.json`; its qualified name must start with the selected project.
  Run `npm run data:access:render` and review the generated `SELECT` bindings before deployment.
- Keep `config/app-spec.yml` and `docs/product-brief.md` synchronized with `npm run app:guide`. Prefer
  `npm run feature:new -- <slug>` for the first simple KPI slice, then review every generated query.
- Use `npm run data:init -- <name>` to choose `direct`, `notebook` or `pipeline`. Default to `direct`. Notebook and
  pipeline modes belong to the separate `data/` bundle, write with the maintainer identity, and expose only their
  declared output to the app with `SELECT`.
- Generated preparation schedules stay paused until a successful manual run. Do not activate a schedule or run a
  generated SQL write without confirming workspace, profile, project, source and output.
- Treat `npm run deploy`, bundle deployment, app start, grants and SQL writes as remote mutations. Confirm host, profile,
  target, app, warehouse, project, schema and declared sources before running them.
- Do not introduce DLT, dbt, a job, secret scope or additional Databricks resource unless the feature requires it.

## Coding and Testing

TypeScript is strict, ESM and ES2022. Use two-space indentation, double quotes, semicolons, named helpers and the `@/*`
alias under `src`. Keep French UI copy neutral and accessible. Update `package-lock.json` through npm.

Tests use `node:test` through `tsx` and belong in `tests/*.test.ts`. Inject a fake `SqlExecutor`; unit tests must not
need network credentials. `npm run test:databricks` is an explicit integration smoke test and is not part of CI.

Before handoff, run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

Review the complete diff and final status. Report commands actually run; never claim an unexecuted check passed.

## Deployment and Git

Use a feature branch and a pull request. Keep commits focused; do not commit generated `.next`, caches or credentials.
Do not push, merge, deploy, grant permissions, dispatch workflows or change GitHub settings without explicit user
authorization. Do not use destructive cleanup to resolve unrelated changes.

For a new repository, run `npm ci`, then `npm run init-app -- <name>` once and `npm run app:guide`; review every
replacement. The production app bundle is Git-backed on `main`; Git and the deployed revision must stay aligned. Keep
one `app.yaml` manifest as the runtime source of truth. `data/databricks.yml` is an optional preparation bundle, not a
second app manifest.

## Definition of Done

A change is done only when:

- UI, service, repository and platform boundaries remain clear;
- configuration fails explicitly and no secret reaches browser, logs, tests or Git;
- SQL is parameterized, named and row-validated;
- the selected data project, declared sources and generated least-privilege bindings agree;
- user errors are understandable while technical causes remain in structured logs;
- behavior changes have deterministic unit tests and docs reflect operational changes;
- lint, typecheck, unit tests and production build pass;
- remote changes were explicitly authorized and smoke-checked;
- the final diff and status are understood and the handoff lists any unvalidated item.
