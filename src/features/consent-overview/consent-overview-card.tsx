"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  type ConsentOverviewResult,
  type FilterParams,
  type Granularity,
  consentOverviewSchema,
} from "@/features/consent-overview/contract";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtN(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} k`;
  return n.toLocaleString("fr-FR");
}
function fmtPct(r: number, digits = 1): string {
  return `${(r * 100).toFixed(digits)} %`;
}
function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Date range picker ─────────────────────────────────────────────────────────

type DateRange = { startDate?: string; endDate?: string };

const PRESETS: { label: string; range: () => DateRange }[] = [
  { label: "Today",          range: () => { const d = toISO(new Date()); return { startDate: d, endDate: d }; } },
  { label: "Yesterday",      range: () => { const d = new Date(); d.setDate(d.getDate()-1); const s = toISO(d); return { startDate: s, endDate: s }; } },
  { label: "This week",      range: () => { const n = new Date(); const m = new Date(n); m.setDate(n.getDate()-n.getDay()+1); return { startDate: toISO(m), endDate: toISO(n) }; } },
  { label: "Last week",      range: () => { const n = new Date(); const m = new Date(n); m.setDate(n.getDate()-n.getDay()-6); const e = new Date(m); e.setDate(m.getDate()+6); return { startDate: toISO(m), endDate: toISO(e) }; } },
  { label: "This month",     range: () => { const n = new Date(); return { startDate: toISO(new Date(n.getFullYear(), n.getMonth(), 1)), endDate: toISO(n) }; } },
  { label: "Last month",     range: () => { const n = new Date(); return { startDate: toISO(new Date(n.getFullYear(), n.getMonth()-1, 1)), endDate: toISO(new Date(n.getFullYear(), n.getMonth(), 0)) }; } },
  { label: "This year",      range: () => { const n = new Date(); return { startDate: `${n.getFullYear()}-01-01`, endDate: toISO(n) }; } },
  { label: "Last 30 days",   range: () => { const e = new Date(); const s = new Date(e); s.setDate(s.getDate()-30); return { startDate: toISO(s), endDate: toISO(e) }; } },
  { label: "Last 90 days",   range: () => { const e = new Date(); const s = new Date(e); s.setDate(s.getDate()-90); return { startDate: toISO(s), endDate: toISO(e) }; } },
  { label: "Last 12 months", range: () => { const e = new Date(); const s = new Date(e); s.setMonth(s.getMonth()-12); return { startDate: toISO(s), endDate: toISO(e) }; } },
];

function DateRangePicker({ startDate, endDate, onChange }: {
  startDate?: string; endDate?: string;
  onChange: (r: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label = startDate && endDate && startDate === endDate ? startDate
    : startDate && endDate ? `${startDate} → ${endDate}`
    : startDate ? `From ${startDate}`
    : endDate   ? `Until ${endDate}`
    : "Select period";

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent">
        <svg className="h-4 w-4 text-muted" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
        </svg>
        <span className={startDate || endDate ? "text-on-surface" : "text-muted"}>{label}</span>
        {(startDate || endDate) && (
          <span role="button" tabIndex={0} aria-label="Clear dates" className="ml-1 text-muted hover:text-on-surface"
            onClick={(e) => { e.stopPropagation(); onChange({ startDate: undefined, endDate: undefined }); }}
            onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), onChange({ startDate: undefined, endDate: undefined }))}>✕</span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-line bg-surface p-4 shadow-xl">
          <div className="mb-3 grid grid-cols-2 gap-1">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" onClick={() => { onChange(p.range()); setOpen(false); }}
                className="rounded-lg px-2 py-1.5 text-left text-xs font-medium text-muted hover:bg-accent/10 hover:text-on-surface">
                {p.label}
              </button>
            ))}
          </div>
          <div className="border-t border-line pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Custom range</p>
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted">Start
                <input type="date" value={startDate ?? ""} max={endDate}
                  onChange={(e) => onChange({ startDate: e.target.value || undefined, endDate })}
                  className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-accent" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">End
                <input type="date" value={endDate ?? ""} min={startDate}
                  onChange={(e) => onChange({ startDate, endDate: e.target.value || undefined })}
                  className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-accent" />
              </label>
            </div>
          </div>
          {(startDate || endDate) && (
            <button type="button" onClick={() => { onChange({ startDate: undefined, endDate: undefined }); setOpen(false); }}
              className="mt-2 w-full rounded-lg border border-line py-1.5 text-xs text-muted hover:text-on-surface">
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

function FilterBar({ filters, available, onChange }: {
  filters: FilterParams; available: string[];
  onChange: (f: Partial<FilterParams>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select value={filters.member ?? ""} onChange={(e) => onChange({ member: e.target.value || undefined })}
        className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent"
        aria-label="Filter by member">
        <option value="">All members</option>
        {available.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <DateRangePicker startDate={filters.startDate} endDate={filters.endDate}
        onChange={(r) => onChange(r)} />
      {(filters.member || filters.startDate || filters.endDate) && (
        <button type="button" onClick={() => onChange({ member: undefined, startDate: undefined, endDate: undefined })}
          className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-on-surface">
          Reset
        </button>
      )}
    </div>
  );
}

// ── KPI header ────────────────────────────────────────────────────────────────
// Layout : 3 colonnes — Contact exposed | Contact with choice (+%) | Placeholder device

function KpiHeader({ kpi, status, lastEventAt }: {
  kpi: ConsentOverviewResult["kpi"]; status: string; lastEventAt: string | null;
}) {
  return (
    <section aria-label="Main KPIs" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* Col 1 — Contact exposed */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-panel">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Contact exposed</span>
        <span className="text-4xl font-bold tabular-nums">{fmtN(kpi.contactTotal)}</span>
        <div className="mt-auto rounded-lg border border-line px-3 py-2 text-center">
          <span className="block text-lg font-semibold">{fmtN(kpi.withoutChoice)}</span>
          <span className="text-xs text-muted">without choice</span>
        </div>
      </div>

      {/* Col 2 — Contact with choice + détail opt-in/custom/opt-out avec % */}
      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 shadow-panel">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Contact with choice</span>
        <div className="rounded-xl bg-accent px-4 py-3 text-center">
          <span className="block text-2xl font-bold text-white tabular-nums">{fmtN(kpi.contactWithChoice)}</span>
        </div>
        <div className="flex flex-col gap-1.5 mt-1">
          {/* Opt-in */}
          <div className="flex items-center justify-between rounded-lg bg-green-600/90 px-3 py-2">
            <span className="text-xs font-medium text-white">Opt-in</span>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-white tabular-nums">{fmtN(kpi.optIn)}</span>
              <span className="text-xs text-white/70">{fmtPct(kpi.consentRate)}</span>
            </div>
          </div>
          {/* Custom */}
          <div className="flex items-center justify-between rounded-lg bg-amber-500/90 px-3 py-2">
            <span className="text-xs font-medium text-white">Custom</span>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-white tabular-nums">{fmtN(kpi.custom)}</span>
              <span className="text-xs text-white/70">{fmtPct(kpi.customRate)}</span>
            </div>
          </div>
          {/* Opt-out */}
          <div className="flex items-center justify-between rounded-lg bg-red-600/90 px-3 py-2">
            <span className="text-xs font-medium text-white">Opt-out</span>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-white tabular-nums">{fmtN(kpi.optOut)}</span>
              <span className="text-xs text-white/70">{fmtPct(kpi.rejectRate)}</span>
            </div>
          </div>
        </div>
        {status !== "demo" && lastEventAt && (
          <p className="text-xs text-muted">✓ live</p>
        )}
      </div>

      {/* Col 3 — Placeholder device (rempli par ConsentByDevice ci-dessous) */}
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-panel">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Consent by device</span>
        <p className="mt-3 text-xs text-muted">↓ see below</p>
      </div>
    </section>
  );
}

// ── Mode toggle ───────────────────────────────────────────────────────────────

type DisplayMode = "pct" | "abs";

function ModeToggle({ mode, onChange }: { mode: DisplayMode; onChange: (m: DisplayMode) => void }) {
  return (
    <div className="flex gap-1 rounded-lg border border-line p-0.5">
      {(["pct", "abs"] as DisplayMode[]).map((m) => (
        <button key={m} type="button" onClick={() => onChange(m)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            mode === m ? "bg-accent text-white" : "text-muted hover:text-on-surface"
          }`}>
          {m === "pct" ? "%" : "#"}
        </button>
      ))}
    </div>
  );
}

// ── Opt-in by period ──────────────────────────────────────────────────────────

const GRAN_LABELS: Record<Granularity, string> = {
  day: "Last 30 days", week: "Last 12 weeks", month: "Last 12 months",
};

function OptInByPeriod({ data, granularity, onGranularity }: {
  data: ConsentOverviewResult["byPeriod"]; granularity: Granularity;
  onGranularity: (g: Granularity) => void;
}) {
  const CHART_H = 192; // px — hauteur utile des barres
  const LABEL_H = 20;  // px — zone pour étiquettes axe X
  const maxVal = Math.max(...data.map((r) => r.firstConsent + r.reexposed), 1);

  // Étiquettes axe X : toutes si <= 15, sinon 1 sur N pour éviter chevauchement
  const step = data.length <= 15 ? 1 : Math.ceil(data.length / 10);

  return (
    <section aria-label="Opt-in by period" className="rounded-2xl border border-line bg-surface p-5 shadow-panel">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Opt-in by period</h3>
        <div className="flex gap-1 rounded-lg border border-line p-1">
          {(["day", "week", "month"] as Granularity[]).map((g) => (
            <button key={g} type="button" onClick={() => onGranularity(g)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                granularity === g ? "bg-accent text-white" : "text-muted hover:text-on-surface"
              }`}>
              {g === "day" ? "Day" : g === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-3 flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-green-700" />1st consent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-green-400" />Reexposed
        </span>
      </p>

      {/* Conteneur SVG — barres + axe X intégré */}
      <div className="overflow-x-auto">
        <div className="flex items-end gap-0.5" style={{ minWidth: `${data.length * 24}px` }}
          role="img" aria-label={`Opt-in — ${GRAN_LABELS[granularity]}`}>
          {data.map((row, i) => {
            const total   = row.firstConsent + row.reexposed;
            const barH    = Math.round((total / maxVal) * CHART_H);
            const firstH  = total > 0 ? Math.round((row.firstConsent / total) * barH) : 0;
            const reexH   = barH - firstH;
            const pctFirst = total > 0 ? fmtPct(row.firstConsent / total) : "—";
            const pctReex  = total > 0 ? fmtPct(row.reexposed / total)    : "—";
            const showLabel = i % step === 0 || i === data.length - 1;
            // Label court : derniers 5 chars "25-10", "26-W31"
            const shortLabel = row.period.length > 7 ? row.period.slice(-5) : row.period.slice(-5);

            return (
              <div key={row.period} className="group relative flex flex-1 flex-col items-center"
                style={{ height: `${CHART_H + LABEL_H}px` }}>
                {/* Barre */}
                <div className="flex w-full flex-col justify-end" style={{ height: `${CHART_H}px` }}>
                  <div className="flex w-full flex-col justify-end" style={{ height: `${barH}px` }}>
                    <div className="w-full bg-green-400" style={{ height: `${reexH}px` }} />
                    <div className="w-full bg-green-700" style={{ height: `${firstH}px` }} />
                  </div>
                </div>
                {/* Étiquette axe X */}
                <div className="flex items-center justify-center" style={{ height: `${LABEL_H}px` }}>
                  {showLabel && (
                    <span className="block text-center text-[9px] leading-none text-muted"
                      style={{ writingMode: data.length > 20 ? "vertical-rl" : "horizontal-tb", transform: data.length > 20 ? "rotate(180deg)" : "none" }}>
                      {shortLabel}
                    </span>
                  )}
                </div>
                {/* Infobulle */}
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-48 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-xl group-hover:block">
                  <p className="mb-1 font-semibold">{row.period}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-3 shrink-0 rounded-sm bg-green-700" />
                    <span className="flex-1">1st consent</span>
                    <span className="tabular-nums">{fmtN(row.firstConsent)}</span>
                    <span className="text-white/60">({pctFirst})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-3 shrink-0 rounded-sm bg-green-400" />
                    <span className="flex-1">Reexposed</span>
                    <span className="tabular-nums">{fmtN(row.reexposed)}</span>
                    <span className="text-white/60">({pctReex})</span>
                  </div>
                  <div className="mt-1 flex justify-between border-t border-white/20 pt-1 font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{fmtN(total)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Consent by member ─────────────────────────────────────────────────────────

function ConsentByMember({ data }: { data: ConsentOverviewResult["byMember"] }) {
  const [mode, setMode] = useState<DisplayMode>("pct");
  const maxOptIn = Math.max(...data.map((r) => r.optIn), 1);

  return (
    <section aria-label="Consent by member" className="rounded-2xl border border-line bg-surface p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Consent by member</h3>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>
      <div className="space-y-2">
        {data.map((row) => {
          const optInW  = mode === "pct" ? row.consentRate     : row.optIn  / maxOptIn;
          const optOutW = mode === "pct" ? row.optOut / (row.total || 1) : row.optOut / maxOptIn;
          const customW = mode === "pct" ? row.custom / (row.total || 1) : row.custom / maxOptIn;
          const label   = mode === "pct" ? fmtPct(row.consentRate) : fmtN(row.optIn);
          return (
            <div key={row.member} className="group relative flex items-center gap-3">
              <span className="w-8 shrink-0 text-xs font-semibold">{row.member}</span>
              <div className="flex h-5 flex-1 overflow-hidden rounded">
                <div className="bg-green-600 transition-all" style={{ width: `${(optInW  * 100).toFixed(1)}%` }} />
                {customW > 0.001 && <div className="bg-amber-500 transition-all" style={{ width: `${(customW * 100).toFixed(1)}%` }} />}
                <div className="bg-red-500 transition-all"  style={{ width: `${(optOutW * 100).toFixed(1)}%` }} />
              </div>
              <span className="w-16 shrink-0 text-right text-xs tabular-nums font-medium">{label}</span>
              {/* Infobulle */}
              <div className="pointer-events-none absolute left-10 top-full z-10 mt-1 hidden w-56 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-xl group-hover:block">
                <p className="mb-1 font-semibold">{row.member}</p>
                <div className="flex justify-between gap-3">
                  <span>Opt-in</span>
                  <span>{fmtN(row.optIn)} · {fmtPct(row.consentRate)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Opt-out</span>
                  <span>{fmtN(row.optOut)} · {fmtPct(row.optOut / (row.total || 1))}</span>
                </div>
                {row.custom > 0 && (
                  <div className="flex justify-between gap-3">
                    <span>Custom</span>
                    <span>{fmtN(row.custom)} · {fmtPct(row.custom / (row.total || 1))}</span>
                  </div>
                )}
                <div className="mt-1 flex justify-between border-t border-white/20 pt-1 font-semibold">
                  <span>Total</span><span>{fmtN(row.total)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-green-600" />Opt-in</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-red-500" />Opt-out</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm bg-amber-500" />Custom</span>
      </div>
    </section>
  );
}

// ── Opt-in by device ──────────────────────────────────────────────────────────

function ConsentByDevice({ data }: { data: ConsentOverviewResult["byDevice"] }) {
  const [mode, setMode] = useState<DisplayMode>("pct");
  const maxOptIn = Math.max(...data.map((r) => r.optIn), 1);

  return (
    <section aria-label="Opt-in by device" className="rounded-2xl border border-line bg-surface p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Opt-in by device</h3>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>
      <div className="space-y-4">
        {data.map((row) => {
          const optInW  = mode === "pct" ? row.consentRate     : row.optIn  / maxOptIn;
          const optOutW = mode === "pct" ? 1 - row.consentRate : row.optOut / maxOptIn;
          return (
            <div key={row.deviceType} className="group relative">
              {/* Label : device + share of total seulement */}
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{row.deviceType}</span>
                <span className="shrink-0 text-right text-xs font-bold text-muted">
                  {fmtPct(row.shareOfTotal)}
                </span>
              </div>
              <div className="flex h-6 overflow-hidden rounded-lg">
                <div className="flex items-center justify-center bg-green-600 text-[10px] font-bold text-white transition-all"
                  style={{ width: `${(optInW * 100).toFixed(1)}%` }}>
                  {optInW > 0.12 ? (mode === "pct" ? fmtPct(row.consentRate, 0) : fmtN(row.optIn)) : ""}
                </div>
                <div className="flex items-center justify-center bg-red-500 text-[10px] font-bold text-white transition-all"
                  style={{ width: `${(optOutW * 100).toFixed(1)}%` }}>
                  {optOutW > 0.12 ? (mode === "pct" ? fmtPct(1 - row.consentRate, 0) : fmtN(row.optOut)) : ""}
                </div>
              </div>
              {/* Infobulle */}
              <div className="pointer-events-none absolute left-0 top-full z-10 mt-1 hidden w-52 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-xl group-hover:block">
                <p className="mb-1 font-semibold">{row.deviceType}</p>
                <div className="flex justify-between gap-3"><span>Opt-in</span><span>{fmtN(row.optIn)} · {fmtPct(row.consentRate)}</span></div>
                <div className="flex justify-between gap-3"><span>Opt-out</span><span>{fmtN(row.optOut)} · {fmtPct(1 - row.consentRate)}</span></div>
                <div className="flex justify-between gap-3"><span>Share of total</span><span>{fmtPct(row.shareOfTotal)}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Consent by page type ──────────────────────────────────────────────────────

function ConsentByPageType({ data }: { data: ConsentOverviewResult["byPageType"] }) {
  const [mode, setMode] = useState<DisplayMode>("pct");
  const maxOptIn = Math.max(...data.map((r) => r.optIn), 1);

  return (
    <section aria-label="Opt-in rate by page type" className="rounded-2xl border border-line bg-surface p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Opt-in rate by page type</h3>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>
      <div className="space-y-2">
        {data.map((row) => {
          const optInW  = mode === "pct" ? row.consentRate     : row.optIn  / maxOptIn;
          const optOutW = mode === "pct" ? 1 - row.consentRate : row.optOut / maxOptIn;
          const label   = mode === "pct" ? fmtPct(row.consentRate) : fmtN(row.optIn);
          return (
            <div key={row.pageType} className="group relative flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-sm" title={row.pageType}>{row.pageType}</span>
              <div className="flex h-5 flex-1 overflow-hidden rounded">
                <div className="bg-green-600 transition-all" style={{ width: `${(optInW  * 100).toFixed(1)}%` }} />
                <div className="bg-red-500 transition-all"   style={{ width: `${(optOutW * 100).toFixed(1)}%` }} />
              </div>
              <span className="w-16 shrink-0 text-right text-xs tabular-nums font-medium">{label}</span>
              {/* Infobulle */}
              <div className="pointer-events-none absolute left-40 top-full z-10 mt-1 hidden w-52 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-xl group-hover:block">
                <p className="mb-1 font-semibold">{row.pageType}</p>
                <div className="flex justify-between gap-3"><span>Opt-in</span><span>{fmtN(row.optIn)} · {fmtPct(row.consentRate)}</span></div>
                <div className="flex justify-between gap-3"><span>Opt-out</span><span>{fmtN(row.optOut)} · {fmtPct(row.optOut / (row.total || 1))}</span></div>
                <div className="mt-1 flex justify-between border-t border-white/20 pt-1 font-semibold"><span>Total</span><span>{fmtN(row.total)}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Opt-in rate evolution ─────────────────────────────────────────────────────

function OptInRateEvolution({ data }: { data: ConsentOverviewResult["rateEvolution"] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; day: string; rate: number } | null>(null);

  if (data.length === 0) return null;

  const rates = data.map((r) => r.consentRate);
  const minR  = Math.min(...rates);
  const maxR  = Math.max(...rates);
  const pad   = (maxR - minR) * 0.15 || 0.02;
  const yMin  = Math.max(0, minR - pad);
  const yMax  = Math.min(1, maxR + pad);
  const yRange = yMax - yMin || 0.01;

  const W = 1000; const H = 220;
  const PAD = { top: 16, right: 12, bottom: 32, left: 52 };
  const cW  = W - PAD.left - PAD.right;
  const cH  = H - PAD.top  - PAD.bottom;

  const toX = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * cW;
  const toY = (v: number) => PAD.top  + (1 - (v - yMin) / yRange) * cH;

  const linePath = data.map((r, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(r.consentRate).toFixed(1)}`).join(" ");

  // Étiquettes axe Y
  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (i / 4) * yRange);

  // Étiquettes axe X — max 8 labels espacés
  const xStep = Math.max(1, Math.floor(data.length / 8));
  const xTicks = data
    .map((r, i) => ({ i, label: r.day }))
    .filter(({ i }) => i % xStep === 0 || i === data.length - 1);

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const relX = svgX - PAD.left;
    const idx = Math.round((relX / cW) * (data.length - 1));
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    const row = data[clamped];
    if (!row) return;
    setTooltip({ x: toX(clamped), y: toY(row.consentRate), day: row.day, rate: row.consentRate });
  }

  return (
    <section aria-label="Opt-in Rate Evolution" className="rounded-2xl border border-line bg-surface p-5 shadow-panel">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Opt-in rate evolution</h3>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full" preserveAspectRatio="xMidYMid meet"
          role="img" aria-label="Opt-in rate evolution"
          onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
          {/* Grille Y */}
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} y1={toY(v)} x2={W - PAD.right} y2={toY(v)}
                stroke="currentColor" strokeOpacity={0.1} strokeWidth={1} />
              <text x={PAD.left - 6} y={toY(v) + 4} textAnchor="end" fontSize={11}
                fill="currentColor" fillOpacity={0.5}>{fmtPct(v, 0)}</text>
            </g>
          ))}
          {/* Étiquettes axe X */}
          {xTicks.map(({ i, label }) => (
            <text key={i} x={toX(i)} y={H - 4} textAnchor="middle" fontSize={10}
              fill="currentColor" fillOpacity={0.5}>{label}</text>
          ))}
          {/* Courbe */}
          <path d={linePath} fill="none" stroke="#16a34a" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          {/* Point survolé */}
          {tooltip && (
            <circle cx={tooltip.x} cy={tooltip.y} r={4} fill="#16a34a" stroke="white" strokeWidth={1.5} />
          )}
          {/* Zone de capture souris transparente */}
          <rect x={PAD.left} y={PAD.top} width={cW} height={cH} fill="transparent" />
        </svg>
        {/* Infobulle HTML (plus facile à styler que SVG) */}
        {tooltip && (
          <div className="pointer-events-none absolute z-10 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-xl"
            style={{
              left: `${(tooltip.x / W) * 100}%`,
              top:  `${(tooltip.y / H) * 100}%`,
              transform: "translate(-50%, -130%)",
            }}>
            <p className="font-semibold">{tooltip.day}</p>
            <p>Consent rate: <span className="font-bold">{fmtPct(tooltip.rate)}</span></p>
          </div>
        )}
      </div>
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
    if (f.member)    params.set("member",      f.member);
    if (f.startDate) params.set("startDate",   f.startDate);
    if (f.endDate)   params.set("endDate",     f.endDate);
    if (f.granularity) params.set("granularity", f.granularity);

    fetch(`/api/consent-overview?${params.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        const payload: unknown = await res.json();
        if (!res.ok) {
          const err = payload as { error?: { message?: string; requestId?: string } };
          setState({ status: "error", message: err.error?.message ?? "Data unavailable.", requestId: err.error?.requestId });
          return;
        }
        setState({ status: "success", result: consentOverviewSchema.parse(payload) });
      })
      .catch(() => setState({ status: "error", message: "Invalid server response." }));
  }, []);

  useEffect(() => { load(filters); }, [load, filters]);

  function handleFilterChange(partial: Partial<FilterParams>) {
    setFilters((f) => ({ ...f, ...partial }));
  }
  function handleGranularity(g: Granularity) {
    setFilters((f) => ({ ...f, granularity: g }));
  }

  const availableMembers = state.status === "success" ? state.result.filters.availableMembers : [];
  const granularity = state.status === "success" ? state.result.filters.granularity : (filters.granularity ?? "month");
  const lastEventAt = state.status === "success" ? state.result.kpi.lastEventAt : null;

  return (
    <div className="min-h-screen space-y-5 p-6">
      {/* Header avec last refresh */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-bold">ConsentMax Analytics</h1>
          {lastEventAt && (
            <span className="text-xs text-muted">
              last refresh: <span className="font-medium text-on-surface">{lastEventAt}</span>
            </span>
          )}
          {state.status === "success" && state.result.status === "demo" && (
            <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-medium text-amber-800">
              Demo mode
            </span>
          )}
        </div>
        <FilterBar filters={filters} available={availableMembers} onChange={handleFilterChange} />
      </div>

      {state.status === "loading" && <LoadingState label="Loading dashboard…" />}
      {state.status === "error" && (
        <ErrorState title="Data unavailable" message={state.message} requestId={state.requestId} />
      )}

      {state.status === "success" && (() => {
        const { result } = state;
        return (
          <div className="space-y-5">
            <KpiHeader kpi={result.kpi} status={result.status} lastEventAt={result.kpi.lastEventAt} />
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <OptInByPeriod data={result.byPeriod} granularity={granularity} onGranularity={handleGranularity} />
              <ConsentByMember data={result.byMember} />
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <ConsentByDevice data={result.byDevice} />
              <ConsentByPageType data={result.byPageType} />
            </div>
            <OptInRateEvolution data={result.rateEvolution} />
          </div>
        );
      })()}
    </div>
  );
}
