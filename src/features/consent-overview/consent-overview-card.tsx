"use client";

import { useCallback, useEffect, useState } from "react";

import {
  type ConsentOverviewResult,
  type FilterParams,
  type Granularity,
  consentOverviewSchema,
} from "@/features/consent-overview/contract";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";

// ── Formatage ─────────────────────────────────────────────────────────────────

function fmtN(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} k`;
  return n.toLocaleString("fr-FR");
}
function fmtPct(r: number, digits = 1): string {
  return `${(r * 100).toFixed(digits)} %`;
}

// ── Filtres header ────────────────────────────────────────────────────────────

function FilterBar({
  filters,
  available,
  onChange,
}: {
  filters: FilterParams;
  available: string[];
  onChange: (f: Partial<FilterParams>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Member */}
      <select
        value={filters.member ?? ""}
        onChange={(e) => onChange({ member: e.target.value || undefined })}
        className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent"
        aria-label="Filtrer par enseigne"
      >
        <option value="">Toutes les enseignes</option>
        {available.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      {/* Période start */}
      <input
        type="date"
        value={filters.startDate ?? ""}
        onChange={(e) => onChange({ startDate: e.target.value || undefined })}
        className="rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        aria-label="Date de début"
      />
      <span className="text-sm text-muted">→</span>
      <input
        type="date"
        value={filters.endDate ?? ""}
        onChange={(e) => onChange({ endDate: e.target.value || undefined })}
        className="rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        aria-label="Date de fin"
      />

      {filters.member || filters.startDate || filters.endDate ? (
        <button
          type="button"
          onClick={() => onChange({ member: undefined, startDate: undefined, endDate: undefined })}
          className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-on-surface"
        >
          Réinitialiser
        </button>
      ) : null}
    </div>
  );
}

// ── KPI header ────────────────────────────────────────────────────────────────

function KpiHeader({ kpi, status }: { kpi: ConsentOverviewResult["kpi"]; status: string }) {
  return (
    <section aria-label="KPI principaux" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {/* Contact */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-panel">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Contact</span>
        <span className="text-3xl font-bold tabular-nums">{fmtN(kpi.contactTotal)}</span>
        <div className="mt-auto rounded-lg bg-muted/10 px-3 py-1 text-center text-xs font-medium text-muted">
          EXPOSED
        </div>
        <div className="rounded-lg border border-line px-3 py-2 text-center">
          <span className="block text-lg font-semibold">{fmtN(kpi.withoutChoice)}</span>
          <span className="text-xs text-muted">sans choix</span>
        </div>
      </div>

      {/* Contact with choice + détail */}
      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 shadow-panel">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Contact with choice</span>
        <div className="rounded-xl bg-accent px-4 py-3 text-center">
          <span className="block text-2xl font-bold text-white tabular-nums">{fmtN(kpi.contactWithChoice)}</span>
        </div>
        <div className="flex flex-col gap-1.5 mt-1">
          <div className="flex items-center justify-between rounded-lg bg-green-600/90 px-3 py-2">
            <span className="text-xs font-medium text-white">Opt-in</span>
            <span className="text-base font-bold text-white tabular-nums">{fmtN(kpi.optIn)}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-amber-500/90 px-3 py-2">
            <span className="text-xs font-medium text-white">Custom</span>
            <span className="text-base font-bold text-white tabular-nums">{fmtN(kpi.custom)}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-red-600/90 px-3 py-2">
            <span className="text-xs font-medium text-white">Opt-out</span>
            <span className="text-base font-bold text-white tabular-nums">{fmtN(kpi.optOut)}</span>
          </div>
        </div>
      </div>

      {/* Consent rate */}
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-panel">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Consent rate</span>
        <div className="mt-4 flex flex-col gap-3">
          {/* Barre empilée principale */}
          <div className="flex h-8 overflow-hidden rounded-lg">
            <div className="flex items-center justify-center bg-green-600 text-xs font-bold text-white" style={{ width: `${(kpi.consentRate * 100).toFixed(1)}%` }}>
              {fmtPct(kpi.consentRate, 0)}
            </div>
            <div className="flex items-center justify-center bg-red-600 text-xs font-bold text-white" style={{ width: `${(kpi.rejectRate * 100).toFixed(1)}%` }}>
              {fmtPct(kpi.rejectRate, 0)}
            </div>
            {kpi.customRate > 0.001 && (
              <div className="flex items-center justify-center bg-amber-500 text-xs font-bold text-white" style={{ width: `${(kpi.customRate * 100).toFixed(1)}%` }}>
                {fmtPct(kpi.customRate, 0)}
              </div>
            )}
          </div>
          {/* Détail chiffré */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg border border-green-600/30 bg-green-600/10 p-2">
              <span className="block font-bold text-green-500">{fmtPct(kpi.consentRate)}</span>
              <span className="text-muted">Accepté</span>
            </div>
            <div className="rounded-lg border border-red-600/30 bg-red-600/10 p-2">
              <span className="block font-bold text-red-500">{fmtPct(kpi.rejectRate)}</span>
              <span className="text-muted">Refusé</span>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
              <span className="block font-bold text-amber-400">{fmtPct(kpi.customRate)}</span>
              <span className="text-muted">Custom</span>
            </div>
          </div>
          {kpi.lastEventAt && (
            <p className="text-xs text-muted">
              {status === "demo" ? "⚠ démo" : "✓ réel"} · last event : {kpi.lastEventAt}
            </p>
          )}
        </div>
      </div>

      {/* Opt-in by device compact */}
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-panel">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Consent by device</span>
        {/* Ce bloc est rempli par ConsentByDevice ci-dessous en version complète */}
        <p className="mt-3 text-xs text-muted">voir section ci-dessous ↓</p>
      </div>
    </section>
  );
}

// ── Opt-in by period ──────────────────────────────────────────────────────────

const GRAN_LABELS: Record<Granularity, string> = { day: "30 derniers jours", week: "12 semaines", month: "12 mois" };

function OptInByPeriod({
  data,
  granularity,
  onGranularity,
}: {
  data: ConsentOverviewResult["byPeriod"];
  granularity: Granularity;
  onGranularity: (g: Granularity) => void;
}) {
  const maxVal = Math.max(...data.map((r) => r.firstConsent + r.reexposed), 1);

  return (
    <section aria-label="Opt-in par période" className="rounded-2xl border border-line bg-surface p-5 shadow-panel">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Opt-in by period</h3>
        <div className="flex gap-1 rounded-lg border border-line p-1">
          {(["day", "week", "month"] as Granularity[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onGranularity(g)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                granularity === g ? "bg-accent text-white" : "text-muted hover:text-on-surface"
              }`}
            >
              {g === "day" ? "Jour" : g === "week" ? "Semaine" : "Mois"}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-green-700" />1er consentement
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-green-400" />Réexposé
        </span>
      </p>
      <div className="flex h-52 items-end gap-0.5 overflow-x-auto pb-1" role="img" aria-label={`Opt-in ${GRAN_LABELS[granularity]}`}>
        {data.map((row) => {
          const total = row.firstConsent + row.reexposed;
          const pct = total / maxVal;
          const firstPct = total > 0 ? row.firstConsent / total : 0;
          return (
            <div key={row.period} className="group relative flex min-w-[10px] flex-1 flex-col items-center justify-end">
              <div className="w-full" style={{ height: `${(pct * 100).toFixed(1)}%` }}>
                <div className="w-full bg-green-400" style={{ height: `${((1 - firstPct) * 100).toFixed(1)}%` }} />
                <div className="w-full bg-green-700" style={{ height: `${(firstPct * 100).toFixed(1)}%` }} />
              </div>
              {/* Label axe X — affiché 1 sur N selon densité */}
              {data.length <= 15 && (
                <span className="mt-1 block truncate text-center text-[9px] text-muted" style={{ maxWidth: "100%" }}>
                  {row.period.slice(-5)}
                </span>
              )}
              {/* Tooltip */}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-40 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-xl group-hover:block">
                <p className="font-semibold">{row.period}</p>
                <p>1er : {fmtN(row.firstConsent)}</p>
                <p>Réexposé : {fmtN(row.reexposed)}</p>
                <p className="mt-1 border-t border-white/20 pt-1 font-semibold">Total : {fmtN(total)}</p>
              </div>
            </div>
          );
        })}
      </div>
      {data.length > 15 && (
        <div className="mt-1 flex justify-between text-[10px] text-muted">
          <span>{data[0]?.period}</span>
          <span>{data.at(-1)?.period}</span>
        </div>
      )}
    </section>
  );
}

// ── Consent rate by member ────────────────────────────────────────────────────

function ConsentByMember({ data }: { data: ConsentOverviewResult["byMember"] }) {
  return (
    <section aria-label="Taux de consentement par membre" className="rounded-2xl border border-line bg-surface p-5 shadow-panel">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Consent rate by member</h3>
      <div className="space-y-2">
        {data.map((row) => (
          <div key={row.member} className="flex items-center gap-3">
            <span className="w-8 shrink-0 text-xs font-semibold">{row.member}</span>
            <div className="flex h-5 flex-1 overflow-hidden rounded">
              <div className="bg-green-600" style={{ width: `${(row.consentRate * 100).toFixed(1)}%` }} />
              <div className="bg-red-500" style={{ width: `${((1 - row.consentRate) * 100).toFixed(1)}%` }} />
            </div>
            <span className="w-14 shrink-0 text-right text-xs tabular-nums font-medium">{fmtPct(row.consentRate)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Opt-in by device ──────────────────────────────────────────────────────────

function ConsentByDevice({ data }: { data: ConsentOverviewResult["byDevice"] }) {
  return (
    <section aria-label="Opt-in par device" className="rounded-2xl border border-line bg-surface p-5 shadow-panel">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Opt-in by device</h3>
      <div className="space-y-4">
        {data.map((row) => (
          <div key={row.deviceType}>
            {/* Label + KPI à droite : % part du total + valeur absolue */}
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">{row.deviceType}</span>
              <span className="shrink-0 text-right text-xs text-muted">
                <span className="font-bold text-on-surface">{fmtPct(row.shareOfTotal)}</span>
                {" · "}
                <span className="font-bold text-green-500">{fmtN(row.optIn)}</span>
                {" opt-in"}
              </span>
            </div>
            {/* Barre acc/rej avec % internes */}
            <div className="flex h-6 overflow-hidden rounded-lg">
              <div
                className="flex items-center justify-center bg-green-600 text-[10px] font-bold text-white"
                style={{ width: `${(row.consentRate * 100).toFixed(1)}%` }}
              >
                {row.consentRate > 0.12 ? fmtPct(row.consentRate, 0) : ""}
              </div>
              <div
                className="flex items-center justify-center bg-red-500 text-[10px] font-bold text-white"
                style={{ width: `${((1 - row.consentRate) * 100).toFixed(1)}%` }}
              >
                {1 - row.consentRate > 0.12 ? fmtPct(1 - row.consentRate, 0) : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Consent by page type ──────────────────────────────────────────────────────

function ConsentByPageType({ data }: { data: ConsentOverviewResult["byPageType"] }) {
  return (
    <section aria-label="Opt-in Rate by page type" className="rounded-2xl border border-line bg-surface p-5 shadow-panel">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Opt-in Rate by page type</h3>
      <div className="space-y-2">
        {data.map((row) => (
          <div key={row.pageType} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-sm" title={row.pageType}>{row.pageType}</span>
            <div className="flex h-5 flex-1 overflow-hidden rounded">
              <div className="bg-green-600" style={{ width: `${(row.consentRate * 100).toFixed(1)}%` }} />
              <div className="bg-red-500" style={{ width: `${((1 - row.consentRate) * 100).toFixed(1)}%` }} />
            </div>
            <span className="w-14 shrink-0 text-right text-xs tabular-nums font-medium">{fmtPct(row.consentRate)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Opt-in rate evolution ─────────────────────────────────────────────────────

function OptInRateEvolution({ data }: { data: ConsentOverviewResult["rateEvolution"] }) {
  if (data.length === 0) return null;

  const rates = data.map((r) => r.consentRate);
  const minR = Math.min(...rates);
  const maxR = Math.max(...rates);
  const padding = (maxR - minR) * 0.15 || 0.02;
  const yMin = Math.max(0, minR - padding);
  const yMax = Math.min(1, maxR + padding);
  const yRange = yMax - yMin || 0.01;

  const W = 1000;
  const H = 200;
  const PAD = { top: 16, right: 8, bottom: 24, left: 48 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const toX = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * chartW;
  const toY = (v: number) => PAD.top + (1 - (v - yMin) / yRange) * chartH;

  const linePath = data.map((r, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(r.consentRate).toFixed(1)}`).join(" ");

  // Grille Y — 4 niveaux
  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (i / 4) * yRange);

  return (
    <section aria-label="Opt-in Rate Evolution" className="rounded-2xl border border-line bg-surface p-5 shadow-panel">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Opt-in Rate Evolution</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Évolution du taux d'opt-in">
        {/* Grille */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} y1={toY(v)} x2={W - PAD.right} y2={toY(v)} stroke="currentColor" strokeOpacity={0.1} strokeWidth={1} />
            <text x={PAD.left - 6} y={toY(v) + 4} textAnchor="end" fontSize={11} fill="currentColor" fillOpacity={0.5}>
              {fmtPct(v, 0)}
            </text>
          </g>
        ))}
        {/* Courbe */}
        <path d={linePath} fill="none" stroke="#16a34a" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {/* Axe X — dates début et fin */}
        <text x={PAD.left} y={H - 4} fontSize={11} fill="currentColor" fillOpacity={0.5}>{data[0]?.day}</text>
        <text x={W - PAD.right} y={H - 4} textAnchor="end" fontSize={11} fill="currentColor" fillOpacity={0.5}>{data.at(-1)?.day}</text>
      </svg>
    </section>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

type State =
  | { status: "loading" }
  | { status: "success"; result: ConsentOverviewResult }
  | { status: "error"; message: string; requestId?: string };

const DEFAULT_FILTERS: FilterParams = { granularity: "month" };

export function ConsentOverviewCard() {
  const [filters, setFilters] = useState<FilterParams>(DEFAULT_FILTERS);
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback((f: FilterParams) => {
    setState({ status: "loading" });
    const params = new URLSearchParams();
    if (f.member) params.set("member", f.member);
    if (f.startDate) params.set("startDate", f.startDate);
    if (f.endDate) params.set("endDate", f.endDate);
    if (f.granularity) params.set("granularity", f.granularity);

    fetch(`/api/consent-overview?${params.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        const payload: unknown = await res.json();
        if (!res.ok) {
          const err = payload as { error?: { message?: string; requestId?: string } };
          setState({ status: "error", message: err.error?.message ?? "Données non disponibles.", requestId: err.error?.requestId });
          return;
        }
        setState({ status: "success", result: consentOverviewSchema.parse(payload) });
      })
      .catch(() => setState({ status: "error", message: "La réponse du serveur n'est pas valide." }));
  }, []);

  useEffect(() => { load(filters); }, [load, filters]);

  function handleFilterChange(partial: Partial<FilterParams>) {
    const next = { ...filters, ...partial };
    setFilters(next);
  }

  function handleGranularity(g: Granularity) {
    const next = { ...filters, granularity: g };
    setFilters(next);
  }

  const availableMembers =
    state.status === "success" ? state.result.filters.availableMembers : [];

  return (
    <div className="min-h-screen space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">ConsentMax Analytics</h1>
          {state.status === "success" && state.result.status === "demo" && (
            <span className="mt-1 inline-block rounded-full bg-amber-100 px-3 py-0.5 text-xs font-medium text-amber-800">
              Mode démo — données synthétiques
            </span>
          )}
        </div>
        <FilterBar filters={filters} available={availableMembers} onChange={handleFilterChange} />
      </div>

      {state.status === "loading" && <LoadingState label="Chargement du dashboard…" />}
      {state.status === "error" && (
        <ErrorState title="Données indisponibles" message={state.message} requestId={state.requestId} />
      )}

      {state.status === "success" && (() => {
        const { result } = state;
        return (
          <div className="space-y-5">
            {/* Row 1 — KPI header */}
            <KpiHeader kpi={result.kpi} status={result.status} />

            {/* Row 2 — Opt-in by period + Consent by member */}
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <OptInByPeriod
                data={result.byPeriod}
                granularity={result.filters.granularity}
                onGranularity={handleGranularity}
              />
              <ConsentByMember data={result.byMember} />
            </div>

            {/* Row 3 — Device + Page type */}
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <ConsentByDevice data={result.byDevice} />
              <ConsentByPageType data={result.byPageType} />
            </div>

            {/* Row 4 — Evolution pleine largeur */}
            <OptInRateEvolution data={result.rateEvolution} />
          </div>
        );
      })()}
    </div>
  );
}
