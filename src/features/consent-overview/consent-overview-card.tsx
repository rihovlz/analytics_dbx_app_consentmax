"use client";

import { useEffect, useState } from "react";

import { consentOverviewSchema, type ConsentOverviewResult } from "@/features/consent-overview/contract";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtN(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} k`;
  return n.toLocaleString("fr-FR");
}

function fmtPct(r: number): string {
  return `${(r * 100).toFixed(1)} %`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-sm font-semibold text-muted uppercase tracking-wide">{children}</h3>;
}

// ── KPI header ────────────────────────────────────────────────────────────────

function KpiHeader({ kpi, status }: { kpi: ConsentOverviewResult["kpi"]; status: ConsentOverviewResult["status"] }) {
  return (
    <section aria-label="KPI principaux" className="rounded-2xl border border-line bg-surface p-6 shadow-panel">
      <div className="flex flex-wrap items-start gap-4">
        {/* Contact bloc */}
        <div className="flex min-w-[140px] flex-col gap-2">
          <div className="rounded-xl bg-muted/10 p-4 text-center">
            <div className="text-3xl font-bold">{fmtN(kpi.contactTotal)}</div>
            <div className="text-xs text-muted">Contact</div>
          </div>
          <div className="rounded-xl bg-muted/10 p-3 text-center text-xs text-muted">
            EXPOSED
          </div>
          <div className="rounded-xl bg-muted/10 p-3 text-center">
            <div className="font-semibold">{fmtN(kpi.withoutChoice)}</div>
            <div className="text-xs text-muted">sans choix</div>
          </div>
        </div>

        {/* Contact with choice bloc */}
        <div className="flex min-w-[200px] flex-col gap-2">
          <div className="rounded-xl bg-accent p-4 text-center">
            <div className="text-2xl font-bold text-white">{fmtN(kpi.contactWithChoice)}</div>
            <div className="text-xs text-white/80">Contact with choice</div>
          </div>
          <div className="rounded-xl bg-green-600 p-3 text-center">
            <div className="font-semibold text-white">{fmtN(kpi.optIn)}</div>
            <div className="text-xs text-white/80">Opt-in</div>
          </div>
          <div className="rounded-xl bg-amber-500 p-3 text-center">
            <div className="font-semibold text-white">{fmtN(kpi.custom)}</div>
            <div className="text-xs text-white/80">Custom</div>
          </div>
          <div className="rounded-xl bg-red-600 p-3 text-center">
            <div className="font-semibold text-white">{fmtN(kpi.optOut)}</div>
            <div className="text-xs text-white/80">Opt-out</div>
          </div>
        </div>

        {/* Consent rate */}
        <div className="flex min-w-[180px] flex-col gap-3">
          <SectionTitle>Consent rate</SectionTitle>
          <div className="flex items-center gap-3">
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-red-200">
              <div className="h-full rounded-full bg-green-600" style={{ width: `${(kpi.consentRate * 100).toFixed(0)}%` }} />
            </div>
            <span className="w-14 text-right text-sm font-semibold">{fmtPct(kpi.consentRate)}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded bg-green-600 p-2 text-white">
              <div className="font-bold">{fmtPct(kpi.consentRate)}</div>
              <div>acc…</div>
            </div>
            <div className="rounded bg-red-600 p-2 text-white">
              <div className="font-bold">{fmtPct(kpi.rejectRate)}</div>
              <div>rej…</div>
            </div>
            <div className="rounded bg-amber-500 p-2 text-white">
              <div className="font-bold">{fmtPct(kpi.customRate)}</div>
              <div>cu…</div>
            </div>
          </div>
          {kpi.lastEventAt && (
            <p className="text-xs text-muted">
              {status === "demo" ? "⚠ démo" : "✓ réel"} — last event : {kpi.lastEventAt}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Opt-in by month ───────────────────────────────────────────────────────────

function OptInByMonth({ data }: { data: ConsentOverviewResult["byMonth"] }) {
  const max = Math.max(...data.map((r) => r.firstConsent + r.refresh), 1);
  return (
    <section aria-label="Opt-in par mois" className="rounded-2xl border border-line bg-surface p-6 shadow-panel">
      <SectionTitle>Opt-in by month</SectionTitle>
      <p className="mb-3 text-xs text-muted">
        <span className="mr-3 inline-block h-2 w-4 rounded bg-green-700" />vert foncé : 1st consent
        <span className="ml-4 mr-3 inline-block h-2 w-4 rounded bg-green-400" />vert clair : consent refresh
      </p>
      <div className="flex h-48 items-end gap-1">
        {data.map((row) => {
          const total = row.firstConsent + row.refresh;
          const pct = total / max;
          const firstPct = row.firstConsent / total;
          return (
            <div key={row.month} className="group relative flex flex-1 flex-col items-center">
              <div className="w-full" style={{ height: `${(pct * 100).toFixed(1)}%` }}>
                <div className="w-full bg-green-400" style={{ height: `${((1 - firstPct) * 100).toFixed(1)}%` }} />
                <div className="w-full bg-green-700" style={{ height: `${(firstPct * 100).toFixed(1)}%` }} />
              </div>
              <span className="mt-1 rotate-90 text-[9px] text-muted">{row.month.slice(2)}</span>
              {/* tooltip */}
              <div className="pointer-events-none absolute bottom-full mb-1 hidden rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block">
                {row.month}<br />
                1st: {fmtN(row.firstConsent)}<br />
                refresh: {fmtN(row.refresh)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Consent by member ─────────────────────────────────────────────────────────

function ConsentByMember({ data }: { data: ConsentOverviewResult["byMember"] }) {
  return (
    <section aria-label="Taux de consentement par membre" className="rounded-2xl border border-line bg-surface p-6 shadow-panel">
      <SectionTitle>Consent rate by member</SectionTitle>
      <div className="space-y-2">
        {data.map((row) => (
          <div key={row.member} className="flex items-center gap-3">
            <span className="w-10 text-xs font-medium">{row.member}</span>
            <div className="flex h-5 flex-1 overflow-hidden rounded">
              <div className="bg-green-600" style={{ width: `${(row.consentRate * 100).toFixed(1)}%` }} />
              <div className="bg-red-500" style={{ width: `${((1 - row.consentRate) * 100).toFixed(1)}%` }} />
            </div>
            <span className="w-12 text-right text-xs tabular-nums">{fmtPct(row.consentRate)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Consent by device ─────────────────────────────────────────────────────────

function ConsentByDevice({ data }: { data: ConsentOverviewResult["byDevice"] }) {
  const total = data.reduce((s, r) => s + r.total, 0) || 1;
  return (
    <section aria-label="Opt-in par device" className="rounded-2xl border border-line bg-surface p-6 shadow-panel">
      <SectionTitle>Opt-in by device</SectionTitle>
      <div className="space-y-3">
        {data.map((row) => (
          <div key={row.deviceType}>
            <div className="mb-1 flex justify-between text-xs">
              <span>{row.deviceType}</span>
              <span className="text-muted">{fmtPct(row.total / total)}</span>
            </div>
            <div className="flex h-4 overflow-hidden rounded">
              <div className="bg-green-600" style={{ width: `${(row.consentRate * 100).toFixed(1)}%` }} title={`Opt-in ${fmtPct(row.consentRate)}`} />
              <div className="bg-red-500" style={{ width: `${((1 - row.consentRate) * 100).toFixed(1)}%` }} title={`Opt-out ${fmtPct(1 - row.consentRate)}`} />
            </div>
            <div className="mt-0.5 flex justify-between text-[10px] text-muted">
              <span>{fmtPct(row.consentRate)}</span>
              <span>{fmtPct(1 - row.consentRate)}</span>
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
    <section aria-label="Opt-in Rate by page type" className="rounded-2xl border border-line bg-surface p-6 shadow-panel">
      <SectionTitle>Opt-in Rate by page type</SectionTitle>
      <div className="space-y-2">
        {data.map((row) => (
          <div key={row.pageType} className="flex items-center gap-3">
            <span className="w-36 truncate text-xs">{row.pageType}</span>
            <div className="flex h-5 flex-1 overflow-hidden rounded">
              <div className="bg-green-600" style={{ width: `${(row.consentRate * 100).toFixed(1)}%` }} />
              <div className="bg-red-500" style={{ width: `${((1 - row.consentRate) * 100).toFixed(1)}%` }} />
            </div>
            <span className="w-12 text-right text-xs tabular-nums">{fmtPct(row.consentRate)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Opt-in rate evolution ─────────────────────────────────────────────────────

function OptInRateEvolution({ data }: { data: ConsentOverviewResult["rateEvolution"] }) {
  if (data.length === 0) return null;
  const min = Math.min(...data.map((r) => r.consentRate));
  const max = Math.max(...data.map((r) => r.consentRate));
  const range = max - min || 0.01;
  const points = data
    .map((r, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((r.consentRate - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <section aria-label="Opt-in Rate Evolution" className="rounded-2xl border border-line bg-surface p-6 shadow-panel">
      <SectionTitle>Opt-in Rate Evolution</SectionTitle>
      <svg viewBox="0 0 100 60" className="h-40 w-full" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={points} fill="none" stroke="#16a34a" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>{data[0]?.day}</span>
        <span>{data.at(-1)?.day}</span>
      </div>
    </section>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

type State =
  | { status: "loading" }
  | { status: "success"; result: ConsentOverviewResult }
  | { status: "error"; message: string; requestId?: string };

export function ConsentOverviewCard() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    fetch("/api/consent-overview", { cache: "no-store" })
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

  if (state.status === "loading") return <LoadingState label="Chargement du dashboard…" />;
  if (state.status === "error")
    return <ErrorState title="Données indisponibles" message={state.message} requestId={state.requestId} />;

  const { result } = state;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ConsentMax Analytics</h1>
        {result.status === "demo" && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            Mode démo — données synthétiques
          </span>
        )}
      </div>

      {/* Row 1 — KPI header */}
      <KpiHeader kpi={result.kpi} status={result.status} />

      {/* Row 2 — Opt-in by month + Consent by member */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <OptInByMonth data={result.byMonth} />
        <ConsentByMember data={result.byMember} />
      </div>

      {/* Row 3 — Device + Page type */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ConsentByDevice data={result.byDevice} />
        <ConsentByPageType data={result.byPageType} />
      </div>

      {/* Row 4 — Evolution */}
      <OptInRateEvolution data={result.rateEvolution} />
    </div>
  );
}
